import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    
    if (query.length < 2) {
      return NextResponse.json({ colleges: [] });
    }

    const { data: colleges, error } = await supabase
      .from('colleges') // verify this
      .select('id, Name, State, District')
      .ilike('Name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Supabase fetch error:', error);
      return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json({ colleges });
  } catch (error: any) {
    console.error('Error fetching colleges:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
