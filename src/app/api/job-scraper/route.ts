import { NextResponse } from 'next/server';

interface ScrapedJob {
  title: string;
  pay: string;
  location: string;
  url: string;
  posted: string;
  description: string;
  service_type: 'residential' | 'commercial' | 'construction';
  source: 'simplyhired' | 'kijiji' | 'indeed' | 'housekeeper';
}

const GLOBAL_MOCK_LISTINGS: ScrapedJob[] = [
  {
    title: "Post-Construction Final Clean - Condo Development",
    pay: "$450 Flat Rate",
    location: "[City], ON",
    url: "https://www.simplyhired.ca/search?q=construction-clean",
    posted: "15 mins ago",
    description: "Final detail cleaning for 3 brand-new townhouse units. Builders have completed all inspections. Need drywall dust wiped off walls, windows shined, and floors vacuumed/mopped. Ready for client occupancy.",
    service_type: 'construction',
    source: 'simplyhired'
  },
  {
    title: "Commercial Office Building Janitorial Contract",
    pay: "$290 per visit",
    location: "[City], ON",
    url: "https://www.kijiji.ca/v-services/gta/office-janitorial",
    posted: "1 hour ago",
    description: "Seeking a reliable local commercial cleaning company to perform twice-weekly evening office cleanings. Includes trash removal, dusting, vacuuming, and cleaning communal restrooms. 5,000 sq ft office space.",
    service_type: 'commercial',
    source: 'kijiji'
  },
  {
    title: "Medical Clinic Deep Sanitation & Sanitization",
    pay: "$380 Payout",
    location: "[City], ON",
    url: "https://ca.indeed.com/jobs?q=medical-clinic-cleaning",
    posted: "3 hours ago",
    description: "Specialized deep clean and sanitation for a local dental clinic. Hard floors need sanitization, counter areas disinfected, and reception lobbies deep cleaned. Fully insured contractors only.",
    service_type: 'commercial',
    source: 'indeed'
  },
  {
    title: "Deep Home Cleaning Service - 4 Bed / 3 Bath",
    pay: "$350 Flat Rate",
    location: "[City], ON",
    url: "https://housekeeper.com/gigs/deep-home-clean",
    posted: "4 hours ago",
    description: "Detailed spring cleaning for a 4-bedroom home. Baseboards, vents, shutters, blinds, light fixtures, and kitchen appliances. Sourcing out to a top-tier cleaning team.",
    service_type: 'residential',
    source: 'housekeeper'
  },
  {
    title: "Custom Home Construction Site Debris Rough Sweep",
    pay: "$600 Payout",
    location: "[City], ON",
    url: "https://ca.indeed.com/jobs?q=construction-debris-cleanup",
    posted: "5 hours ago",
    description: "Debris removal, rough sweep, and vacuuming for a newly framed residential custom home. Safety boots and hard hats required on-site. Looking for immediate local crew.",
    service_type: 'construction',
    source: 'indeed'
  },
  {
    title: "Post-Renovation Kitchen & Bathroom Detail Clean",
    pay: "$220 Flat Rate",
    location: "[City], ON",
    url: "https://www.kijiji.ca/v-services/gta/renov-sparkle-clean",
    posted: "7 hours ago",
    description: "Post-renovation cleaning for a residential kitchen and master bathroom. Must wipe inside all cabinets, polish stainless steel, and remove fine dust from baseboards.",
    service_type: 'construction',
    source: 'kijiji'
  },
  {
    title: "Move-Out Clean - 3 Bed / 2 Bath Empty House",
    pay: "$250 Flat Rate",
    location: "[City], ON",
    url: "https://www.simplyhired.ca/search?q=move-out-clean",
    posted: "1 day ago",
    description: "End of lease cleaning. The house is completely empty. Needs thorough appliance cleaning (fridge, oven), inside cabinets, baseboards, and window tracks.",
    service_type: 'residential',
    source: 'simplyhired'
  },
  {
    title: "Weekly Home Cleaning Maintenance - 2 Bed / 1.5 Bath",
    pay: "$150 per visit",
    location: "[City], ON",
    url: "https://housekeeper.com/gigs/weekly-home-maintenance",
    posted: "2 days ago",
    description: "Standard residential cleaning. Dusting, vacuuming, mopping, bathroom sanitization, and kitchen counter wiping. Reliable weekly schedule.",
    service_type: 'residential',
    source: 'housekeeper'
  },
  {
    title: "Industrial Warehouse Floor Scrubbing & Sweeping",
    pay: "$750 Flat Rate",
    location: "[City], ON",
    url: "https://ca.indeed.com/jobs?q=industrial-warehouse-cleaning",
    posted: "3 days ago",
    description: "Looking for an experienced commercial cleaning team with an auto-scrubber to clean and degrease 15,000 sq ft warehouse floors. Insurance and safety certificates mandatory.",
    service_type: 'commercial',
    source: 'indeed'
  },
  {
    title: "Airbnb Turnover and Linen Change - Downtown Luxury Condo",
    pay: "$120 per turnover",
    location: "[City], ON",
    url: "https://housekeeper.com/gigs/airbnb-turnover-condo",
    posted: "3 days ago",
    description: "Fast-turnaround Airbnb cleaning. Dusting, bathroom sanitization, kitchen prep, and washing/changing linens. Must be available between 11 AM and 3 PM on checkout days.",
    service_type: 'residential',
    source: 'housekeeper'
  },
  {
    title: "New Townhouse Block Final Sweep & Detail Clean",
    pay: "$1,800 Payout",
    location: "[City], ON",
    url: "https://www.kijiji.ca/v-services/gta/townhouse-construction-clean",
    posted: "4 days ago",
    description: "Sourcing a professional crew to clean a block of 4 newly built townhomes. Final detail cleaning of windows, woodwork, appliances, and bathrooms. Prompt payment upon sign-off.",
    service_type: 'construction',
    source: 'kijiji'
  },
  {
    title: "Pre-Sale Deep Clean & Carpets - 3 Story Home",
    pay: "$550 Flat Rate",
    location: "[City], ON",
    url: "https://www.simplyhired.ca/search?q=presale-deep-clean",
    posted: "5 days ago",
    description: "Full deep clean of a 3-story house preparing for listing. Carpets steam cleaned, kitchen deep cleaned, windows inside and out, and all surfaces polished. High quality standards expected.",
    service_type: 'residential',
    source: 'simplyhired'
  }
];

export async function POST(request: Request) {
  try {
    const { city } = await request.json();
    const targetCity = (city || '').trim();

    let scrapeErrorMsg = null;
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    const hasKey = !!(firecrawlApiKey && firecrawlApiKey !== 'your_firecrawl_api_key');

    if (hasKey) {
      try {
        const scrapeTargets = [
          {
            name: 'kijiji' as const,
            url: 'https://www.kijiji.ca/b-services/gta/cleaning/k0c72l1700272',
            domain: 'https://www.kijiji.ca'
          },
          {
            name: 'housekeeper' as const,
            url: 'https://housekeeper.com/cleaner-jobs',
            domain: 'https://housekeeper.com'
          },
          {
            name: 'simplyhired' as const,
            url: 'https://www.simplyhired.ca/search?q=cleaning&l=Toronto%2C+ON',
            domain: 'https://www.simplyhired.ca'
          }
        ];

        const scrapePromises = scrapeTargets.map(async (target) => {
          const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${firecrawlApiKey}`
            },
            body: JSON.stringify({
              url: target.url,
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

          if (!firecrawlRes.ok) {
            throw new Error(`Firecrawl API request failed with HTTP ${firecrawlRes.status}`);
          }

          const data = await firecrawlRes.json();
          if (!data.success || !data.data || !data.data.extract || !data.data.extract.jobs) {
            throw new Error(`Firecrawl API responded with success=false or invalid schema`);
          }

          const rawJobs = data.data.extract.jobs as Record<string, string>[];
          const parsedJobs: ScrapedJob[] = rawJobs.map((j) => {
            const desc = j.description || '';
            let cat: 'construction' | 'commercial' | 'residential' = 'residential';
            
            if (desc.toLowerCase().includes('construction') || desc.toLowerCase().includes('renov') || desc.toLowerCase().includes('site')) {
              cat = 'construction';
            } else if (desc.toLowerCase().includes('office') || desc.toLowerCase().includes('commercial') || desc.toLowerCase().includes('clinic') || desc.toLowerCase().includes('janitorial')) {
              cat = 'commercial';
            }

            return {
              title: j.title || 'Cleaning Gig Contract',
              pay: j.pay || (cat === 'construction' ? '$450 Payout' : cat === 'commercial' ? '$290 per visit' : '$200 Flat Rate'),
              location: j.location || (targetCity ? `${targetCity}, ON` : 'GTA, ON'),
              url: j.url.startsWith('http') ? j.url : `${target.domain}${j.url}`,
              posted: j.posted || 'Just posted',
              description: desc || 'No description provided.',
              service_type: cat,
              source: target.name
            };
          });

          return parsedJobs;
        });

        const results = await Promise.allSettled(scrapePromises);
        const allJobs: ScrapedJob[] = [];
        const errors: string[] = [];

        results.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            allJobs.push(...res.value);
          } else {
            errors.push(`${scrapeTargets[i].name}: ${res.reason instanceof Error ? res.reason.message : String(res.reason)}`);
          }
        });

        if (allJobs.length > 0) {
          let filteredJobs = allJobs;
          if (targetCity) {
            const lowerCity = targetCity.toLowerCase();
            filteredJobs = allJobs.filter(job => 
              job.location.toLowerCase().includes(lowerCity) || 
              job.title.toLowerCase().includes(lowerCity) || 
              job.description.toLowerCase().includes(lowerCity)
            );
            if (filteredJobs.length === 0) {
              filteredJobs = allJobs;
            }
          }

          return NextResponse.json({
            success: true,
            scraped: true,
            hasKey: true,
            jobs: filteredJobs,
            scrapeErrors: errors.length > 0 ? errors : null
          });
        } else {
          throw new Error(`All parallel scrapers failed: ${errors.join('; ')}`);
        }

      } catch (scrapeErr) {
        scrapeErrorMsg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr);
        console.error('Firecrawl parallel scraping error, falling back to mock data:', scrapeErr);
      }
    }

    // Default Fallback Mock Data customized for the target city
    const capitalizedCity = targetCity 
      ? targetCity.charAt(0).toUpperCase() + targetCity.slice(1).toLowerCase()
      : 'Oakville';

    const customizedJobs: ScrapedJob[] = GLOBAL_MOCK_LISTINGS.map((job) => {
      const encCity = encodeURIComponent(capitalizedCity);
      let realUrl = '';
      
      switch (job.source) {
        case 'simplyhired':
          realUrl = `https://www.simplyhired.ca/search?q=${encodeURIComponent(job.service_type === 'construction' ? 'construction clean' : job.service_type === 'commercial' ? 'commercial clean' : 'house cleaning')}&l=${encCity}%2C+ON`;
          break;
        case 'kijiji':
          realUrl = `https://www.kijiji.ca/b-search.html?searchTerm=${encodeURIComponent(job.service_type === 'construction' ? 'construction cleaning' : job.service_type === 'commercial' ? 'commercial cleaning' : 'house cleaning')}+${encCity}`;
          break;
        case 'indeed':
          realUrl = `https://ca.indeed.com/jobs?q=${encodeURIComponent(job.service_type === 'construction' ? 'construction cleaning' : job.service_type === 'commercial' ? 'commercial janitorial' : 'house cleaner')}&l=${encCity}%2C+ON`;
          break;
        case 'housekeeper':
          realUrl = `https://housekeeper.com/cleaner-jobs`;
          break;
        default:
          realUrl = 'https://toronto.craigslist.org/search/ggg?query=cleaning';
      }

      return {
        ...job,
        location: job.location.replace(/\[City\]/g, capitalizedCity),
        title: job.title.replace(/\[City\]/g, capitalizedCity),
        description: job.description.replace(/\[City\]/g, capitalizedCity),
        url: realUrl
      };
    });

    const keySnippet = firecrawlApiKey ? `${firecrawlApiKey.substring(0, 5)}...${firecrawlApiKey.substring(firecrawlApiKey.length - 5)}` : null;
    return NextResponse.json({
      success: true,
      scraped: false,
      hasKey,
      keySnippet,
      scrapeError: scrapeErrorMsg,
      jobs: customizedJobs
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
