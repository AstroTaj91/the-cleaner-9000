import { NextResponse } from 'next/server';

interface ScrapedJob {
  title: string;
  pay: string;
  location: string;
  url: string;
  posted: string;
  description: string;
  service_type: 'residential' | 'commercial' | 'construction';
}

const MOCK_JOBS: Record<string, ScrapedJob[]> = {
  construction: [
    {
      title: "Post-Construction Final Clean - Oakville Condo Development",
      pay: "$450 Flat Rate",
      location: "Oakville, ON",
      url: "https://toronto.craigslist.org/gta/ggg/oakville-construction-clean",
      posted: "2 hours ago",
      description: "Final detail cleaning for 3 brand-new townhouse units. Builders have completed all inspections. Need dust wiped off walls, windows shined, and carpets vacuumed. Ready to hand over to clients.",
      service_type: 'construction'
    },
    {
      title: "Commercial Office Renovation Dust Cleanup",
      pay: "$320 Payout",
      location: "Mississauga, ON",
      url: "https://toronto.craigslist.org/gta/ggg/mississauga-office-renovation",
      posted: "5 hours ago",
      description: "Post-renovation cleanup for a newly remodeled tech office suite. High-dusting required for ceilings and partitions, plus detailed floor sweeping and sanitization.",
      service_type: 'construction'
    },
    {
      title: "Custom Home Build Construction Site Debris Rough Sweep",
      pay: "$600 Payout",
      location: "Hamilton, ON",
      url: "https://toronto.craigslist.org/gta/ggg/hamilton-rough-sweep",
      posted: "1 day ago",
      description: "Debris removal, rough sweep, and vacuuming for a newly framed residential custom home. Safety boots and hard hats required on-site. Sourcing out to local crews.",
      service_type: 'construction'
    },
    {
      title: "Renovated Kitchen & Bathroom Final Sparkle Clean",
      pay: "$220 Flat Rate",
      location: "Ancaster, ON",
      url: "https://toronto.craigslist.org/gta/ggg/ancaster-sparkle-clean",
      posted: "30 mins ago",
      description: "Post-renovation cleaning for a residential kitchen and master bathroom. Must wipe inside cabinets, polish stainless steel, and remove fine dust from baseboards.",
      service_type: 'construction'
    }
  ],
  commercial: [
    {
      title: "Office Building Janitorial Service Contract",
      pay: "$290 per visit",
      location: "Vaughan, ON",
      url: "https://toronto.craigslist.org/gta/jjj/vaughan-office-janitorial",
      posted: "3 hours ago",
      description: "Seeking a reliable crew to perform twice-weekly evening office cleanings. Includes trash removal, dusting, vacuuming, and cleaning communal restrooms. 5,000 sq ft office.",
      service_type: 'commercial'
    },
    {
      title: "Medical Clinic Deep Sanitation & Sanitization",
      pay: "$380 Payout",
      location: "Mississauga, ON",
      url: "https://toronto.craigslist.org/gta/ggg/mississauga-clinic-sanitation",
      posted: "8 hours ago",
      description: "Specialized deep clean for a local dental clinic. Hard floors need sanitization, counters disinfected, and waiting areas deep cleaned. Insured contractors preferred.",
      service_type: 'commercial'
    },
    {
      title: "Retail Showroom Tile Floor Scrub & Burnish",
      pay: "$240 Flat Rate",
      location: "Oakville, ON",
      url: "https://toronto.craigslist.org/gta/ggg/oakville-showroom-scrub",
      posted: "1 day ago",
      description: "Need a professional team with equipment to scrub and polish showroom floors for a furniture shop. Work to be done overnight after closing.",
      service_type: 'commercial'
    },
    {
      title: "Ancaster Professional Office Suites Cleaning",
      pay: "$180 per clean",
      location: "Ancaster, ON",
      url: "https://toronto.craigslist.org/gta/ggg/ancaster-professional-office",
      posted: "4 hours ago",
      description: "Weekly office cleaning for 4 private consulting rooms, a lobby, and employee break room. Easy work for a reliable local contractor.",
      service_type: 'commercial'
    }
  ],
  residential: [
    {
      title: "Move-Out Clean - 3 Bed / 2 Bath Empty House",
      pay: "$250 Flat Rate",
      location: "Ancaster, ON",
      url: "https://toronto.craigslist.org/gta/ggg/ancaster-move-out-clean",
      posted: "1 hour ago",
      description: "End of lease cleaning. The house is completely empty. Needs thorough appliance cleaning (fridge, oven), inside cabinets, baseboards, and window tracks.",
      service_type: 'residential'
    },
    {
      title: "Residential Deep Cleaning - 4 Bed / 3 Bath Home",
      pay: "$380 Payout",
      location: "Oakville, ON",
      url: "https://toronto.craigslist.org/gta/ggg/oakville-deep-home-clean",
      posted: "6 hours ago",
      description: "Detailed spring cleaning. Baseboards, vents, shutters, blinds, light fixtures, and appliances. Looking for a thorough cleaning company.",
      service_type: 'residential'
    },
    {
      title: "Weekly Home Cleaning Maintenance - 2 Bed / 1.5 Bath",
      pay: "$150 per visit",
      location: "Brampton, ON",
      url: "https://toronto.craigslist.org/gta/ggg/brampton-weekly-maintenance",
      posted: "2 days ago",
      description: "Standard residential cleaning. Dusting, vacuuming, mopping, bathroom sanitization, and kitchen counters. Reliable weekly schedule.",
      service_type: 'residential'
    },
    {
      title: "Mississauga Townhouse Post-Moving Detail Cleaning",
      pay: "$280 Flat Rate",
      location: "Mississauga, ON",
      url: "https://toronto.craigslist.org/gta/ggg/mississauga-post-moving",
      posted: "10 hours ago",
      description: "Detailed cleaning before new owners move in. Focus on deep-cleaning kitchen, sanitizing bathrooms, and vacuuming carpets. Professional equipment preferred.",
      service_type: 'residential'
    }
  ]
};

export async function POST(request: Request) {
  try {
    const { city, keyword } = await request.json();

    const normalizedKeyword = (keyword || '').toLowerCase();
    const normalizedCity = (city || '').trim().toLowerCase();

    // Determine the category matches
    let category: 'construction' | 'commercial' | 'residential' = 'residential';
    if (normalizedKeyword.includes('construction') || normalizedKeyword.includes('renov') || normalizedKeyword.includes('site') || normalizedKeyword.includes('debris')) {
      category = 'construction';
    } else if (normalizedKeyword.includes('office') || normalizedKeyword.includes('commercial') || normalizedKeyword.includes('janitorial') || normalizedKeyword.includes('building') || normalizedKeyword.includes('clinic')) {
      category = 'commercial';
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    if (firecrawlApiKey && firecrawlApiKey !== 'your_firecrawl_api_key') {
      try {
        const targetCity = normalizedCity || 'toronto';
        const scrapeUrl = `https://${targetCity}.craigslist.org/search/ggg?query=${encodeURIComponent(keyword || 'cleaning')}`;

        const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlApiKey}`
          },
          body: JSON.stringify({
            url: scrapeUrl,
            formats: ['extract'],
            extract: {
              schema: {
                type: 'object',
                properties: {
                  jobs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        pay: { type: 'string' },
                        location: { type: 'string' },
                        url: { type: 'string' },
                        posted: { type: 'string' },
                        description: { type: 'string' }
                      },
                      required: ['title', 'url']
                    }
                  }
                }
              }
            }
          })
        });

        if (firecrawlRes.ok) {
          const data = await firecrawlRes.json();
          if (data.success && data.data && data.data.extract && data.data.extract.jobs) {
            const rawJobs = data.data.extract.jobs as Record<string, string>[];
            const parsedJobs: ScrapedJob[] = rawJobs.map((j) => ({
              title: j.title || 'Cleaning Gig',
              pay: j.pay || '$200 - $350 Payout',
              location: j.location || (city ? `${city}, ON` : 'GTA, ON'),
              url: j.url.startsWith('http') ? j.url : `https://${targetCity}.craigslist.org${j.url}`,
              posted: j.posted || 'Just posted',
              description: j.description || 'No description provided.',
              service_type: category
            }));

            return NextResponse.json({
              success: true,
              scraped: true,
              jobs: parsedJobs
            });
          }
        }
      } catch (scrapeErr) {
        console.error('Firecrawl scraping error, falling back to mock data:', scrapeErr);
      }
    }

    // Default Fallback Mock Data Filtered by City (GTA regions)
    const list = MOCK_JOBS[category] || MOCK_JOBS.residential;
    let filteredJobs = list;

    if (normalizedCity) {
      filteredJobs = list.filter((job) => job.location.toLowerCase().includes(normalizedCity));
      // If city search returns nothing, fill with city-customized listings
      if (filteredJobs.length === 0) {
        const capCity = normalizedCity.charAt(0).toUpperCase() + normalizedCity.slice(1);
        filteredJobs = list.map((job) => ({
          ...job,
          location: `${capCity}, ON`,
          title: job.title.replace(/Oakville|Mississauga|Brampton|Ancaster|Vaughan/g, capCity),
          description: job.description.replace(/Oakville|Mississauga|Brampton|Ancaster|Vaughan/g, capCity),
          url: job.url.replace(/oakville|mississauga|brampton|ancaster|vaughan/g, normalizedCity)
        }));
      }
    }

    return NextResponse.json({
      success: true,
      scraped: false,
      jobs: filteredJobs
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in job-scraper API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
