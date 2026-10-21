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

// GET - Fetch all versions
export async function GET() {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('version_code', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, versions: data });
  } catch (error: any) {
    console.error('Admin Versions GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new version
export async function POST(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { platform, version_code, version_name, changelog, is_mandatory, update_url } = body;

    const { data, error } = await supabase
      .from('app_versions')
      .insert([{
        platform,
        version_code: parseInt(version_code, 10),
        version_name,
        changelog: Array.isArray(changelog) ? changelog : changelog.split(',').map((s: string) => s.trim()),
        is_mandatory,
        update_url,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, version: data });
  } catch (error: any) {
    console.error('Admin Versions POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Update version
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    // Process changelog if it's a string
    if (updates.changelog && typeof updates.changelog === 'string') {
      updates.changelog = updates.changelog.split(',').map((s: string) => s.trim());
    }

    const { data, error } = await supabase
      .from('app_versions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, version: data });
  } catch (error: any) {
    console.error('Admin Versions PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove version
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    if (!clerkId || !(await isAdmin(clerkId))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('app_versions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin Versions DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
