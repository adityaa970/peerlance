import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const college = searchParams.get('college');
    const district = searchParams.get('district');

    if (!college && !district) {
      return NextResponse.json({ success: false, error: 'College or District parameter required' }, { status: 400 });
    }

    let query = supabase
      .from('User')
      .select('id, clerkId, name, avatarUrl, role, college, district, isVerified, isActive, isPublicProfile, trustScore, totalCompleted, avgRatingRecvd, showcaseUrls, description')
      .eq('role', 'writer')
      .eq('isActive', true)
      .eq('isPublicProfile', true);

    if (college) {
      query = query.eq('college', college);
    } else if (district) {
      query = query.eq('district', district);
    }
    
    const { data: writers, error } = await query
      .order('trustScore', { ascending: false })
      .limit(10);

    if (error) throw error;

    const writersWithRating = writers.map((w: any) => ({
      ...w,
      avgRating: w.avgRatingRecvd ? w.avgRatingRecvd.toFixed(1) : null
    }));

    return NextResponse.json({ success: true, writers: writersWithRating });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
