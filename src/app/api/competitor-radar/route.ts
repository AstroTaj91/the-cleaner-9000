import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface Competitor {
  name: string;
  reviewCount: number;
  rating: number;
  rank: number;
}

// Deterministic mock data for GTA suburbs if no Google Places API key is set
const MOCK_DATA: Record<string, Competitor[]> = {
  oakville: [
    { name: "Oakville Clean Co.", reviewCount: 45, rating: 4.8, rank: 1 },
    { name: "Spotless Oakville", reviewCount: 82, rating: 4.7, rank: 2 },
    { name: "Elite Maid Services GTA", reviewCount: 310, rating: 4.9, rank: 3 }
  ],
  mississauga: [
    { name: "Mississauga Cleaning Pros", reviewCount: 150, rating: 4.6, rank: 1 },
    { name: "Sauga Maids", reviewCount: 220, rating: 4.8, rank: 2 },
    { name: "Lakeshore Cleaners", reviewCount: 95, rating: 4.2, rank: 3 }
  ],
  brampton: [
    { name: "Brampton Cleaning Services", reviewCount: 52, rating: 4.5, rank: 1 },
    { name: "Flower City Maids", reviewCount: 68, rating: 4.7, rank: 2 },
    { name: "Quick Clean Brampton", reviewCount: 42, rating: 4.3, rank: 3 }
  ],
  toronto: [
    { name: "Toronto Cleaning Authority", reviewCount: 840, rating: 4.9, rank: 1 },
    { name: "Downtown Maids", reviewCount: 420, rating: 4.7, rank: 2 },
    { name: "GTA Cleaners Ltd", reviewCount: 310, rating: 4.8, rank: 3 }
  ],
  vaughan: [
    { name: "Vaughan Maid Service", reviewCount: 110, rating: 4.6, rank: 1 },
    { name: "Vaughan Spotless", reviewCount: 74, rating: 4.8, rank: 2 },
    { name: "Clean Vaughan Specialists", reviewCount: 55, rating: 4.4, rank: 3 }
  ],
  scarborough: [
    { name: "Scarborough Cleaners", reviewCount: 35, rating: 4.1, rank: 1 },
    { name: "Scarborough Maids & Co.", reviewCount: 120, rating: 4.6, rank: 2 },
    { name: "East End Spotless", reviewCount: 62, rating: 4.5, rank: 3 }
  ]
};

export async function POST(request: Request) {
  try {
    const { suburb, keyword } = await request.json();

    if (!suburb || !keyword) {
      return NextResponse.json(
        { error: 'Suburb and Keyword are required.' },
        { status: 400 }
      );
    }

    const normalizedSuburb = suburb.trim().toLowerCase();
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    let competitors: Competitor[] = [];

    if (!apiKey || apiKey === 'your_google_places_api_key') {
      // Use high-fidelity mock data fallback
      competitors = MOCK_DATA[normalizedSuburb] || [
        // Default generic mock if suburb is not in list
        { name: `${suburb} Custom Cleaners`, reviewCount: 38, rating: 4.6, rank: 1 },
        { name: `${suburb} Home Maids`, reviewCount: 125, rating: 4.5, rank: 2 },
        { name: `Pure Clean ${suburb}`, reviewCount: 47, rating: 4.8, rank: 3 }
      ];
    } else {
      // Query real Google Places Text Search API (Classic Endpoint)
      const query = `${suburb} ${keyword}`;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Google Places API returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API status: ${data.status} - ${data.error_message || ''}`);
      }

      const results = data.results || [];
      interface PlaceResult {
        name: string;
        user_ratings_total?: number;
        rating?: number;
      }
      competitors = results.slice(0, 3).map((place: PlaceResult, index: number) => ({
        name: place.name,
        reviewCount: place.user_ratings_total || 0,
        rating: place.rating || 0,
        rank: index + 1
      }));

      // If less than 3 results returned, pad with fallback details
      while (competitors.length < 3) {
        const nextRank = competitors.length + 1;
        competitors.push({
          name: `Unoccupied Maps Slot #${nextRank}`,
          reviewCount: 0,
          rating: 0,
          rank: nextRank
        });
      }
    }

    // Apply the Deep Cleaners Threshold Rule:
    // A market is winnable (GO) if at least 2 of the top 3 ranking businesses have fewer than 100 reviews.
    const weakCompetitors = competitors.filter(c => c.reviewCount < 100).length;
    const isWinnable = weakCompetitors >= 2;
    const status = isWinnable ? 'GO' : 'NO-GO';

    // Write competitors to Supabase database if connected
    if (supabaseAdmin) {
      try {
        const trimmedSuburb = suburb.trim();
        // Find matching GBP listing based on city name (case-insensitive search)
        const { data: gbpListing } = await supabaseAdmin
          .from('gbp_listings')
          .select('id')
          .ilike('city', trimmedSuburb)
          .maybeSingle();

        let targetListingId = gbpListing?.id;

        if (!targetListingId) {
          // Capitalize city name (e.g. "ancaster" -> "Ancaster")
          const capitalizedCity = trimmedSuburb.charAt(0).toUpperCase() + trimmedSuburb.slice(1).toLowerCase();
          
          const { data: newListing, error: createError } = await supabaseAdmin
            .from('gbp_listings')
            .insert({
              name: `${capitalizedCity} House Cleaning Services`,
              city: capitalizedCity,
              review_count: 0,
              google_review_link: `https://g.page/r/${capitalizedCity.toLowerCase()}-cleaning-mock/review`
            })
            .select('id')
            .maybeSingle();

          if (createError) {
            console.error('Failed to auto-create GBP listing for new city:', createError);
          } else if (newListing) {
            targetListingId = newListing.id;
          }
        }

        if (targetListingId) {
          // Delete existing competitors for this listing
          await supabaseAdmin
            .from('competitors')
            .delete()
            .eq('gbp_listing_id', targetListingId);

          // Insert new competitors
          await supabaseAdmin
            .from('competitors')
            .insert(
              competitors.map(c => ({
                gbp_listing_id: targetListingId,
                name: c.name,
                review_count: c.reviewCount,
                rating: c.rating,
                rank: c.rank
              }))
            );
        }
      } catch (dbErr) {
        console.error('Failed to write competitors to database:', dbErr);
      }
    }

    return NextResponse.json({
      suburb,
      keyword,
      status,
      weakCount: weakCompetitors,
      competitors
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in competitor-radar API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
