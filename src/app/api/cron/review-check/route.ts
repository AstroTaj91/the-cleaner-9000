import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { sendSms } from '@/lib/twilio';

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: true, message: 'Supabase not connected. Skipping cron sweep.' });
  }

  try {
    // Sweep review requests table for pending records
    const { data: pendingRequests, error } = await supabaseAdmin
      .from('review_requests')
      .select(`
        id,
        job_id,
        status,
        created_at,
        jobs (
          city,
          customers (
            name,
            phone
          )
        )
      `)
      .eq('status', 'pending');

    if (error) throw error;

    if (!pendingRequests || pendingRequests.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No pending review requests.' });
    }

    const now = new Date();
    const delayLimitMs = 30 * 60 * 1000; // 30 minutes
    let processedCount = 0;

    interface CustomerJoin {
      name: string;
      phone: string;
    }
    interface JobJoin {
      city: string;
      customers?: CustomerJoin | null;
    }
    interface ReviewRequestRow {
      id: string;
      job_id: string;
      status: string;
      created_at: string;
      jobs?: JobJoin | null;
    }

    for (const request of (pendingRequests as unknown as ReviewRequestRow[])) {
      const createdAt = new Date(request.created_at);
      const elapsedMs = now.getTime() - createdAt.getTime();

      if (elapsedMs >= delayLimitMs) {
        const job = request.jobs;
        const cust = job?.customers;

        const cityName = job?.city || 'Oakville';
        const customerName = cust?.name || 'Valued Customer';
        const customerPhone = cust?.phone;

        if (!customerPhone) {
          console.warn(`[Cron Review Sweep Warning] Skipping review request ${request.id} because customer phone number is missing.`);
          // Mark as failed to prevent re-sweeping
          await supabaseAdmin
            .from('review_requests')
            .update({ status: 'failed' })
            .eq('id', request.id);
          continue;
        }

        const gbpName = `${cityName} House Cleaning Services`;
        const gbpReviewLink = `https://g.page/r/${cityName.toLowerCase()}-cleaning-mock/review`;
        const smsBody = `Hi ${customerName}! Thank you for choosing ${gbpName}. We hope your home is sparkling clean! If you have 60 seconds, we'd love a 5-star Google review — it means the world to us. When you write it, mentioning '${cityName} house cleaning' helps other families find us. Here's the link: ${gbpReviewLink}. Thank you! 🙏`;

        console.info(`[Cron Review Sweep] Sending coached review SMS to ${customerName} (${customerPhone}) for Job ${request.job_id}.`);
        
        const result = await sendSms(customerPhone, smsBody);
        
        await supabaseAdmin
          .from('review_requests')
          .update({
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : null
          })
          .eq('id', request.id);

        processedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingRequests.length,
      processed: processedCount
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Error in review-check cron route:', err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
