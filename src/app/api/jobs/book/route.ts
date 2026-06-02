import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePrices, mapCityToRegion } from '@/lib/dispatch-utils';
import { upsertDispatch, DispatchRun } from '@/lib/dispatch-store';
import { executeDispatchStep } from '@/lib/dispatch-fsm';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const {
      customer_name,
      customer_phone,
      city,
      beds,
      baths,
      is_deep_clean,
      appointment_time,
      address,
      recurring_frequency = 'one-off'
    } = payload;

    if (!customer_name || !customer_phone || !city || !address || !appointment_time) {
      return NextResponse.json({ error: 'All fields are required to book a job.' }, { status: 400 });
    }

    const prices = calculatePrices(beds, baths, is_deep_clean);
    const region = mapCityToRegion(city);

    let jobId = `job_${Date.now()}`;
    let isDbPersisted = false;

    // Supabase DB insertion
    if (supabaseAdmin) {
      try {
        // Register or fetch customer
        let customerId;
        const { data: customer, error: customerError } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('phone', customer_phone)
          .maybeSingle();

        if (customerError) {
          console.warn('Customer query warning:', customerError.message);
        }

        if (customer) {
          customerId = customer.id;
        } else {
          const { data: newCustomer, error: insertCustomerError } = await supabaseAdmin
            .from('customers')
            .insert({ name: customer_name, phone: customer_phone })
            .select('id')
            .single();
          
          if (insertCustomerError || !newCustomer) {
            throw new Error(`Customer creation failed: ${insertCustomerError?.message}`);
          }
          customerId = newCustomer.id;
        }

        // Fetch or create regional GBP listing
        let gbpListingId;
        const { data: gbp, error: gbpError } = await supabaseAdmin
          .from('gbp_listings')
          .select('id')
          .eq('city', city)
          .limit(1);

        if (gbpError) {
          console.warn('GBP query warning:', gbpError.message);
        }

        if (gbp && gbp.length > 0) {
          gbpListingId = gbp[0].id;
        } else {
          const gbpName = `${city} House Cleaning Services`;
          const reviewLink = `https://g.page/r/${city.toLowerCase()}-cleaning-mock/review`;
          const { data: newGbp, error: insertGbpError } = await supabaseAdmin
            .from('gbp_listings')
            .insert({ name: gbpName, city, google_review_link: reviewLink })
            .select('id')
            .single();

          if (insertGbpError || !newGbp) {
            throw new Error(`GBP profile seeding failed: ${insertGbpError?.message}`);
          }
          gbpListingId = newGbp.id;
        }

        // Insert booking record into jobs table
        const { data: newJob, error: jobError } = await supabaseAdmin
          .from('jobs')
          .insert({
            customer_id: customerId,
            gbp_listing_id: gbpListingId,
            beds,
            baths,
            is_deep_clean,
            retail_price: prices.retail,
            wholesale_price: prices.wholesale,
            status: 'pending',
            gta_region: region,
            appointment_time,
            address,
            city,
            recurring_frequency
          })
          .select('id')
          .single();

        if (jobError || !newJob) {
          throw new Error(`Job creation failed: ${jobError?.message}`);
        }

        jobId = newJob.id;
        isDbPersisted = true;
      } catch (dbErr) {
        console.error('Supabase booking transaction failed, falling back to mock booking logs:', dbErr);
      }
    }

    // 4. Log the active FSM Dispatch entry
    const dispatchEntry: DispatchRun = {
      job_id: jobId,
      customer_name,
      customer_phone,
      city,
      region,
      beds,
      baths,
      is_deep_clean,
      retail_price: prices.retail,
      wholesale_price: prices.wholesale,
      appointment_time,
      address,
      status: 'BOOKING_CONFIRMED',
      attempts: 1,
      assigned_contractor_id: null,
      assigned_contractor_name: null,
      assigned_contractor_phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await upsertDispatch(dispatchEntry);

    // 5. Trigger FSM regional cleaner broadcasts asynchronously
    executeDispatchStep(jobId, 1).catch(err => {
      console.error('Async dispatch broadcast step failed:', err);
    });

    return NextResponse.json({
      success: true,
      job_id: jobId,
      db_persisted: isDbPersisted,
      prices,
      region,
      dispatch: dispatchEntry
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in jobs/book route:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
