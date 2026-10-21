import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { notifyAdmins } from '@/lib/pushNotifications';
import { adjustBalances, InsufficientBalanceError, parseAmount } from '@/lib/wallet';

const MIN_WITHDRAWAL = 50; // matches the app

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
      .select('id, walletBalance, earnedBalance, name, isVerified, idCardUrl')
      .eq('clerkId', clerkId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { method, details } = body;
    const amount = parseAmount(body.amount);

    if (amount === null || amount < MIN_WITHDRAWAL) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    // Same rule as the app's withdraw screen: an ID card must be on file.
    if (!dbUser.isVerified && !dbUser.idCardUrl) {
      return NextResponse.json({ success: false, error: 'Please verify your college ID before withdrawing.' }, { status: 403 });
    }

    if ((dbUser.earnedBalance || 0) < amount) {
      return NextResponse.json({ success: false, error: 'Insufficient earned balance. You can only withdraw money earned from assignments or referrals.' }, { status: 400 });
    }

    if (!method || !['UPI', 'BANK'].includes(method)) {
      return NextResponse.json({ success: false, error: 'Invalid withdrawal method' }, { status: 400 });
    }

    if (!details || (typeof details !== 'string' && typeof details !== 'object') || JSON.stringify(details).length > 1000) {
      return NextResponse.json({ success: false, error: 'Withdrawal details are required' }, { status: 400 });
    }

    const requestId = randomUUID();

    // 1. Deduct from both sub and total balance (atomic; refuses to go below zero,
    //    so two simultaneous requests can't withdraw the same money twice)
    try {
      await adjustBalances(
        supabase,
        dbUser.id,
        { earnedBalance: -amount, walletBalance: -amount },
        { requireNonNegative: true }
      );
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json({ success: false, error: 'Insufficient earned balance.' }, { status: 400 });
      }
      throw err;
    }

    // 2. Create Withdrawal Request
    const { data, error: requestError } = await supabase
      .from('WithdrawRequest')
      .insert({
        id: requestId,
        userId: dbUser.id,
        amount,
        method,
        details,
        status: 'PENDING',
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (requestError) {
      // Rollback balance if request creation fails
      await adjustBalances(supabase, dbUser.id, { earnedBalance: amount, walletBalance: amount });
      throw requestError;
    }

    // 3. Log Transaction
    await supabase.from('Transaction').insert({
      id: randomUUID(),
      userId: dbUser.id,
      type: 'DEBIT',
      amount,
      note: `Withdrawal Request (${method}): ${requestId}`,
      createdAt: new Date().toISOString()
    });

    // 4. Notify admins
    notifyAdmins({
      title: '💸 New Withdrawal Request',
      body: `${dbUser.name} requested ₹${amount} via ${method}. Check dashboard to process.`,
      data: { type: 'withdrawal', amount, requestId }
    }).catch(err => console.error('Admin notification failed:', err));

    return NextResponse.json({ 
      success: true, 
      message: 'Withdrawal request submitted successfully.',
      withdrawal: data 
    });
  } catch (error: any) {
    console.error('Withdrawal error:', error);
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
      .from('WithdrawRequest')
      .select('*')
      .eq('userId', dbUser.id)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, withdrawals: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
