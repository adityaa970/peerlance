import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
    }

    // Fetch Task
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Fetch Poster
    const { data: poster, error: posterError } = await supabase
      .from('User')
      .select('id, name, avatarUrl, trustScore, avgRatingRecvd')
      .eq('id', task.posterId)
      .single();

    if (posterError) {
      console.error('Error fetching poster:', posterError);
    }

    const { count: totalPostedCount } = await supabase
      .from('Task')
      .select('*', { count: 'exact', head: true })
      .eq('posterId', task.posterId);

    // Fetch Worker if exists
    let worker = null;
    if (task.workerId) {
      const { data: w, error: workerError } = await supabase
        .from('User')
        .select('id, name, avatarUrl, trustScore, avgRatingRecvd, totalCompleted')
        .eq('id', task.workerId)
        .single();
      if (workerError) {
        console.error('Error fetching worker:', workerError);
      }
      worker = w;
    }

    // Map Tasks to the frontend structure
    const titleParts = task.title ? task.title.split(' pages of ') : [];
    const pages = titleParts.length === 2 ? parseInt(titleParts[0]) : 1;
    const subject = titleParts.length === 2 ? titleParts[1] : (task.title || 'GENERAL');
    
    // Use the values stored in the database instead of re-calculating
    const totalCost = task.budget || 0;
    const platformFee = task.platformFee || 0;
    const writerEarns = task.workerPayout || (totalCost - platformFee);
    const ratePerPage = pages > 0 ? Math.round(totalCost / pages) : 0;
    
    // Formatting Dates safely
    const deadlineStr = task.deadline 
      ? new Date(task.deadline).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) 
      : 'No deadline';
      
    // Relative time formatting could go here, fallback to local string
    const postedAtStr = task.createdAt
      ? new Date(task.createdAt).toLocaleDateString()
      : 'Recently';

    let computedStatus = task.status || 'OPEN';
    if (task.completedAt && task.status !== 'COMPLETED') {
      // task.posterId is a DB id, userId is a Clerk id, so look up the viewer's DB id.
      const { data: viewer } = await supabase.from('User').select('id').eq('clerkId', userId).maybeSingle();
      computedStatus = (viewer?.id === task.posterId) ? 'NEEDS APPROVAL' : 'UNDER REVIEW';
    }

    const formattedTask = {
      id: task.id,
      subject: subject,
      pages: pages,
      ratePerPage: ratePerPage,
      totalCost: totalCost,
      platformFee: platformFee,
      writerEarns: writerEarns,
      deadline: deadlineStr,
      postedAt: postedAtStr,
      status: computedStatus,
      completedAt: task.completedAt || null,
      instructions: task.description || 'No specific instructions provided.',
      hasReference: !!task.proofPhotoUrl,
      images: task.proofPhotoUrl ? task.proofPhotoUrl.split(',') : [],
      college: task.college,
      poster: poster ? {
        id: poster.id,
        name: poster.name || 'User',
        avatarUrl: poster.avatarUrl || null,
        avatarInitial: poster.name ? poster.name[0].toUpperCase() : 'U',
        trustScore: poster.trustScore || 100,
        avgRating: poster.avgRatingRecvd || 5.0,
        totalPosted: totalPostedCount || 0,
      } : null,
      writer: worker ? {
        id: worker.id,
        name: worker.name || 'Worker',
        avatarUrl: worker.avatarUrl || null,
        avatarInitial: worker.name ? worker.name[0].toUpperCase() : 'W',
        trustScore: worker.trustScore || 100,
        avgRating: worker.avgRatingRecvd || 5.0,
        totalCompleted: worker.totalCompleted || 0,
      } : null,
    };

    return NextResponse.json({ success: true, task: formattedTask });
  } catch (error: any) {
    console.error('Error fetching task details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}