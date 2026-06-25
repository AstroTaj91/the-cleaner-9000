import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// High-fidelity mock Google Business Profiles based on Eric Velch's exact-match naming strategy
const PROFILES_TO_SYNC = [
  {
    name: "Mississauga House Cleaning Services",
    city: "Mississauga",
    review_count: 85,
    google_review_link: "https://g.page/r/mississauga-cleaning-mock/review"
  },
  {
    name: "Oakville House Cleaning Services",
    city: "Oakville",
    review_count: 42,
    google_review_link: "https://g.page/r/oakville-cleaning-mock/review"
  },
  {
    name: "Brampton House Cleaning Services",
    city: "Brampton",
    review_count: 28,
    google_review_link: "https://g.page/r/brampton-cleaning-mock/review"
  },
  {
    name: "Vaughan House Cleaning Services",
    city: "Vaughan",
    review_count: 68,
    google_review_link: "https://g.page/r/vaughan-cleaning-mock/review"
  },
  {
    name: "Scarborough House Cleaning Services",
    city: "Scarborough",
    review_count: 19,
    google_review_link: "https://g.page/r/scarborough-cleaning-mock/review"
  }
];

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: true,
        persisted: false,
        count: PROFILES_TO_SYNC.length,
        listings: PROFILES_TO_SYNC.map(p => ({ ...p, competitors: [] }))
      });
    }

    // Fetch existing listings with competitors joined
    const { data, error } = await supabaseAdmin
      .from('gbp_listings')
      .select('*, competitors(*)');

    let listings = data;

    if (error) {
      throw error;
    }

    // Auto-seed if database is currently empty
    if (!listings || listings.length === 0) {
      console.info('[gbp-sync GET] Database empty. Auto-seeding default listings.');
      const { data: seeded, error: seedError } = await supabaseAdmin
        .from('gbp_listings')
        .upsert(
          PROFILES_TO_SYNC.map(p => ({
            name: p.name,
            city: p.city,
            review_count: p.review_count,
            google_review_link: p.google_review_link
          })),
          { onConflict: 'name' }
        )
        .select('*, competitors(*)');

      if (seedError) {
        throw new Error(`Auto-seeding failed: ${seedError.message}`);
      }
      listings = seeded;
    }

    return NextResponse.json({
      success: true,
      persisted: true,
      count: listings?.length || 0,
      listings: listings || []
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in gbp-sync GET API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const isMockOnly = !supabaseAdmin;
    let syncedListings = [...PROFILES_TO_SYNC].map(p => ({ ...p, competitors: [] }));

    if (supabaseAdmin) {
      // Upsert profiles into the database to persist them
      const { data, error } = await supabaseAdmin
        .from('gbp_listings')
        .upsert(
          PROFILES_TO_SYNC.map(p => ({
            name: p.name,
            city: p.city,
            review_count: p.review_count,
            google_review_link: p.google_review_link
          })),
          { onConflict: 'name' }
        )
        .select('*, competitors(*)');

      if (error) {
        throw new Error(`Database upsert error: ${error.message}`);
      }

      if (data) {
        syncedListings = data;
      }
    }

    return NextResponse.json({
      success: true,
      persisted: !isMockOnly,
      count: syncedListings.length,
      listings: syncedListings
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in gbp-sync POST API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
