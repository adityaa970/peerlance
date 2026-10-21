import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') || 'android';

    const { data: latestVersion, error } = await supabase
      .from('app_versions')
      .select('id, platform, version_code, version_name, changelog, is_mandatory, update_url, is_active, created_at')
      .eq('platform', platform)
      .eq('is_active', true)
      .order('version_code', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      throw error;
    }

    // Map back to camelCase for the API response to maintain consistency with mobile types
    const mappedVersion = latestVersion ? {
      id: latestVersion.id,
      platform: latestVersion.platform,
      versionCode: latestVersion.version_code,
      versionName: latestVersion.version_name,
      changelog: latestVersion.changelog,
      isMandatory: latestVersion.is_mandatory,
      updateUrl: latestVersion.update_url,
      isActive: latestVersion.is_active,
      createdAt: latestVersion.created_at
    } : null;

    return NextResponse.json({
      success: true,
      latestVersion: mappedVersion
    });

  } catch (error: any) {
    console.error('Latest Version API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
