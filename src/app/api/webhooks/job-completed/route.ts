import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSms } from '@/lib/twilio';

interface CompletedJobPayload {
  job_id: string;
  immediate?: boolean;
}

export async function POST(request: Request) {
  try {
    const { job_id, immediate = false } = (await request.json()) as CompletedJobPayload;

    if (!job_id) {
      return NextResponse.json(
        { error: 'Job ID is required.' },
        { status: 400 }
      );
    }

    let customerName = 'Valued Customer';
    let customerPhone = '+14165550199'; // Default mock GTA number
    let cityName = 'Oakville';
    let gbpName = 'Oakville House Cleaning Services';
    let gbpReviewLink = 'https://g.page/r/oakville-cleaning-mock/review';
    let existingRequestCount = 0;

    // 1. Check database for existing requests (Frequency Cap Rule)
    if (supabaseAdmin) {
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('review_requests')
        .select('id, status')
        .eq('job_id', job_id);

      if (checkError) {
        throw new Error(`Database check failed: ${checkError.message}`);
      }

      existingRequestCount = existing?.length || 0;
    }

    if (existingRequestCount > 0) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Duplicate protection active: A review request already exists for this job.',
        job_id
      }, { status: 200 }); // Return 200 with skipped details as per webhook standard
    }

    // 2. Fetch Job, Customer, and GBP details
    if (supabaseAdmin) {
      // Fetch job and customer details
      const { data: job, error: jobError } = await supabaseAdmin
        .from('jobs')
        .select(`
          id,
          city,
          customers (
            name,
            phone
          )
        `)
        .eq('id', job_id)
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to find job metadata: ${jobError?.message || 'Not found'}`);
      }

      cityName = job.city || 'Oakville';
      
      // Safe casting since customers is a joined relation
      const cust = job.customers as { name?: string; phone?: string } | null;
      if (cust) {
        customerName = cust.name || 'Valued Customer';
        customerPhone = cust.phone || customerPhone;
      }

      // Fetch matching GBP listing based on city
      const { data: gbp, error: gbpError } = await supabaseAdmin
        .from('gbp_listings')
        .select('name, google_review_link')
        .eq('city', cityName)
        .limit(1);

      if (!gbpError && gbp && gbp.length > 0) {
        gbpName = gbp[0].name;
        gbpReviewLink = gbp[0].google_review_link;
      }
    } else {
      // Mock data details based on standard listing profiles
      const cityProfiles: Record<string, { gbpName: string; link: string }> = {
        Mississauga: {
          gbpName: 'Mississauga House Cleaning Services',
          link: 'https://g.page/r/mississauga-cleaning-mock/review'
        },
        Oakville: {
          gbpName: 'Oakville House Cleaning Services',
          link: 'https://g.page/r/oakville-cleaning-mock/review'
        },
        Brampton: {
          gbpName: 'Brampton House Cleaning Services',
          link: 'https://g.page/r/brampton-cleaning-mock/review'
        },
        Vaughan: {
          gbpName: 'Vaughan House Cleaning Services',
          link: 'https://g.page/r/vaughan-cleaning-mock/review'
        },
        Scarborough: {
          gbpName: 'Scarborough House Cleaning Services',
          link: 'https://g.page/r/scarborough-cleaning-mock/review'
        }
      };

      const profile = cityProfiles[cityName] || cityProfiles['Oakville'];
      gbpName = profile.gbpName;
      gbpReviewLink = profile.link;
    }

    // 3. Compile the exact coached SMS template from the skill
    const smsBody = `Hi ${customerName}! Thank you for choosing ${gbpName}. We hope your home is sparkling clean! If you have 60 seconds, we'd love a 5-star Google review — it means the world to us. When you write it, mentioning '${cityName} house cleaning' helps other families find us. Here's the link: ${gbpReviewLink}. Thank you! 🙏`;

    let reviewRequestId = 'mock_request_id';
    const initialStatus = 'pending';



    // Let's do a safe query in supabaseAdmin:
    let dbCustomerId = null;
    if (supabaseAdmin) {
      try {
        const { data: jobInfo } = await supabaseAdmin
          .from('jobs')
          .select('customer_id')
          .eq('id', job_id)
          .single();
        if (jobInfo) {
          dbCustomerId = jobInfo.customer_id;
        }
      } catch (e) {
        console.error('Failed to get customer_id for review_request insertion:', e);
      }
    }

    if (supabaseAdmin) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('review_requests')
        .insert({
          job_id,
          customer_id: dbCustomerId,
          status: initialStatus,
          sent_at: null
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to log review request: ${insertError.message}`);
      }
      reviewRequestId = inserted.id;
    }

    // Helper function to dispatch SMS and update status
    const dispatchSms = async () => {
      const result = await sendSms(customerPhone, smsBody);
      
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('review_requests')
          .update({
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : null
          })
          .eq('id', reviewRequestId);
      }
      
      return result;
    };

    // 5. Handle timing logic
    if (immediate) {
      // Trigger immediately for manual operator clicks/testing
      const smsResult = await dispatchSms();
      return NextResponse.json({
        success: true,
        skipped: false,
        immediate: true,
        status: smsResult.success ? 'sent' : 'failed',
        smsResult,
        smsBody,
        reviewRequestId
      });
    } else {
      // Non-immediate triggers:
      // [PRODUCTION NOTE]
      // Standard setTimeout timers are removed to remain Vercel serverless-safe.
      // Delay loops (30 minutes) are checked durably via Vercel Cron sweep at `/api/cron/review-check`.
      return NextResponse.json({
        success: true,
        skipped: false,
        immediate: false,
        status: 'scheduled',
        delayMinutes: 30,
        smsBody,
        reviewRequestId
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in job-completed webhook:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
