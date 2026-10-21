import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

function generateReferralCode(name: string) {
  const prefix = (name || 'USER').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'RA');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}

// Only the owner (or an admin) may see these.
const PRIVATE_FIELDS = [
  'email', 'walletBalance', 'promoBalance', 'earnedBalance', 'idCardUrl',
  'referralCode', 'referredById', 'taskScope', 'totalSpent', 'totalEarnings',
] as const;

type TaskStatRow = { status: string; budget: number | null; workerPayout: number | null };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId: viewerId } = await auth();

    // Fetch user and their received ratings
    const { data: user, error: userError } = await supabase
      .from('User')
      .select(`
        id,
        name,
        role,
        clerkId,
        email,
        walletBalance,
        college,
        avatarUrl,
        idCardUrl,
        description,
        showcaseUrls,
        isVerified,
        isActive,
        isPublicProfile,
        totalCompleted,
        trustScore,
        avgRatingRecvd,
        referralCode,
        referredById,
        taskScope,
        district,
        promoBalance,
        earnedBalance,
        Rating_received:Rating!Rating_receiverId_fkey (
          id,
          score,
          comment,
          createdAt,
          Task:Task (
            id,
            title
          ),
          User_giver:User!Rating_giverId_fkey (
            name,
            avatarUrl
          )
        )
      `)
      .eq('clerkId', id)
      .single();

    if (userError || !user) {
      console.error('Fetch User Error:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let canSeePrivate = viewerId === id;
    if (!canSeePrivate && viewerId) {
      const { data: viewer } = await supabase.from('User').select('role').eq('clerkId', viewerId).maybeSingle();
      canSeePrivate = viewer?.role === 'admin';
    }

    // Hidden profiles are only visible to their owner and admins.
    if (!canSeePrivate && !user.isPublicProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-generate referral code if missing
    if (canSeePrivate && !user.referralCode) {
      const newCode = generateReferralCode(user.name);
      const { data: updatedUser } = await supabase
        .from('User')
        .update({ referralCode: newCode })
        .eq('id', user.id)
        .select('referralCode')
        .single();
      
      if (updatedUser) {
        user.referralCode = updatedUser.referralCode;
      }
    }

    let assignmentsPosted = 0;
    let totalSpent = 0;
    let totalEarnings = 0;
    let totalPagesWritten = 0;

    // Only load this user's tasks, not the whole table.
    const [{ data: posted }, { data: written }] = await Promise.all([
      supabase.from('Task').select('status, budget, workerPayout').eq('posterId', user.id).neq('status', 'CANCELLED'),
      supabase.from('Task').select('status, budget, workerPayout').eq('workerId', user.id).eq('status', 'COMPLETED'),
    ]);
    const myPosted = (posted || []) as TaskStatRow[];
    const myWritten = (written || []) as TaskStatRow[];
    assignmentsPosted = myPosted.length;
    totalSpent = myPosted.filter((t) => t.status === 'COMPLETED').reduce((acc, t) => acc + (t.budget || 0), 0);
    totalPagesWritten = myWritten.length;
    totalEarnings = myWritten.reduce((acc, t) => acc + (t.workerPayout || 0), 0);

    const enrichedUser: Record<string, unknown> = { ...user, assignmentsPosted, totalSpent, totalEarnings, totalPagesWritten };
    if (!canSeePrivate) {
      for (const field of PRIVATE_FIELDS) delete enrichedUser[field];
    }

    return NextResponse.json({
      success: true,
      data: enrichedUser,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId || userId !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }

    if (typeof body.college === 'string' && body.college.trim()) {
      updates.college = body.college.trim();
      updates.collegeDomain = 'manual_selection';
      // If college changes, we should also update district if provided
      if (typeof body.district === 'string') {
        updates.district = body.district.trim();
      }
    }

    if (typeof body.taskScope === 'string' && (body.taskScope === 'college' || body.taskScope === 'district')) {
      updates.taskScope = body.taskScope;
    }

    if (typeof body.avatarUrl === 'string') {
      const avatarUrl = body.avatarUrl.trim();
      if (avatarUrl && !/^https:\/\//.test(avatarUrl)) {
        return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
      }
      updates.avatarUrl = avatarUrl || null;
    }

    if (typeof body.description === 'string') {
      updates.description = body.description.trim().slice(0, 1000);
    }

    if (Array.isArray(body.showcaseUrls)) {
      updates.showcaseUrls = body.showcaseUrls
        .filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u))
        .slice(0, 10);
    }

    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive;
    }

    if (typeof body.isPublicProfile === 'boolean') {
      updates.isPublicProfile = body.isPublicProfile;
    }

    if (typeof body.pushNotificationsEnabled === 'boolean') {
      updates.pushNotificationsEnabled = body.pushNotificationsEnabled;
    }

    if (typeof body.assignmentAlertsEnabled === 'boolean') {
      updates.assignmentAlertsEnabled = body.assignmentAlertsEnabled;
    }
    
    if (typeof body.role === 'string' && (body.role === 'poster' || body.role === 'writer')) {
      updates.role = body.role;
    }


    const { data, error } = await supabase
      .from('User')
      .update(updates)
      .eq('clerkId', id)
      .select(`
        id,
        name,
        role,
        clerkId,
        email,
        walletBalance,
        college,
        avatarUrl,
        idCardUrl,
        description,
        showcaseUrls,
        isVerified,
        isActive,
        isPublicProfile,
        totalCompleted,
        trustScore,
        avgRatingRecvd,
        referralCode,
        referredById,
        taskScope,
        district,
        promoBalance,
        earnedBalance
      `)
      .single();

    if (error || !data) {
      console.error('Update User Error:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Sync role to Clerk if updated
    if (updates.role) {
      try {
        await (await clerkClient()).users.updateUser(id, {
          unsafeMetadata: {
            ...((await (await clerkClient()).users.getUser(id)).unsafeMetadata || {}),
            role: updates.role
          }
        });
      } catch (clerkErr) {
        console.error('Clerk Role Sync Error:', clerkErr);
        // We don't fail the whole request because Supabase is already updated
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
