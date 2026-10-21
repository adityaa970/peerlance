import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
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

    // We verify the user exists
    const { data: dbUser } = await supabase.from('User').select('id').eq('clerkId', clerkId).single();
    if (!dbUser) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // Verify task existence and authorization (only poster or worker can chat)
    const { data: task, error: taskError } = await supabase.from('Task').select('posterId, workerId').eq('id', taskId).single();
    if (taskError || !task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    
    if (task.posterId !== dbUser.id && task.workerId !== dbUser.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: messages, error: messagesError } = await supabase
      .from('Message')
      .select('id, text, createdAt, senderId')
      .eq('taskId', taskId)
      .order('createdAt', { ascending: true });

    if (messagesError) {
      // If table doesn't exist yet, return an empty list gracefully
      if (messagesError.code === '42P01') {
        return NextResponse.json({ success: true, messages: [] });
      }
      throw messagesError;
    }

    const formattedMessages = messages.map(m => ({
      id: m.id,
      text: m.text,
      senderId: m.senderId,
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    return NextResponse.json({ success: true, messages: formattedMessages });
  } catch (error: any) {
    console.error('Fetch messages error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

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
    const body = await req.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Message cannot be empty' }, { status: 400 });
    }

    // Get sender DB id
    const { data: dbUser } = await supabase.from('User').select('id').eq('clerkId', clerkId).single();
    if (!dbUser) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // Validate if poster or worker
    const { data: task, error: taskError } = await supabase.from('Task').select('posterId, workerId').eq('id', taskId).single();
    if (taskError || !task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    
    if (task.posterId !== dbUser.id && task.workerId !== dbUser.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: message, error: messageError } = await supabase
      .from('Message')
      .insert({
        id: crypto.randomUUID(),
        taskId,
        senderId: dbUser.id,
        text: text.trim(),
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) throw messageError;

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        text: message.text,
        senderId: message.senderId,
        time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
