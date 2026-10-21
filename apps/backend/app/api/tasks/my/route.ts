import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const role = url.searchParams.get('role'); // 'poster' or 'writer'

    // Fetch user 
    const { data: dbUser, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('clerkId', userId)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

      let query = supabase
      .from('Task')
      .select(`
        id,
        title,
        description,
        budget,
        platformFee,
        workerPayout,
        deadline,
        status,
        completedAt,
        posterId,
        workerId,
        Poster:User!Task_posterId_fkey(name, avatarUrl, avgRatingRecvd),
        Worker:User!Task_workerId_fkey(name, avatarUrl, avgRatingRecvd)
      `)
      .order('deadline', { ascending: true });

    if (role === 'writer') {
      query = query.eq('workerId', dbUser.id);
    } else {
      query = query.eq('posterId', dbUser.id);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      throw tasksError;
    }

    // Map tasks to frontend format
    const formattedTasks = tasks.map((t: any) => {
      // Parse "20 pages of PHYSICS" to get pages and subject ideally, or just return title
      const titleParts = t.title ? t.title.split(' pages of ') : [];
      const pages = titleParts.length === 2 ? parseInt(titleParts[0]) : 0;
      const subject = titleParts.length === 2 ? titleParts[1] : t.title;

      let computedStatus = t.status || 'OPEN';
      if (t.completedAt && t.status !== 'COMPLETED') {
        computedStatus = role === 'writer' ? 'UNDER REVIEW' : 'NEEDS APPROVAL';
      }

      let displayName = 'Student';
      let displayRating = 5.0;
      let displayAvatarUrl = null;

      if (role === 'writer') {
        // If viewing as Writer, show who POSTED it
        displayName = t.Poster?.name || 'Student';
        displayRating = t.Poster?.avgRatingRecvd || 5.0;
        displayAvatarUrl = t.Poster?.avatarUrl || null;
      } else {
        // If viewing as Poster, show the Assigned Writer (if claimed)
        if (t.workerId && t.Worker) {
          displayName = t.Worker.name || 'Assigned Writer';
          displayRating = t.Worker.avgRatingRecvd || 5.0;
          displayAvatarUrl = t.Worker.avatarUrl || null;
        } else {
          // Task hasn't been claimed yet
          displayName = 'Pending Writer';
          displayRating = 0.0;
        }
      }

      return {
        id: t.id,
        subject: subject || 'OTHER',
        pages: pages || 1,
        ratePerPage: t.budget && pages ? Math.round(t.budget / pages) : t.budget,
        totalCost: t.budget || 0,
        writerEarns: t.workerPayout ?? ((t.budget || 0) - (t.platformFee || 0)),
        deadline: new Date(t.deadline).toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
        }),
        instructions: t.description,
        posterName: displayName,
        posterRating: parseFloat(Number(displayRating).toFixed(1)),
        posterAvatarUrl: displayAvatarUrl,
        status: computedStatus,
        completedAt: t.completedAt
      };
    });

    return NextResponse.json({ success: true, tasks: formattedTasks });
  } catch (error: any) {
    console.error('Error fetching my tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
