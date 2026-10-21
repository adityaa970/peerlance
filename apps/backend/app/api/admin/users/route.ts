import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function isAdmin(clerkId: string) {
  const { data: user } = await supabase
    .from('User')
    .select('role, email')
    .eq('clerkId', clerkId)
    .single();
  return user?.role === 'admin' || user?.email === 'adityak.writer@gmail.com';
}

// GET - Fetch all users
export async function GET(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const filter = url.searchParams.get('filter') || 'all';

    let query = supabase
      .from('User')
      .select('id, clerkId, name, email, role, college, walletBalance, isVerified, isActive, isPublicProfile, trustScore, totalCompleted, avatarUrl, idCardUrl, createdAt, pushNotificationsEnabled')
      .order('createdAt', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,college.ilike.%${search}%`);
    }

    // Apply Filters
    if (filter === 'poster') query = query.eq('role', 'poster');
    else if (filter === 'writer') query = query.eq('role', 'writer');
    else if (filter === 'admin') query = query.eq('role', 'admin');
    else if (filter === 'verified') query = query.eq('isVerified', true);
    else if (filter === 'banned') query = query.eq('isActive', false);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, users: data });
  } catch (error: any) {
    console.error('Admin Users GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Update user (ban/unban, activate/deactivate, change role)
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action, value } = body;

    if (!userId || !action) {
      return NextResponse.json({ success: false, error: 'userId and action are required' }, { status: 400 });
    }

    let updateData: any = { updatedAt: new Date().toISOString() };

    switch (action) {
      case 'toggleActive':
        updateData.isActive = !!value;
        break;
      case 'toggleBan':
        // Setting isActive to false effectively bans the user
        updateData.isActive = !value; // value=true means "ban", so isActive=false
        break;
      case 'setRole':
        if (!['poster', 'writer', 'admin'].includes(value)) {
          return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
        }
        updateData.role = value;
        break;
      case 'adjustBalance':
        if (typeof value !== 'number') {
          return NextResponse.json({ success: false, error: 'Value must be a number' }, { status: 400 });
        }
        const { data: user } = await supabase.from('User').select('walletBalance').eq('id', userId).single();
        updateData.walletBalance = (user?.walletBalance || 0) + value;
        break;
      case 'resetAccount':
        // Wipe wallet balance and delete all history for a fresh start
        updateData.walletBalance = 0;
        updateData.isVerified = false;
        updateData.isActive = true; // reactivate if banned
        
        // Delete history in parallel
        await Promise.all([
          supabase.from('Transaction').delete().eq('userId', userId),
          supabase.from('DepositRequest').delete().eq('userId', userId)
        ]);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('User')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, email, isActive, role, walletBalance')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, user: data });
  } catch (error: any) {
    console.error('Admin Users PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
