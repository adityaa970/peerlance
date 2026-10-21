import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { safeRole } from '@/lib/roles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateReferralCode(name: string) {
  const prefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'RA');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { referralCode: bodyReferralCode } = await req.json().catch(() => ({}));

    // Get latest details from Clerk
    const user = await (await clerkClient()).users.getUser(userId);
    const metadata = (user.unsafeMetadata || {}) as Record<string, unknown>;
    
    // Referral code can come from body OR cached in Clerk metadata
    const incomingReferralCode = bodyReferralCode || metadata.referralCode;

    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) {
      return new NextResponse('User has no primary email', { status: 400 });
    }

    const selectedCollegeName =
      (metadata.collegeName as string) ||
      ((user.publicMetadata as Record<string, unknown> | undefined)?.collegeName as string) ||
      '';
    const collegeDomain = 'manual_selection';

    // 1. Check if user exists via clerkId or email
    let { data: existingUser } = await supabase
      .from('User')
      .select('id, college, isVerified, referralCode, role')
      .eq('clerkId', userId)
      .single();

    if (!existingUser) {
       const { data: emailUser } = await supabase.from('User').select('id, college, isVerified, referralCode, role').eq('email', primaryEmail).single();
       existingUser = emailUser;
    }

    // 1.5 Check AI verification status
    const { data: verification } = await supabase
      .from('IdVerification')
      .select('status, idCardUrl')
      .eq('email', primaryEmail.toLowerCase())
      .maybeSingle();
    
    const isAiVerified = verification?.status === 'VERIFIED' || verification?.status === 'AI_PASSED';

    const finalCollege = selectedCollegeName || existingUser?.college || 'Unknown';

    const baseUserData = {
      clerkId: userId,
      email: primaryEmail,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No Name',
      avatarUrl: user.imageUrl,
      // unsafeMetadata is client-editable: only poster/writer are accepted from it,
      // and an existing admin keeps admin (admin is granted in the DB only).
      role: existingUser?.role === 'admin'
        ? 'admin'
        : safeRole(metadata.role, safeRole(existingUser?.role)),
      updatedAt: new Date().toISOString()
    };
    
    // Fetch district from colleges table if college is known
    let district = null;
    if (selectedCollegeName) {
      const { data: colData } = await supabase
        .from('colleges')
        .select('District')
        .eq('Name', selectedCollegeName)
        .single();
      if (colData) {
        district = colData.District;
      }
    }

    let referredById = null;
    if (incomingReferralCode) {
      const { data: referrer } = await supabase
        .from('User')
        .select('id')
        .eq('referralCode', incomingReferralCode.toUpperCase())
        .single();
      if (referrer) {
        referredById = referrer.id;
      }
    }

    let dbUser;
    let upsertError;

    if (existingUser) {
      // 2. Update existing user
      // Do NOT blindly overwrite isActive, isVerified, college, or idCardUrl if already set
      const updateData = {
        ...baseUserData,
        isVerified: existingUser.isVerified || isAiVerified,
        // Only update college if Clerk had a new one selected during onboarding
        ...(selectedCollegeName ? { college: selectedCollegeName, collegeDomain } : {}),
        // Ensure existing users get a referral code
        ...(!existingUser.referralCode ? { referralCode: generateReferralCode(baseUserData.name) } : {}),
        ...(district ? { district } : {})
      };

      const { data, error } = await supabase
        .from('User')
        .update(updateData)
        .eq('id', existingUser.id)
        .select(`
          id, name, email, role, college, district, walletBalance, promoBalance, earnedBalance, referralCode, referredById, isVerified, isActive, isPublicProfile, taskScope, trustScore, totalCompleted, avatarUrl, idCardUrl, pushNotificationsEnabled, assignmentAlertsEnabled
        `)
        .single();

      dbUser = data;
      upsertError = error;
    } else {
      // 3. Insert new user safely
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No Name';
      const insertData = {
        id: crypto.randomUUID(),
        ...baseUserData,
        name,
        referralCode: generateReferralCode(name),
        referredById,
        idCardUrl: verification?.idCardUrl || (typeof metadata.idCardUrl === 'string' ? metadata.idCardUrl : null),
        collegeDomain,
        college: finalCollege,
        district,
        isVerified: isAiVerified,
        isActive: false
      };

      const { data, error } = await supabase
        .from('User')
        .insert(insertData)
        .select(`
          id, name, email, role, college, district, walletBalance, promoBalance, earnedBalance, referralCode, referredById, isVerified, isActive, isPublicProfile, taskScope, trustScore, totalCompleted, avatarUrl, idCardUrl, pushNotificationsEnabled, assignmentAlertsEnabled
        `)
        .single();

      dbUser = data;
      upsertError = error;

      // Handle Race Condition specifically for Duplicate Email/ClerkId
      if (upsertError && upsertError.code === '23505') {
        const { data: retryData, error: retryError } = await supabase
          .from('User')
          .update(baseUserData) // Safe retry update
          .eq('clerkId', userId)
          .select(`
          id, name, email, role, college, district, walletBalance, promoBalance, earnedBalance, referralCode, referredById, isVerified, isActive, isPublicProfile, taskScope, trustScore, totalCompleted, avatarUrl, idCardUrl, pushNotificationsEnabled, assignmentAlertsEnabled
          `)
          .single();
        
        dbUser = retryData;
        upsertError = retryError;
      }
    }

    if (upsertError) {
      console.error('Supabase DB Error:', upsertError);
      return new NextResponse(upsertError.message, { status: 500 });
    }

    // 4. If user is now synced and was AI_PASSED, promote to VERIFIED
    if (verification?.status === 'AI_PASSED') {
      await supabase
        .from('IdVerification')
        .update({ status: 'VERIFIED', updatedAt: new Date().toISOString() })
        .eq('email', primaryEmail.toLowerCase());
    }

    return NextResponse.json({ success: true, user: dbUser });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
