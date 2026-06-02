import { supabaseAdmin } from '@/lib/supabase';
import { upsertDispatch, DispatchRun, getDispatches } from '@/lib/dispatch-store';
import { sendSms } from '@/lib/twilio';

// Seeding/fetching regional cleaners helper
export async function getRegionalCleaners(region: string): Promise<{ id: string; name: string; phone: string }[]> {
  const defaultCleaners = {
    west: [
      { name: "Alice Green", phone: "+19055550191" },
      { name: "Bob Smith", phone: "+19055550192" }
    ],
    north: [
      { name: "Charlie Brown", phone: "+19055550193" },
      { name: "David White", phone: "+19055550194" }
    ],
    east: [
      { name: "Emma Watson", phone: "+14165550195" },
      { name: "Fred Miller", phone: "+14165550196" }
    ],
    central: [
      { name: "Grace Hopper", phone: "+14165550197" },
      { name: "Henry Cavill", phone: "+14165550198" }
    ]
  };

  const regionalDefault = defaultCleaners[region as keyof typeof defaultCleaners] || defaultCleaners.west;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('contractors')
        .select('id, name, phone')
        .eq('gta_region', region)
        .eq('active', true);

      if (!error && data && data.length > 0) {
        return data;
      }

      // If contractors table is empty, seed it for regional matching
      const insertData = regionalDefault.map(c => ({
        name: c.name,
        phone: c.phone,
        gta_region: region,
        rating: 5.0,
        active: true,
        background_check_passed: true
      }));

      const { data: seeded, error: seedError } = await supabaseAdmin
        .from('contractors')
        .insert(insertData)
        .select('id, name, phone');

      if (!seedError && seeded && seeded.length > 0) {
        return seeded;
      }
    } catch (err) {
      console.error('Failed to seed contractors table:', err);
    }
  }

  // Fallback mock regional cleaner list
  return regionalDefault.map((c, i) => ({
    id: `cleaner_${region}_${i}`,
    name: c.name,
    phone: c.phone
  }));
}

// FSM Dispatch execution runner
export async function executeDispatchStep(jobId: string, attempt: number = 1) {
  const currentDispatches = await getDispatches() as DispatchRun[];
  const run = currentDispatches.find(d => d.job_id === jobId);
  if (!run) return;

  // Stop FSM if cleaner is already assigned
  if (run.status === 'ASSIGNED' || run.status === 'CONFIRMED') {
    return;
  }

  try {
    // 1. Transition to DISPATCH_BROADCAST
    run.status = 'DISPATCH_BROADCAST';
    run.attempts = attempt;
    await upsertDispatch(run);

    // 2. Query regional cleaners
    const cleaners = await getRegionalCleaners(run.region);
    
    // 3. Compile SMS template
    const formattedDate = new Date(run.appointment_time).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const formattedTime = new Date(run.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const smsBody = `🧹 Job Available! ${run.beds} Bed / ${run.baths} Bath in ${run.city}. Date: ${formattedDate} at ${formattedTime}. Payout: $${run.wholesale_price}. Reply YES to claim. First reply wins.`;

    // 4. Send Twilio SMS broadcast
    for (const cleaner of cleaners) {
      await sendSms(cleaner.phone, smsBody);
    }

    // 5. Transition to AWAITING_RESPONSE
    run.status = 'AWAITING_RESPONSE';
    await upsertDispatch(run);

    // [PRODUCTION NOTE]
    // Memory-based setTimeout is removed to make the code compatible with Vercel serverless functions.
    // Timeout events (15 minutes) are checked and executed durably via the Vercel Cron sweep at `/api/cron/dispatch-check`.
    console.info(`[FSM Dispatch Broadcast] Initialized broadcast attempt ${attempt} for Job ${jobId}. Awaiting cleaner reply.`);

  } catch (err) {
    console.error(`Error in dispatch step for Job ${jobId}:`, err);
    run.status = 'ALERT_OPERATOR';
    await upsertDispatch(run);
  }
}
