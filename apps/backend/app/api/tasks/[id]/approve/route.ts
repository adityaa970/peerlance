import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { sendPushNotifications } from '../../../../../lib/pushNotifications';
import { adjustBalances, roundMoney } from '../../../../../lib/wallet';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ success: false, error: 'User not found in DB' }, { status: 404 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const body = await req.json().catch(() => ({}));
    const rating = Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating as number : null;
    const feedback = typeof body.feedback === 'string' ? body.feedback.slice(0, 1000) : '';

    // Fetch the task
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select('posterId, workerId, status, id, workerPayout, title')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.posterId !== dbUser.id) {
      return NextResponse.json({ success: false, error: 'Only the poster can approve this assignment' }, { status: 403 });
    }

    // Only a task a writer is working on can be approved, and only once.
    if (!task.workerId || !['CLAIMED', 'IN_PROGRESS'].includes(task.status)) {
      return NextResponse.json({ success: false, error: 'This assignment cannot be approved in its current state' }, { status: 400 });
    }

    // Mark task COMPLETED. The status filter makes this a one-time transition, so a
    // repeated or concurrent request can't pay the writer twice.
    const { data: claimed, error: updateError } = await supabase
      .from('Task')
      .update({ status: 'COMPLETED', updatedAt: new Date().toISOString() })
      .eq('id', taskId)
      .eq('status', task.status)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }
    if (!claimed) {
      return NextResponse.json({ success: false, error: 'Assignment was already approved' }, { status: 409 });
    }

    if (task.workerId) {
      // Create rating if provided
      if (rating) {
        const { error: ratingInsertError } = await supabase.from('Rating').insert({
          id: randomUUID(),
          taskId: taskId,
          giverId: dbUser.id,
          receiverId: task.workerId,
          score: rating,
          comment: feedback,
          role: 'POSTER'
        });
        if (ratingInsertError) console.error("Failed to insert rating:", ratingInsertError);
      }

      // Calculate new completed and balance
      const { data: worker } = await supabase.from('User').select('id, name, totalCompleted, walletBalance, promoBalance, earnedBalance, referredById').eq('id', task.workerId).single();
      const newTotal = (worker?.totalCompleted || 0) + 1;
      const amountToAdd = task.workerPayout ? Number(task.workerPayout) : 0;

      await adjustBalances(supabase, task.workerId, { earnedBalance: amountToAdd, walletBalance: amountToAdd });

      const updatePayload: Record<string, number> = { totalCompleted: newTotal };

      if (rating) {
        const { data: ratingsData } = await supabase.from('Rating').select('score').eq('receiverId', task.workerId);
        if (ratingsData && ratingsData.length > 0) {
          const totalScore = ratingsData.reduce((acc, r) => acc + r.score, 0);
          updatePayload.avgRatingRecvd = totalScore / ratingsData.length;
        }
      }

      await supabase.from('User').update(updatePayload).eq('id', task.workerId);

      // Fetch poster data for referral check
      const { data: posterData } = await supabase.from('User').select('referredById, id, name').eq('id', task.posterId).single();

      // --- REFERRAL LOGIC ---
      if (worker?.referredById || posterData?.referredById) {
        try {
          const { data: settings } = await supabase
            .from('SystemSettings')
            .select('*')
            .eq('id', 'default')
            .single();

          const writerFirstBonus = settings?.writerFirstTaskBonus ?? 10;
          const writerCommRate = settings?.writerCommissionRate ?? 0.02;
          const posterFirstBonus = settings?.posterFirstTaskBonus ?? 10;
          const posterMilestoneBonus = settings?.posterMilestoneBonus ?? 40;
          const posterMileCount = settings?.posterMilestoneCount ?? 2;

          // WRITER (WORKER) REFERRAL
          if (worker?.referredById) {
            const commission = roundMoney(amountToAdd * writerCommRate);
            const isFirstTask = (worker?.totalCompleted || 0) === 0;
            const rewardAmount = isFirstTask ? writerFirstBonus + commission : commission;

            const { data: referrer } = await supabase.from('User').select('id').eq('id', worker.referredById).single();
            if (referrer && rewardAmount > 0) {
              await adjustBalances(supabase, worker.referredById, { earnedBalance: rewardAmount, walletBalance: rewardAmount });

              await supabase.from('Transaction').insert({
                id: randomUUID(),
                userId: worker.referredById,
                type: 'CREDIT',
                amount: rewardAmount,
                note: `Referral Commission from writer: ${worker.name || 'Writer'} (RefUserID:${worker.id})`
              });
            }
          }

          // POSTER REFERRAL
          if (posterData?.referredById) {
            // Check how many tasks this poster has COMPLETED in total
            const { count: posterTasksCount } = await supabase
              .from('Task')
              .select('*', { count: 'exact', head: true })
              .eq('posterId', task.posterId)
              .eq('status', 'COMPLETED');
              
            if (posterTasksCount === 1) { 
              const { data: referrer } = await supabase.from('User').select('id').eq('id', posterData.referredById).single();
              if (referrer) {
                let posterReward = posterFirstBonus;
                let logNote = `Referral Bonus (New Poster's First Task): ${posterData.name || 'Poster'}`;

                // Milestone check
                const { data: otherReferrals } = await supabase.from('User').select('id').eq('referredById', posterData.referredById);
                if (otherReferrals) {
                  const referralIds = otherReferrals.map(r => r.id);
                  const { data: completedReferrals } = await supabase.from('Task').select('posterId').in('posterId', referralIds).eq('status', 'COMPLETED');
                  const uniqueReferralsWithCompletion = new Set(completedReferrals?.map(t => t.posterId));
                  
                  if (uniqueReferralsWithCompletion.size > 0 && uniqueReferralsWithCompletion.size % posterMileCount === 0) {
                    posterReward += posterMilestoneBonus;
                    logNote += ` + Milestone Bonus (₹${posterMilestoneBonus})`;
                  }
                }

                await adjustBalances(supabase, posterData.referredById, { earnedBalance: posterReward, walletBalance: posterReward });

                await supabase.from('Transaction').insert({
                  id: randomUUID(),
                  userId: referrer.id,
                  type: 'CREDIT',
                  amount: posterReward,
                  note: `${logNote} (RefUserID:${posterData.id})`
                });
              }
            }
          }
        } catch (refErr) {
          console.error('Referral Processing Error:', refErr);
        }
      }


      // Create Transaction for worker
      await supabase.from('Transaction').insert({
        id: randomUUID(),
        userId: task.workerId,
        type: 'CREDIT',
        amount: amountToAdd,
        note: `Payout for: ${task.title}`
      });

      // Notify the writer that their work was approved
      const { data: writer } = await supabase
        .from('User')
        .select('pushToken, pushNotificationsEnabled')
        .eq('id', task.workerId)
        .single();

      if (writer?.pushToken && writer.pushNotificationsEnabled) {
        const payout = task.workerPayout ? Number(task.workerPayout) : 0;
        sendPushNotifications([writer.pushToken], {
          title: '🎉 Assignment Approved!',
          body: `You earned ₹${payout}. Check your wallet.`,
          data: { taskId: taskId },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Assignment approved and finished' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
