import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function isAdmin(clerkId: string) {
  const { data } = await supabase
    .from('User')
    .select('role')
    .eq('clerkId', clerkId)
    .single();
  return data?.role === 'admin';
}

export async function GET() {
  try {
    const session = await auth();
    if (!session.userId || !(await isAdmin(session.userId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await supabase
      .from('SystemSettings')
      .select('*')
      .eq('id', 'default')
      .single();

    return NextResponse.json({ success: true, settings: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session.userId || !(await isAdmin(session.userId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { data, error } = await supabase
      .from('SystemSettings')
      .upsert({
        id: 'default',
        ...body,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settings: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
