import { NextResponse } from 'next/server';
import { getDispatches, upsertDispatch } from '@/lib/dispatch-store';

export const dynamic = 'force-dynamic';
import { executeDispatchStep } from '@/lib/dispatch-fsm';

export async function GET() {
  try {
    const dispatches = await getDispatches();
    const now = new Date();
    const timeoutLimitMs = 15 * 60 * 1000; // 15 minutes
    let processedCount = 0;

    for (const run of dispatches) {
      if (run.status === 'AWAITING_RESPONSE') {
        const updatedAt = new Date(run.updated_at);
        const elapsedMs = now.getTime() - updatedAt.getTime();

        if (elapsedMs >= timeoutLimitMs) {
          console.info(`[Cron Dispatch Sweep] Job ${run.job_id} timed out after 15m in state AWAITING_RESPONSE. Attempt: ${run.attempts}`);
          if (run.attempts < 3) {
            await executeDispatchStep(run.job_id, run.attempts + 1);
          } else {
            run.status = 'ALERT_OPERATOR';
            await upsertDispatch(run);
            console.warn(`[Cron Dispatch Sweep Warning] Job ${run.job_id} exceeded maximum dispatch attempts. Operator alerted.`);
          }
          processedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: dispatches.length,
      processed: processedCount
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Error in dispatch-check cron route:', err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
