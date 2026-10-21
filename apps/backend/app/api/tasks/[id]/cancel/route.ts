import { NextResponse } from 'next/server';
import { adjustBalances } from '../../../../../lib/wallet';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    console.log('[CANCEL-ROUTE] Params id:', taskId);

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
    }

    // Fetch User
    const { data: dbUser, error: userError } = await supabase
      .from('User')
      .select('id, role, isActive')
      .eq('clerkId', clerkId)
      .single();

    if (userError || !dbUser) {
      console.log('[CANCEL-ROUTE] User Error:', userError, 'dbUser:', dbUser, 'clerkId:', clerkId);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Verify task is OPEN and user is Poster
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select('id, status, title, posterId, budget, platformFee')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.log('[CANCEL-ROUTE] Task Error:', taskError, 'task:', task, 'taskId:', taskId);
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.posterId !== dbUser.id) {
      return NextResponse.json({ success: false, error: 'You are not the poster of this task' }, { status: 403 });
    }

    if (task.status !== 'OPEN') {
      return NextResponse.json({ success: false, error: 'Task cannot be cancelled once claimed or active' }, { status: 400 });
    }

    // Begin updates: Mark task CANCELLED and REFUND poster
    const refundAmount = task.budget || 0;

    // 1. Mark task cancelled
    const { data: updatedTask, error: updateError } = await supabase
      .from('Task')
      .update({
        status: 'CANCELLED',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('status', 'OPEN') // Optimistic locking
      .select()
      .single();

    if (updateError || !updatedTask) {
      throw updateError || new Error('Failed to cancel task. Status may have changed.');
    }

    // 2. Refund User
    try {
      await adjustBalances(supabase, dbUser.id, { walletBalance: refundAmount });
    } catch (refundError) {
      console.error("Refund failed after task cancellation:", refundError);
      // Put the task back so the poster can retry instead of losing the money.
      await supabase.from('Task').update({ status: 'OPEN' }).eq('id', taskId).eq('status', 'CANCELLED');
      throw new Error('Refund failed. Please try again.');
    }

    // 3. Log Transaction
    await supabase.from('Transaction').insert({
      id: crypto.randomUUID(),
      userId: dbUser.id,
      type: 'CREDIT',
      amount: refundAmount,
      note: `Refund for task: ${task.title}`
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: any) {
    console.error('Error cancelling task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
