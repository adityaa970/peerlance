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
  
  // You can add your own admin email here as a fallback
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
      .from('DepositRequest')
      .select('*, User(name, email)')
      .eq('status', 'PENDING')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, requests: data });
  } catch (error: any) {
    console.error('Admin Deposits GET Error:', error);
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
    const { depositId, status, adminNote } = body; // status: APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    // Get the deposit request
    const { data: deposit, error: depError } = await supabase
      .from('DepositRequest')
      .select('*')
      .eq('id', depositId)
      .single();

    if (depError || !deposit) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    if (deposit.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Request already processed' }, { status: 400 });
    }

    // 1. Lock the request first: only one admin action can move it out of PENDING,
    //    so a double click can't credit the deposit twice.
    const { data: locked, error: lockError } = await supabase
      .from('DepositRequest')
      .update({
        status,
        adminNote: adminNote || null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', depositId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (lockError) throw lockError;
    if (!locked) {
      return NextResponse.json({ success: false, error: 'Request already processed' }, { status: 400 });
    }

    if (status === 'APPROVED') {
      // 2. Credit the user's balance
      try {
        await adjustBalances(supabase, deposit.userId, { promoBalance: deposit.amount, walletBalance: deposit.amount });
      } catch (balanceError) {
        // Undo the lock so the admin can retry.
        await supabase.from('DepositRequest').update({ status: 'PENDING' }).eq('id', depositId);
        throw balanceError;
      }

      // 2. Create a Transaction record
      await supabase.from('Transaction').insert({
        id: randomUUID(),
        userId: deposit.userId,
        type: 'CREDIT',
        amount: deposit.amount,
        note: `Funds added via manual deposit${deposit.transactionId ? ` (ID: ${deposit.transactionId})` : ''}`
      });
    }


    // 4. Notify the user
    const notificationPayload = status === 'APPROVED' 
      ? {
          title: '✅ Deposit Approved!',
          body: `₹${deposit.amount} has been added to your wallet.`,
        }
      : {
          title: '❌ Deposit Rejected',
          body: adminNote ? `Reason: ${adminNote}` : 'Please contact support for more details.',
        };

    notifyUser(deposit.userId, {
      ...notificationPayload,
      data: { type: 'deposit_update', depositId, status }
    }).catch(err => console.error('User notification failed:', err));

    return NextResponse.json({ 
      success: true, 
      message: `Deposit ${status.toLowerCase()} successfully` 
    });

  } catch (error: any) {
    console.error('Admin deposit patch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
