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

export async function POST(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Reset revenue by setting platformFee to 0 on all tasks
    const { error } = await supabase
      .from('Task')
      .update({ platformFee: 0 })
      .not('platformFee', 'is', null);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Revenue stats reset successfully' });
  } catch (error: any) {
    console.error('Admin Revenue Reset Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
