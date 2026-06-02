import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

export interface DispatchRun {
  job_id: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  region: 'west' | 'north' | 'east' | 'central';
  beds: number;
  baths: number;
  is_deep_clean: boolean;
  retail_price: number;
  wholesale_price: number;
  appointment_time: string;
  address: string;
  status: 'BOOKING_CONFIRMED' | 'DISPATCH_BROADCAST' | 'AWAITING_RESPONSE' | 'ASSIGNED' | 'CONFIRMED' | 'ALERT_OPERATOR';
  attempts: number;
  assigned_contractor_id: string | null;
  assigned_contractor_name: string | null;
  assigned_contractor_phone: string | null;
  created_at: string;
  updated_at: string;
}

const STORE_PATH = path.join(process.cwd(), 'src/data/dispatches.json');

// Ensure directory and file exist (for file fallback)
function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify([]));
  }
}

// Local filesystem fallback functions
function getLocalDispatches(): DispatchRun[] {
  ensureStore();
  try {
    const data = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local dispatch store:', err);
    return [];
  }
}

function saveLocalDispatches(dispatches: DispatchRun[]) {
  ensureStore();
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(dispatches, null, 2));
  } catch (err) {
    console.error('Error writing local dispatch store:', err);
  }
}

// Production-ready database sync operations
export async function getDispatches(): Promise<DispatchRun[]> {
  if (!supabaseAdmin) {
    return getLocalDispatches();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('dispatches')
      .select(`
        job_id,
        status,
        attempts,
        assigned_contractor_id,
        assigned_contractor_name,
        assigned_contractor_phone,
        created_at,
        updated_at,
        jobs (
          appointment_time,
          address,
          city,
          beds,
          baths,
          is_deep_clean,
          retail_price,
          wholesale_price,
          gta_region,
          customers (
            name,
            phone
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data) return [];

    // Cast response safely and reconstruct DispatchRun interface
    interface DbDispatchRow {
      job_id: string;
      status: string;
      attempts: number;
      assigned_contractor_id: string | null;
      assigned_contractor_name: string | null;
      assigned_contractor_phone: string | null;
      created_at: string;
      updated_at: string;
      jobs?: {
        appointment_time: string;
        address: string;
        city: string;
        beds: number;
        baths: number;
        is_deep_clean: boolean;
        retail_price: number;
        wholesale_price: number;
        gta_region: string;
        customers?: {
          name: string;
          phone: string;
        } | null;
      } | null;
    }

    return (data as unknown as DbDispatchRow[]).map((row) => {
      const job = row.jobs;
      const cust = job?.customers;
      return {
        job_id: row.job_id,
        customer_name: cust?.name || 'Valued Customer',
        customer_phone: cust?.phone || '',
        city: job?.city || '',
        region: (job?.gta_region || 'central') as 'west' | 'north' | 'east' | 'central',
        beds: job?.beds || 1,
        baths: job?.baths || 1,
        is_deep_clean: job?.is_deep_clean || false,
        retail_price: Number(job?.retail_price || 0),
        wholesale_price: Number(job?.wholesale_price || 0),
        appointment_time: job?.appointment_time || row.created_at,
        address: job?.address || '',
        status: row.status as DispatchRun['status'],
        attempts: row.attempts,
        assigned_contractor_id: row.assigned_contractor_id,
        assigned_contractor_name: row.assigned_contractor_name,
        assigned_contractor_phone: row.assigned_contractor_phone,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });
  } catch (err) {
    console.error('Supabase query failed in getDispatches, falling back to local storage:', err);
    return getLocalDispatches();
  }
}

export async function getDispatchByJobId(jobId: string): Promise<DispatchRun | null> {
  if (!supabaseAdmin) {
    const list = getLocalDispatches();
    return list.find((d) => d.job_id === jobId) || null;
  }

  try {
    const list = await getDispatches();
    return list.find((d) => d.job_id === jobId) || null;
  } catch (err) {
    console.error(`Failed to fetch dispatch for job ${jobId}:`, err);
    return null;
  }
}

export async function upsertDispatch(run: DispatchRun): Promise<void> {
  if (!supabaseAdmin) {
    const dispatches = getLocalDispatches();
    const index = dispatches.findIndex((d) => d.job_id === run.job_id);
    if (index >= 0) {
      dispatches[index] = { ...run, updated_at: new Date().toISOString() };
    } else {
      dispatches.push(run);
    }
    saveLocalDispatches(dispatches);
    return;
  }

  try {
    // 1. Sync check: ensure job exists in public.jobs table.
    // If not in database, we cannot insert it due to foreign key references.
    const { data: jobExists } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('id', run.job_id)
      .maybeSingle();

    if (!jobExists) {
      console.warn(`[Supabase Sync Warning] Cannot save dispatch for Job ${run.job_id} because the job record does not exist in public.jobs. Falling back to local file store.`);
      // Save locally to maintain emulator functionality
      const dispatches = getLocalDispatches();
      const index = dispatches.findIndex((d) => d.job_id === run.job_id);
      if (index >= 0) {
        dispatches[index] = { ...run, updated_at: new Date().toISOString() };
      } else {
        dispatches.push(run);
      }
      saveLocalDispatches(dispatches);
      return;
    }

    // 2. Perform database upsert
    const { error } = await supabaseAdmin
      .from('dispatches')
      .upsert({
        job_id: run.job_id,
        status: run.status,
        attempts: run.attempts,
        assigned_contractor_id: run.assigned_contractor_id?.startsWith('cleaner_mock_') ? null : run.assigned_contractor_id,
        assigned_contractor_name: run.assigned_contractor_name,
        assigned_contractor_phone: run.assigned_contractor_phone,
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_id' });

    if (error) throw error;
  } catch (err) {
    console.error(`Failed to upsert dispatch for job ${run.job_id} into database:`, err);
    // Write local backup
    const dispatches = getLocalDispatches();
    const index = dispatches.findIndex((d) => d.job_id === run.job_id);
    if (index >= 0) {
      dispatches[index] = { ...run, updated_at: new Date().toISOString() };
    } else {
      dispatches.push(run);
    }
    saveLocalDispatches(dispatches);
  }
}

export async function clearAllLocalDispatches(): Promise<void> {
  saveLocalDispatches([]);
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from('dispatches').delete().neq('status', '');
      if (error) console.error('Failed to clear dispatches table:', error.message);
    } catch (err) {
      console.error('Database clear all dispatches error:', err);
    }
  }
}
