import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { gemini, GEMINI_MODEL, fetchImageAsInlineData, isRateLimited } from '@/lib/gemini';
import crypto from 'crypto';
import { normalizeString } from '@/lib/string';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ID_CARD_PROMPT = `Analyze this college ID card image. Extract as many details as possible and return it strictly as a JSON object:
              {
                "is_valid_id": boolean,
                "name": "Full Name",
                "college": "College Name",
                "roll_number": "Roll/Enrollment Number or null",
                "course": "Course/Program Name or null",
                "year_semester": "Year or Semester or null",
                "academic_session": "e.g. 2023-27 or null",
                "expiry_date": "Date or null",
                "blood_group": "e.g. AB+ or null",
                "address": "Address if found or null",
                "barcode_data": "Barcode/QR text if visible or null",
                "emergency_contact": "Number if found or null",
                "confidence_score": number between 0 and 1,
                "reasoning": "brief explanation"
              }
              If it is not a college ID card, set is_valid_id to false. Set fields to null if not found.`;

// Uploads come from our own Cloudinary account (see /api/upload).
const ALLOWED_IMAGE_PREFIX = 'https://res.cloudinary.com/';
// Each attempt costs an AI call, so limit how often one account can retry.
const RETRY_COOLDOWN_MS = 20 * 1000;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { idCardUrl } = await req.json();

    if (typeof idCardUrl !== 'string' || !idCardUrl.startsWith(ALLOWED_IMAGE_PREFIX)) {
      return new NextResponse('Missing or invalid ID card image', { status: 400 });
    }

    // Use the signed-in user's verified email, never one from the request body,
    // so nobody can create verification records for someone else's account.
    const clerkUser = await (await clerkClient()).users.getUser(userId);
    const email = clerkUser.emailAddresses
      .find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    if (!email) {
      return new NextResponse('Your account has no email address', { status: 400 });
    }

    const { data: previous } = await supabase
      .from('IdVerification')
      .select('updatedAt')
      .eq('email', email)
      .maybeSingle();

    if (previous?.updatedAt && Date.now() - new Date(previous.updatedAt).getTime() < RETRY_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait a few seconds before trying again.' }, { status: 429 });
    }

    console.log(`Starting AI verification for user ${userId}`);

    // 1. Ask Gemini to read the ID card. The image is downloaded here (only from our
    //    Cloudinary, checked above) and sent inline.
    const image = await fetchImageAsInlineData(idCardUrl);
    const response = await gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: image },
          { text: ID_CARD_PROMPT },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const analysis = JSON.parse(response.text || '{}');
    console.log('AI Analysis result:', analysis);

    // 2. Check for duplicate verified ID
    if (analysis.is_valid_id && analysis.name && analysis.college) {
      const normName = normalizeString(analysis.name);
      const normCollege = normalizeString(analysis.college);
      console.log(`Checking uniqueness for Normalized Name: "${normName}", College: "${normCollege}"`);

      // Fetch VERIFIED records to check for duplicates
      const { data: potentialDuplicates } = await supabase
        .from('IdVerification')
        .select('email, extractedName, extractedCollege, idCardUrl')
        .eq('status', 'VERIFIED')
        .neq('email', email);

      if (potentialDuplicates && potentialDuplicates.length > 0) {
        const duplicate = potentialDuplicates.find(rec => {
          const dbName = normalizeString(rec.extractedName);
          const dbCollege = normalizeString(rec.extractedCollege);
          
          return (dbName === normName && dbCollege === normCollege) || (rec.idCardUrl === idCardUrl);
        });

        if (duplicate) {
          console.warn(`Duplicate blocked! ID already verified for email: ${duplicate.email}`);
          return NextResponse.json({ 
            success: false, 
            status: 'REJECTED',
            analysis: {
              ...analysis,
              is_valid_id: false,
              reasoning: `Identity Conflict: This ID card (name: ${analysis.name}) is already verified and linked to another account (${duplicate.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}).`
            }
          });
        }
      }
    }

    // 3. Determine verification status
    // Initial status is AI_PASSED. It only becomes VERIFIED after successful OTP sync.
    const status = (analysis.is_valid_id && analysis.confidence_score >= 0.6) ? 'AI_PASSED' : 'REJECTED';

    // 4. Save to Supabase IdVerification table
    const { data, error } = await supabase
      .from('IdVerification')
      .upsert({
        id: crypto.randomUUID(),
        email,
        idCardUrl,
        status,
        extractedName: analysis.name || null,
        extractedCollege: analysis.college || null,
        rollNumber: analysis.roll_number || null,
        course: analysis.course || null,
        yearSemester: analysis.year_semester || null,
        academicSession: analysis.academic_session || null,
        expiryDate: analysis.expiry_date || null,
        bloodGroup: analysis.blood_group || null,
        address: analysis.address || null,
        barcodeData: analysis.barcode_data || null,
        emergencyContact: analysis.emergency_contact || null,
        analysis: analysis,
        updatedAt: new Date().toISOString()
      }, { onConflict: 'email' })
      .select()
      .single();

    if (error) {
      console.error('Supabase DB Error:', error);
      return new NextResponse('Failed to save verification', { status: 500 });
    }

    // If the user already has a profile, mark it verified now. (New sign-ups get
    // this from /api/users/sync, which reads the IdVerification record.)
    if (status === 'AI_PASSED') {
      await supabase
        .from('User')
        .update({ idCardUrl, isVerified: true, updatedAt: new Date().toISOString() })
        .eq('clerkId', userId);
    }

    return NextResponse.json({ 
      success: true, 
      status, 
      analysis: analysis,
      verification: data 
    });

  } catch (error) {
    console.error('ID Verification Error:', error);
    if (isRateLimited(error)) {
      return NextResponse.json({ error: 'ID verification is busy right now. Please try again in a minute.' }, { status: 429 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
