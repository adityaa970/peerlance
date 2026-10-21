import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { sendPushNotifications } from '../../../lib/pushNotifications';
import { adjustBalances, InsufficientBalanceError } from '../../../lib/wallet';

// Must match the mobile app's post screen.
const PLATFORM_FEE_RATE = 0.12;
const MAX_PAGES = 500;
const MAX_RATE_PER_PAGE = 1000;
const MAX_ATTACHMENTS = 10;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.replace('cloudinary://', '').split('@')[1],
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subject, deadline, instructions, attachments, college } = body;

    // Never trust prices from the client: recompute them from pages x rate.
    const pages = Number(body.pages);
    const ratePerPage = Number(body.ratePerPage);
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) {
      return NextResponse.json({ success: false, error: `Pages must be a whole number between 1 and ${MAX_PAGES}.` }, { status: 400 });
    }
    if (!Number.isInteger(ratePerPage) || ratePerPage < 1 || ratePerPage > MAX_RATE_PER_PAGE) {
      return NextResponse.json({ success: false, error: `Rate per page must be a whole number between ₹1 and ₹${MAX_RATE_PER_PAGE}.` }, { status: 400 });
    }
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 100) {
      return NextResponse.json({ success: false, error: 'Invalid subject.' }, { status: 400 });
    }
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid deadline.' }, { status: 400 });
    }
    if (instructions !== undefined && (typeof instructions !== 'string' || instructions.length > 5000)) {
      return NextResponse.json({ success: false, error: 'Instructions are too long.' }, { status: 400 });
    }
    if (attachments !== undefined && (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS)) {
      return NextResponse.json({ success: false, error: `You can attach up to ${MAX_ATTACHMENTS} files.` }, { status: 400 });
    }

    const totalCost = pages * ratePerPage;
    const platformFee = Math.round(totalCost * PLATFORM_FEE_RATE);
    const writerEarns = totalCost - platformFee;

    // Upload multiple images/files if provided
    const imageUrls: string[] = [];
    if (attachments && Array.isArray(attachments)) {
      for (const b64 of attachments) {
        if (typeof b64 !== 'string') continue;
        try {
          const uploadResponse = await cloudinary.uploader.upload(`data:image/jpeg;base64,${b64}`, {
            folder: 'peerlance_tasks',
          });
          imageUrls.push(uploadResponse.secure_url);
        } catch (err) {
          console.error('Cloudinary upload error:', err);
        }
      }
    }

    // Find the poster user and check balance
    const { data: dbUser, error: userError } = await supabase
      .from('User')
      .select('id, college, walletBalance')
      .eq('clerkId', userId)
      .single();

    if (userError || !dbUser) {
      console.error('Supabase User Fetch Error:', userError);
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    const currentBalance = Number(dbUser.walletBalance || 0);
    const insufficient = () => NextResponse.json({
      success: false,
      error: `Insufficient balance. You need ₹${totalCost.toFixed(2)} to post this task but have ₹${currentBalance.toFixed(2)}.`
    }, { status: 400 });

    if (currentBalance < totalCost) {
      return insufficient();
    }

    // 1. Deduct balance first (Escrow Lock). Atomic, and refuses to go below zero.
    try {
      await adjustBalances(supabase, dbUser.id, { walletBalance: -totalCost }, { requireNonNegative: true });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) return insufficient();
      throw new Error('Failed to deduct from wallet balance. Please try again.');
    }

    // 2. Log Transaction
    const transactionId = crypto.randomUUID();
    const { error: transError } = await supabase
      .from('Transaction')
      .insert({
        id: transactionId,
        userId: dbUser.id,
        type: 'DEBIT',
        amount: totalCost,
        note: `Escrow Lock for task: ${subject}`
      });
    
    if (transError) console.error("Failed to log transaction:", transError);

    const taskId = crypto.randomUUID();

    // 3. Insert task
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .insert({
        id: taskId,
        title: `${pages} pages of ${subject}`,
        description: instructions || 'No instructions provided.',
        category: 'OTHER',
        budget: totalCost,
        platformFee,
        workerPayout: writerEarns,
        campusLocation: 'Not specified',
        college: college || dbUser.college || 'BITS Pilani',
        deadline: deadlineDate.toISOString(),
        posterId: dbUser.id,
        proofPhotoUrl: imageUrls.length > 0 ? imageUrls.join(',') : null,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (taskError) {
      // ROLLBACK: Refund user if task creation failed
      console.error("Task creation failed after deduction. Rolling back...", taskError);
      await adjustBalances(supabase, dbUser.id, { walletBalance: totalCost });
      await supabase.from('Transaction').insert({
        id: crypto.randomUUID(),
        userId: dbUser.id,
        type: 'CREDIT',
        amount: totalCost,
        note: `ROLLBACK: Refund for failed task creation (${subject})`
      });
      throw taskError;
    }

    // Notify all writers in the same college
    const taskCollege = college || dbUser.college || '';
    if (taskCollege) {
      const { data: writers } = await supabase
        .from('User')
        .select('pushToken')
        .eq('role', 'writer')
        .eq('college', taskCollege)
        .eq('pushNotificationsEnabled', true)
        .eq('assignmentAlertsEnabled', true)
        .not('pushToken', 'is', null);

      if (writers && writers.length > 0) {
        const tokens = writers.map((w: any) => w.pushToken).filter(Boolean);
        sendPushNotifications(tokens, {
          title: 'New Assignment Posted',
          body: `${pages} pages of ${subject} — ₹${totalCost}`,
          data: { taskId: task.id },
        });
      }
    }

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const college = url.searchParams.get('college');
    const district = url.searchParams.get('district');

    let query = supabase
      .from('Task')
      .select('id, title, description, budget, platformFee, workerPayout, deadline, status, posterId, college, User!Task_posterId_fkey(name, avatarUrl, trustScore, avgRatingRecvd)')
      .eq('status', 'OPEN')
      .order('updatedAt', { ascending: false });

    if (college) {
      query = query.eq('college', college);
    } else if (district) {
      // Find all colleges in this district first
      const { data: collegesInDistrict } = await supabase
        .from('colleges')
        .select('Name')
        .eq('District', district);
      
      if (collegesInDistrict && collegesInDistrict.length > 0) {
        const collegeNames = collegesInDistrict.map(c => c.Name);
        query = query.in('college', collegeNames);
      } else {
        // If district not found or has no colleges, return empty
        return NextResponse.json({ success: true, tasks: [] });
      }
    }

    const { data: tasks, error } = await query;

    if (error) {
      throw error;
    }

    const formattedTasks = tasks.map((t: any) => {
      const titleParts = t.title ? t.title.split(' pages of ') : [];
      const pages = titleParts.length === 2 ? parseInt(titleParts[0]) : 0;
      const subject = titleParts.length === 2 ? titleParts[1] : t.title;

      // Use pre-calculated rating from DB if available, else default to 5.0
      const posterRating = t.User?.avgRatingRecvd || 5.0;

      return {
        id: t.id,
        subject: subject || 'OTHER',
        pages: pages || 1,
        ratePerPage: t.budget && pages ? Math.round(t.budget / pages) : t.budget,
        totalCost: t.budget || 0,
        platformFee: t.platformFee || 0,
        writerEarns: t.workerPayout || (t.budget - (t.platformFee || 0)),
        deadline: new Date(t.deadline).toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
        }),
        instructions: t.description,
        posterName: t.User?.name || 'Student',
        posterAvatarUrl: t.User?.avatarUrl || null,
        posterRating: parseFloat(Number(posterRating).toFixed(1)),
        status: t.status || 'OPEN'
      };
    });

    return NextResponse.json({ success: true, tasks: formattedTasks });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
