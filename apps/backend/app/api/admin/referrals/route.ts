import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    
    if (!clerkId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('User')
      .select('role')
      .eq('clerkId', clerkId)
      .single();

    if (adminError || adminUser?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch all users who have a referrer
    const { data: referrals, error: refError } = await supabase
      .from('User')
      .select(`
        id,
        name,
        email,
        role,
        createdAt,
        totalCompleted,
        college,
        referredBy:User!User_referredById_fkey (
          id,
          name,
          email,
          referralCode
        )
      `)
      .not('referredById', 'is', null)
      .order('createdAt', { ascending: false });

    if (refError) throw refError;

    // 3. For each referral, find the total bonus paid to the referrer
    const enrichedReferrals = await Promise.all((referrals || []).map(async (ref) => {
      // Find all credit transactions for the referrer that mention this specific referred user
      const referrer = Array.isArray(ref.referredBy) ? ref.referredBy[0] : ref.referredBy;
      const { data: txs } = await supabase
        .from('Transaction')
        .select('amount, note')
        .eq('userId', referrer?.id)
        .ilike('note', `%RefUserID:${ref.id}%`);

      const totalBonusPaid = (txs || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);

      return {
        ...ref,
        bonusPaid: totalBonusPaid,
        status: ref.totalCompleted > 0 ? 'Active' : 'Joined'
      };
    }));

    return NextResponse.json({
      success: true,
      referrals: enrichedReferrals
    });

  } catch (error: any) {
    console.error('Admin Referrals API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
