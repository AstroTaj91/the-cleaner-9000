import { NextResponse } from 'next/server';
import { getDispatchByJobId, upsertDispatch } from '@/lib/dispatch-store';
import { executeDispatchStep } from '@/lib/dispatch-fsm';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSms } from '@/lib/twilio';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { action, job_id, cleaner_phone, cleaner_name } = payload;

    if (!job_id) {
      return NextResponse.json({ error: 'Job ID is required.' }, { status: 400 });
    }

    const run = await getDispatchByJobId(job_id);
    if (!run) {
      return NextResponse.json({ error: 'Active dispatch run not found.' }, { status: 404 });
    }

    if (action === 'simulate_timeout') {
      if (run.status !== 'AWAITING_RESPONSE') {
        return NextResponse.json({ error: `Cannot trigger timeout from state: ${run.status}` }, { status: 400 });
      }

      console.info(`[FSM SIMULATION] Manual timeout triggered for Job ${job_id}. Current attempt: ${run.attempts}`);
      
      if (run.attempts < 3) {
        await executeDispatchStep(job_id, run.attempts + 1);
      } else {
        run.status = 'ALERT_OPERATOR';
        await upsertDispatch(run);
      }

      const updated = await getDispatchByJobId(job_id);
      return NextResponse.json({
        success: true,
        message: 'Timeout simulation executed successfully.',
        dispatch: updated
      });
    }

    if (action === 'simulate_claim') {
      if (run.status !== 'AWAITING_RESPONSE') {
        return NextResponse.json({ error: `Cannot claim job from state: ${run.status}` }, { status: 400 });
      }

      const phone = cleaner_phone || '+19055550191';
      const name = cleaner_name || 'Alice Green';

      console.info(`[FSM SIMULATION] Manual cleaner claim triggered for Job ${job_id} by ${name} (${phone})`);

      // 1. Transition to ASSIGNED
      run.status = 'ASSIGNED';
      run.assigned_contractor_id = `cleaner_mock_${Math.random().toString(36).substring(5)}`;
      run.assigned_contractor_name = name;
      run.assigned_contractor_phone = phone;
      await upsertDispatch(run);

      // 2. Perform DB assignment if Supabase is connected
      if (supabaseAdmin) {
        try {
          // Attempt to find actual contractor by phone
          const { data: contractor } = await supabaseAdmin
            .from('contractors')
            .select('id, name')
            .eq('phone', phone)
            .maybeSingle();

          const contractorId = contractor?.id;
          
          if (contractorId) {
            run.assigned_contractor_id = contractorId;
            run.assigned_contractor_name = contractor.name;
            await upsertDispatch(run);

            // Execute atomic db transaction to assign contractor
            const { error: claimError } = await supabaseAdmin
              .from('jobs')
              .update({
                contractor_id: contractorId,
                status: 'assigned'
              })
              .eq('id', job_id);

            if (claimError) {
              console.error('Failed to update job assignment in Supabase:', claimError.message);
            }
          }
        } catch (dbErr) {
          console.error('DB assignment query failed:', dbErr);
        }
      }

      // 3. Compile confirmation SMS strings
      const cleanerMsg = `You got it! ${run.customer_name} at ${run.address}, ${run.city}. ${new Date(run.appointment_time).toLocaleDateString()} at ${new Date(run.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. $${run.wholesale_price} payout on completion. Reply HELP for details.`;
      const customerMsg = `Your cleaning is confirmed for ${new Date(run.appointment_time).toLocaleDateString()} at ${new Date(run.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Your cleaner will arrive on time. Reply STOP to cancel (24hr notice required).`;

      // 4. Send Confirmation messages
      await sendSms(phone, cleanerMsg);
      await sendSms(run.customer_phone, customerMsg);

      // 5. Transition to CONFIRMED
      run.status = 'CONFIRMED';
      await upsertDispatch(run);

      const updated = await getDispatchByJobId(job_id);
      return NextResponse.json({
        success: true,
        message: 'Claim simulation executed successfully.',
        dispatch: updated
      });
    }

    return NextResponse.json({ error: 'Unknown trigger action.' }, { status: 400 });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in dispatch/trigger API:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
