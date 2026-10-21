import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Default fallback values if DB record is missing
const DEFAULTS = {
  writerFirstTaskBonus: 10,
  writerCommissionRate: 0.02,
  posterFirstTaskBonus: 10,
  posterMilestoneBonus: 40,
  posterMilestoneCount: 2
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('SystemSettings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      return NextResponse.json({ success: true, data: DEFAULTS });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, data: DEFAULTS });
  }
}
