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

    // 1. Get current user ID
    const { data: dbUser } = await supabase
      .from('User')
      .select('id')
      .eq('clerkId', clerkId)
      .single();

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // 2. Fetch all referrals
    const { data: referrals, error: refError } = await supabase
      .from('User')
      .select('id, name, avatarUrl, role, createdAt, totalCompleted')
      .eq('referredById', dbUser.id)
      .order('createdAt', { ascending: false });

    if (refError) throw refError;

    // 3. Fetch all referral-related transactions to calculate contribution
    const { data: transactions } = await supabase
      .from('Transaction')
      .select('amount, note')
      .eq('userId', dbUser.id)
      .filter('note', 'ilike', '%RefUserID:%');

    // 4. Enrich referrals with statuses and contributions
    const enrichedReferrals = (referrals || []).map(ref => {
      // Calculate contribution from transaction notes
      const refContribution = (transactions || [])
        .filter(t => t.note.includes(`RefUserID:${ref.id}`))
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Determine status
      let status = 'Joined';
      if (ref.totalCompleted > 0) {
        status = 'Active';
      }

      return {
        ...ref,
        status,
        contribution: refContribution
      };
    });

    const totalEarned = enrichedReferrals.reduce((sum, r) => sum + r.contribution, 0);

    return NextResponse.json({
      success: true,
      referrals: enrichedReferrals,
      stats: {
        totalCount: enrichedReferrals.length,
        totalEarned
      }
    });

  } catch (error: any) {
    console.error('Referrals API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
