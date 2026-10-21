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

export async function GET(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Run all queries in parallel
    const [
      usersRes,
      totalTasksRes,
      pendingTasksRes, // OPEN
      writingTasksRes, // IN_PROGRESS
      submittedTasksRes, // SUBMITTED
      completedTasksRes, // COMPLETED
      pendingDepositsRes,
      pendingWithdrawalsRes,
      revenueRes,
    ] = await Promise.all([
      supabase.from('User').select('id', { count: 'exact', head: true }),
      supabase.from('Task').select('id', { count: 'exact', head: true }),
      supabase.from('Task').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
      supabase.from('Task').select('id', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
      supabase.from('Task').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      supabase.from('Task').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      supabase.from('DepositRequest').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('WithdrawRequest').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('Task').select('platformFee').not('platformFee', 'is', null),
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((sum: number, t: any) => sum + (Number(t.platformFee) || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: usersRes.count || 0,
        totalTasks: totalTasksRes.count || 0,
        pendingTasks: pendingTasksRes.count || 0,
        writingTasks: writingTasksRes.count || 0,
        submittedTasks: submittedTasksRes.count || 0,
        completedTasks: completedTasksRes.count || 0,
        pendingDeposits: pendingDepositsRes.count || 0,
        pendingWithdrawals: pendingWithdrawalsRes.count || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        activeTasks: (pendingTasksRes.count || 0) + (writingTasksRes.count || 0) + (submittedTasksRes.count || 0),
      }
    });
  } catch (error: any) {
    console.error('Admin Stats GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
