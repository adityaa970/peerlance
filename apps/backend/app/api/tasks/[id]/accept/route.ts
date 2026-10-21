import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotifications } from '../../../../../lib/pushNotifications';

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
    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
    }

    // Fetch User
    const { data: dbUser, error: userError } = await supabase
      .from('User')
      .select('id, name, role, isActive')
      .eq('clerkId', clerkId)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Must be a verified writer to accept
    if (dbUser.role !== 'writer' || !dbUser.isActive) {
      return NextResponse.json({ success: false, error: 'Only active writers can accept tasks' }, { status: 403 });
    }

    // Verify task is OPEN
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select('id, status, posterId')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.status !== 'OPEN') {
      return NextResponse.json({ success: false, error: 'Task is no longer available' }, { status: 400 });
    }

    if (task.posterId === dbUser.id) {
      return NextResponse.json({ success: false, error: 'Cannot accept your own task' }, { status: 400 });
    }

    // Update Task to CLAIMED
    const { data: updatedTask, error: updateError } = await supabase
      .from('Task')
      .update({
        status: 'CLAIMED',
        workerId: dbUser.id,
        claimedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('status', 'OPEN') // Optimistic locking
      .select()
      .single();

    if (updateError || !updatedTask) {
      throw updateError || new Error('Failed to claim task. Someone else may have claimed it.');
    }

    // Notify the poster that a writer accepted
    const { data: poster } = await supabase
      .from('User')
      .select('pushToken, pushNotificationsEnabled, assignmentAlertsEnabled')
      .eq('id', task.posterId)
      .single();

    if (poster?.pushToken && poster.pushNotificationsEnabled && poster.assignmentAlertsEnabled) {
      sendPushNotifications([poster.pushToken], {
        title: 'Writer Accepted!',
        body: `${dbUser.name || 'A writer'} has picked up your assignment.`,
        data: { taskId: taskId },
      });
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: any) {
    console.error('Error accepting task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
