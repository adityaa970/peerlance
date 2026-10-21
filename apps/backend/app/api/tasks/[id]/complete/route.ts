import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotifications } from '../../../../../lib/pushNotifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: dbUser } = await supabase
      .from('User')
      .select('id')
      .eq('clerkId', clerkId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found in DB' }, { status: 404 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;

    // Check task bounds
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select('workerId, status, posterId')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.workerId !== dbUser.id) {
      return NextResponse.json({ success: false, error: 'Only the assigned worker can mark this complete' }, { status: 403 });
    }

    if (!['CLAIMED', 'IN_PROGRESS'].includes(task.status)) {
      return NextResponse.json({ success: false, error: 'This assignment cannot be submitted in its current state' }, { status: 400 });
    }

    // Set completedAt to signify it's pending review from Poster
    const { error: updateError } = await supabase
      .from('Task')
      .update({ completedAt: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      throw updateError;
    }

    // Notify the poster to review
    const { data: poster } = await supabase
      .from('User')
      .select('pushToken, pushNotificationsEnabled')
      .eq('id', task.posterId)
      .single();

    if (poster?.pushToken && poster.pushNotificationsEnabled) {
      sendPushNotifications([poster.pushToken], {
        title: 'Review Needed',
        body: 'Your assignment has been submitted for review.',
        data: { taskId: taskId },
      });
    }

    return NextResponse.json({ success: true, message: 'Task marked as completed' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
