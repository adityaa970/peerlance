import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { notifyAdmins } from '@/lib/pushNotifications';
import { parseAmount } from '@/lib/wallet';

const MAX_DEPOSIT = 100000;

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

    const { data: dbUser } = await supabase
      .from('User')
      .select('id, name')
      .eq('clerkId', clerkId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { screenshotUrl, transactionId } = body;
    const amount = parseAmount(body.amount);

    if (amount === null || amount > MAX_DEPOSIT) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    if (typeof screenshotUrl !== 'string' || !/^https:\/\//.test(screenshotUrl)) {
      return NextResponse.json({ success: false, error: 'Screenshot is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('DepositRequest')
      .insert({
        id: randomUUID(),
        userId: dbUser.id,
        amount,
        screenshotUrl,
        transactionId: typeof transactionId === 'string' ? transactionId.slice(0, 100) : null,
        status: 'PENDING',
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // 4. Notify admins
    notifyAdmins({
      title: '💰 New Deposit Request',
      body: `${dbUser.name} submitted a deposit of ₹${amount}. Check dashboard to verify.`,
      data: { type: 'deposit', amount, depositId: data.id }
    }).catch(err => console.error('Admin notification failed:', err));

    return NextResponse.json({ 
      success: true, 
      message: 'Deposit request submitted successfully. Waiting for admin approval.',
      deposit: data 
    });
  } catch (error: any) {
    console.error('Deposit error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
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
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('DepositRequest')
      .select('*')
      .eq('userId', dbUser.id)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, deposits: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
