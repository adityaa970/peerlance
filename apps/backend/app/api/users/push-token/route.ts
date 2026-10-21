import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { pushToken } = body;

    if (!pushToken || typeof pushToken !== 'string') {
      return NextResponse.json({ success: false, error: 'Push token is required' }, { status: 400 });
    }

    // Find user by clerkId
    const { data: dbUser, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('clerkId', clerkId)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Update push token
    const { error: updateError } = await supabase
      .from('User')
      .update({ pushToken, updatedAt: new Date().toISOString() })
      .eq('id', dbUser.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, message: 'Push token registered' });
  } catch (error: any) {
    console.error('Error registering push token:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
