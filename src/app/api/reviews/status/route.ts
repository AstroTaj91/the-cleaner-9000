import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// High-fidelity mock logs of review requests for local preview
const MOCK_REVIEW_LOGS = [
  {
    id: "req_01JYYZ",
    job_id: "job_oak_101",
    customer_name: "Sarah Jenkins",
    customer_phone: "+19055550123",
    city: "Oakville",
    status: "sent",
    sms_sent_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    sms_body: "Hi Sarah! Thank you for choosing Oakville House Cleaning Services. We hope your home is sparkling clean! If you have 60 seconds, we'd love a 5-star Google review — it means the world to us. When you write it, mentioning 'Oakville house cleaning' helps other families find us. Here's the link: https://g.page/r/oakville-cleaning-mock/review. Thank you! 🙏"
  },
  {
    id: "req_02JYYZ",
    job_id: "job_mis_102",
    customer_name: "John Doe",
    customer_phone: "+14165550456",
    city: "Mississauga",
    status: "sent",
    sms_sent_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    sms_body: "Hi John! Thank you for choosing Mississauga House Cleaning Services. We hope your home is sparkling clean! If you have 60 seconds, we'd love a 5-star Google review — it means the world to us. When you write it, mentioning 'Mississauga house cleaning' helps other families find us. Here's the link: https://g.page/r/mississauga-cleaning-mock/review. Thank you! 🙏"
  },
  {
    id: "req_03JYYZ",
    job_id: "job_bra_103",
    customer_name: "Rajesh Patel",
    customer_phone: "+12895550789",
    city: "Brampton",
    status: "failed",
    sms_sent_at: null,
    sms_body: "Hi Rajesh! Thank you for choosing Brampton House Cleaning Services. We hope your home is sparkling clean! If you have 60 seconds, we'd love a 5-star Google review — it means the world to us. When you write it, mentioning 'Brampton house cleaning' helps other families find us. Here's the link: https://g.page/r/brampton-cleaning-mock/review. Thank you! 🙏"
  }
];

export async function GET() {
  try {
    const hasDb = !!supabaseAdmin;
    let reviewRequests = [...MOCK_REVIEW_LOGS];

    if (supabaseAdmin) {
      // Query review requests from database and join with job/customer
      const { data, error } = await supabaseAdmin
        .from('review_requests')
        .select(`
          id,
          job_id,
          status,
          sms_sent_at,
          created_at,
          jobs (
            city,
            customers (
              first_name,
              phone
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (data) {
        interface CustomerJoin {
          first_name?: string;
          phone?: string;
        }
        interface JobJoin {
          city?: string;
          customers?: CustomerJoin | null;
        }
        interface ReviewRequestJoinRow {
          id: string;
          job_id: string;
          status: string;
          sms_sent_at: string | null;
          created_at: string;
          jobs?: JobJoin | null;
        }

        reviewRequests = (data as unknown as ReviewRequestJoinRow[]).map((item) => {
          const jobData = item.jobs;
          const customerData = jobData?.customers;
          
          const city = jobData?.city || 'Oakville';
          const customerName = customerData?.first_name || 'Valued Customer';
          const customerPhone = customerData?.phone || '+14165550199';
          
          // Reconstruct the message body that was sent (or pending to send)
          const gbpName = `${city} House Cleaning Services`;
          const gbpReviewLink = `https://g.page/r/${city.toLowerCase()}-cleaning-mock/review`;
          const smsBody = `Hi ${customerName}! Thank you for choosing ${gbpName}. We hope your home is sparkling clean! If you have 60 seconds, we'd love a 5-star Google review — it means the world to us. When you write it, mentioning '${city} house cleaning' helps other families find us. Here's the link: ${gbpReviewLink}. Thank you! 🙏`;

          return {
            id: item.id,
            job_id: item.job_id,
            customer_name: customerName,
            customer_phone: customerPhone,
            city,
            status: item.status,
            sms_sent_at: item.sms_sent_at || item.created_at,
            sms_body: smsBody
          };
        });
      }
    }

    return NextResponse.json({
      success: true,
      persisted: hasDb,
      count: reviewRequests.length,
      requests: reviewRequests
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error fetching review requests:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
