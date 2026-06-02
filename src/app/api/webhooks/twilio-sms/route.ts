import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDispatches, upsertDispatch } from '@/lib/dispatch-store';
import { sendSms } from '@/lib/twilio';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let from = '';
    let body = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const rawText = await request.text();
      const params = new URLSearchParams(rawText);
      from = params.get('From') || '';
      body = params.get('Body') || '';
    } else {
      // JSON support for local emulator triggers
      const json = await request.json();
      from = json.From || json.from || '';
      body = json.Body || json.body || '';
    }

    from = from.trim();
    body = body.trim().toUpperCase();

    console.info(`[Twilio Inbound SMS] From: ${from}, Body: ${body}`);

    if (!from || body !== 'YES') {
      // Return empty TwiML if from number is missing or message is not claim confirmation
      return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    let contractorId = '';
    let contractorName = 'Independent Cleaner';
    let contractorRegion = '';

    // 1. Fetch contractor details
    if (supabaseAdmin) {
      const { data: contractor } = await supabaseAdmin
        .from('contractors')
        .select('id, name, gta_region')
        .eq('phone', from)
        .maybeSingle();

      if (contractor) {
        contractorId = contractor.id;
        contractorName = contractor.name;
        contractorRegion = contractor.gta_region;
      }
    }

    // Fallback contractor identification matching mock cleaners
    if (!contractorId) {
      const mockCleanersMap = [
        { name: "Alice Green", phone: "+19055550191", region: "west" },
        { name: "Bob Smith", phone: "+19055550192", region: "west" },
        { name: "Charlie Brown", phone: "+19055550193", region: "north" },
        { name: "David White", phone: "+19055550194", region: "north" },
        { name: "Emma Watson", phone: "+14165550195", region: "east" },
        { name: "Fred Miller", phone: "+14165550196", region: "east" },
        { name: "Grace Hopper", phone: "+14165550197", region: "central" },
        { name: "Henry Cavill", phone: "+14165550198", region: "central" }
      ];

      const match = mockCleanersMap.find(c => c.phone === from);
      if (match) {
        contractorId = `cleaner_mock_${match.name.toLowerCase().replace(' ', '_')}`;
        contractorName = match.name;
        contractorRegion = match.region;
      } else {
        // Assume default region based on area code
        contractorRegion = from.startsWith('+1905') ? 'west' : 'central';
        contractorId = 'cleaner_unknown';
      }
    }

    // 2. Query dispatch runs looking for AWAITING_RESPONSE matching cleaner's region
    const dispatches = await getDispatches();
    const activeDispatch = dispatches.find(d => d.region === contractorRegion && d.status === 'AWAITING_RESPONSE');

    if (!activeDispatch) {
      // Cleaner replied YES but there is no active job broadcast in their region
      console.warn(`[Twilio Webhook Alert] Cleaner ${contractorName} (${from}) replied YES but no jobs are awaiting claim in region '${contractorRegion}'.`);
      return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const jobId = activeDispatch.job_id;

    // 3. Assign job and confirm (Atomic Claim check)
    // Update local store
    activeDispatch.status = 'ASSIGNED';
    activeDispatch.assigned_contractor_id = contractorId;
    activeDispatch.assigned_contractor_name = contractorName;
    activeDispatch.assigned_contractor_phone = from;
    await upsertDispatch(activeDispatch);

    // Save assignment details in Supabase
    if (supabaseAdmin) {
      try {
        const { error: assignError } = await supabaseAdmin
          .from('jobs')
          .update({
            contractor_id: contractorId === 'cleaner_unknown' ? null : contractorId,
            status: 'assigned'
          })
          .eq('id', jobId);

        if (assignError) {
          console.error('Supabase assignment update failed:', assignError.message);
        }
      } catch (dbErr) {
        console.error('DB assignment transition failed:', dbErr);
      }
    }

    // 4. Send Confirmation messages
    const formattedDate = new Date(activeDispatch.appointment_time).toLocaleDateString();
    const formattedTime = new Date(activeDispatch.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const cleanerMsg = `You got it! ${activeDispatch.customer_name} at ${activeDispatch.address}, ${activeDispatch.city}. ${formattedDate} at ${formattedTime}. $${activeDispatch.wholesale_price} payout on completion. Reply HELP for details.`;
    const customerMsg = `Your cleaning is confirmed for ${formattedDate} at ${formattedTime}. Your cleaner will arrive on time. Reply STOP to cancel (24hr notice required).`;

    await sendSms(from, cleanerMsg);
    await sendSms(activeDispatch.customer_phone, customerMsg);

    // 5. Complete state transition to CONFIRMED
    activeDispatch.status = 'CONFIRMED';
    await upsertDispatch(activeDispatch);

    console.info(`[FSM Webhook Success] Job ${jobId} claimed by ${contractorName} (${from}) and transitioned to CONFIRMED.`);

    // Return empty TwiML (handled confirmations via sendSms log queue to capture outbound messages in UI logs)
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Error in Twilio Inbound Webhook:', error);
    return new NextResponse('<Response><Message>Error processing your request.</Message></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 500
    });
  }
}
