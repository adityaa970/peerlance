import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotifications } from '@/lib/pushNotifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: caller } = await supabase
      .from('User')
      .select('id, role')
      .eq('clerkId', clerkId)
      .maybeSingle();

    if (!caller) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { userId: requestedUserId, title, body } = await req.json().catch(() => ({}));
    const isAdmin = caller.role === 'admin';

    // Regular users can only send a test to themselves, with the default text.
    // Admins can target any user and set the text.
    if (!isAdmin && requestedUserId && requestedUserId !== caller.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = isAdmin && requestedUserId ? requestedUserId : caller.id;

    // 1. Fetch user and their push token
    const { data: user, error } = await supabase
      .from('User')
      .select('pushToken, pushNotificationsEnabled')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.pushToken) {
      return NextResponse.json({ error: 'User has no push token registered' }, { status: 400 });
    }

    if (!user.pushNotificationsEnabled) {
      return NextResponse.json({ error: 'User has push notifications disabled in settings' }, { status: 400 });
    }

    // 2. Send the test notification
    await sendPushNotifications([user.pushToken], {
      title: (isAdmin && typeof title === 'string' && title.slice(0, 100)) || 'Peerlance Test',
      body: (isAdmin && typeof body === 'string' && body.slice(0, 300)) || 'Successfully received a test notification!',
      data: { test: true, timestamp: new Date().toISOString() }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test notification sent',
      toToken: `${user.pushToken.substring(0, 20)}...`
    });

  } catch (error: any) {
    console.error('Test notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
