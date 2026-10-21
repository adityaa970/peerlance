import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { adjustBalances } from '@/lib/wallet';
import { notifyUser } from '@/lib/pushNotifications';

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
      return NextResponse.json({ success: false, error: 'Unauthorized Admin' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('WithdrawRequest')
      .select('*, User(name, email)')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, requests: data });
  } catch (error: any) {
    console.error('Admin Withdrawals GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized Admin' }, { status: 403 });
    }

    const body = await req.json();
    const { requestId, status, adminNote } = body; // status: APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    // 1. Get the withdrawal request
    const { data: withdrawal, error: drawError } = await supabase
      .from('WithdrawRequest')
      .select('*')
      .eq('id', requestId)
      .single();

    if (drawError || !withdrawal) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Request already processed' }, { status: 400 });
    }

    // 2. Lock the request first so a double click can't refund twice.
    const { data: locked, error: lockError } = await supabase
      .from('WithdrawRequest')
      .update({
        status,
        adminNote: adminNote || null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (lockError) throw lockError;
    if (!locked) {
      return NextResponse.json({ success: false, error: 'Request already processed' }, { status: 400 });
    }

    if (status === 'REJECTED') {
      // 3. REFUND: the withdrawal took from both earned and total balance, so give back both.
      try {
        await adjustBalances(supabase, withdrawal.userId, { earnedBalance: withdrawal.amount, walletBalance: withdrawal.amount });
      } catch (balanceError) {
        await supabase.from('WithdrawRequest').update({ status: 'PENDING' }).eq('id', requestId);
        throw balanceError;
      }

      // 3. Create a Transaction record (Credit - Refund)
      await supabase.from('Transaction').insert({
        id: randomUUID(),
        userId: withdrawal.userId,
        type: 'CREDIT',
        amount: withdrawal.amount,
        note: `Withdrawal Rejected - Refunded to Wallet`,
        createdAt: new Date().toISOString()
      });
    }


    // 5. Notify the user
    const notificationPayload = status === 'APPROVED' 
      ? {
          title: '✅ Withdrawal Processed!',
          body: `₹${withdrawal.amount} has been sent via ${withdrawal.method}.`,
        }
      : {
          title: '❌ Withdrawal Rejected',
          body: `₹${withdrawal.amount} has been refunded to your wallet.${adminNote ? ` Reason: ${adminNote}` : ''}`,
        };

    notifyUser(withdrawal.userId, {
      ...notificationPayload,
      data: { type: 'withdrawal_update', requestId, status }
    }).catch(err => console.error('User notification failed:', err));

    return NextResponse.json({ 
      success: true, 
      message: `Withdrawal ${status.toLowerCase()} successfully` 
    });

  } catch (error: any) {
    console.error('Admin withdrawal patch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
