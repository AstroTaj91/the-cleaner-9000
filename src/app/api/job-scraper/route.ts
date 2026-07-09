import { NextResponse } from 'next/server';

interface ScrapedJob {
  title: string;
  pay: string;
  location: string;
  url: string;
  posted: string;
  description: string;
  service_type: 'residential' | 'commercial' | 'construction';
  source: 'simplyhired' | 'kijiji' | 'indeed' | 'housekeeper' | 'google_jobs' | 'facebook';
}

/**
 * Demand-side mock listings only: homeowners / businesses looking to HIRE a cleaner.
 * Never include vendor ads offering cleaning services.
 */
const GLOBAL_MOCK_LISTINGS: ScrapedJob[] = [
  {
    title: "Looking for Cleaner — Post-Construction Final Clean",
    pay: "$450 Flat Rate",
    location: "[City], ON",
    url: "https://www.simplyhired.ca/search?q=cleaner+wanted",
    posted: "15 mins ago",
    description: "Builder seeking a reliable cleaning crew for final detail cleaning on 3 brand-new townhouse units. Need drywall dust wiped, windows shined, and floors vacuumed/mopped before client occupancy. Reply with availability and insurance.",
    service_type: 'construction',
    source: 'simplyhired'
  },
  {
    title: "Need Commercial Cleaner for Office Building",
    pay: "$290 per visit",
    location: "[City], ON",
    url: "https://www.kijiji.ca/b-jobs/gta/cleaning",
    posted: "1 hour ago",
    description: "Seeking a reliable local commercial cleaning company for twice-weekly evening office cleans. Trash removal, dusting, vacuuming, and restrooms. 5,000 sq ft. Please message if you can take this contract.",
    service_type: 'commercial',
    source: 'kijiji'
  },
  {
    title: "Cleaner Wanted — Medical Clinic Deep Sanitation",
    pay: "$380 Payout",
    location: "[City], ON",
    url: "https://ca.indeed.com/jobs?q=cleaner+wanted",
    posted: "3 hours ago",
    description: "Dental clinic hiring a contractor for specialized deep clean and sanitation. Hard floors, counters, and reception lobby. Fully insured contractors only. Looking to book this week.",
    service_type: 'commercial',
    source: 'indeed'
  },
  {
    title: "Need House Cleaner — 4 Bed / 3 Bath Deep Clean",
    pay: "$350 Flat Rate",
    location: "[City], ON",
    url: "https://housekeeper.com/cleaner-jobs",
    posted: "4 hours ago",
    description: "Homeowner looking for a top-tier cleaning team for a detailed spring clean. Baseboards, vents, blinds, light fixtures, and kitchen appliances. Please quote and share availability.",
    service_type: 'residential',
    source: 'housekeeper'
  },
  {
    title: "Hiring Crew — Construction Site Rough Sweep",
    pay: "$600 Payout",
    location: "[City], ON",
    url: "https://ca.indeed.com/jobs?q=construction+cleaner+wanted",
    posted: "5 hours ago",
    description: "Looking for an immediate local crew for debris removal, rough sweep, and vacuuming on a newly framed custom home. Safety boots and hard hats required on-site.",
    service_type: 'construction',
    source: 'indeed'
  },
  {
    title: "Looking for Cleaner — Post-Renovation Kitchen & Bath",
    pay: "$220 Flat Rate",
    location: "[City], ON",
    url: "https://www.kijiji.ca/b-jobs/gta/cleaning",
    posted: "7 hours ago",
    description: "Need someone for post-renovation cleaning of a kitchen and master bathroom. Must wipe inside cabinets, polish stainless steel, and remove fine dust from baseboards. Message if available this weekend.",
    service_type: 'construction',
    source: 'kijiji'
  },
  {
    title: "Cleaner Needed — Move-Out Clean 3 Bed / 2 Bath",
    pay: "$250 Flat Rate",
    location: "[City], ON",
    url: "https://www.simplyhired.ca/search?q=move+out+cleaner+wanted",
    posted: "1 day ago",
    description: "End of lease cleaning needed. House is empty. Needs thorough appliance cleaning (fridge, oven), inside cabinets, baseboards, and window tracks. Looking to hire ASAP.",
    service_type: 'residential',
    source: 'simplyhired'
  },
  {
    title: "Seeking Weekly House Cleaner — 2 Bed / 1.5 Bath",
    pay: "$150 per visit",
    location: "[City], ON",
    url: "https://housekeeper.com/cleaner-jobs",
    posted: "2 days ago",
    description: "Looking for a reliable cleaner for weekly residential maintenance. Dusting, vacuuming, mopping, bathroom sanitization, and kitchen counters. Ongoing schedule preferred.",
    service_type: 'residential',
    source: 'housekeeper'
  },
  {
    title: "Need Cleaning Team — Warehouse Floor Scrubbing",
    pay: "$750 Flat Rate",
    location: "[City], ON",
    url: "https://ca.indeed.com/jobs?q=janitorial+wanted",
    posted: "3 days ago",
    description: "Looking for an experienced commercial cleaning team with an auto-scrubber to clean and degrease 15,000 sq ft warehouse floors. Insurance and safety certificates mandatory.",
    service_type: 'commercial',
    source: 'indeed'
  },
  {
    title: "Looking for Cleaner — Airbnb Turnover Condo",
    pay: "$120 per turnover",
    location: "[City], ON",
    url: "https://housekeeper.com/cleaner-jobs",
    posted: "3 days ago",
    description: "Need a fast-turnaround cleaner for Airbnb checkouts. Dusting, bathroom sanitization, kitchen prep, and linen change. Must be available between 11 AM and 3 PM on checkout days.",
    service_type: 'residential',
    source: 'housekeeper'
  },
  {
    title: "Hiring Cleaners — New Townhouse Block Final Clean",
    pay: "$1,800 Payout",
    location: "[City], ON",
    url: "https://www.kijiji.ca/b-jobs/gta/cleaning",
    posted: "4 days ago",
    description: "Sourcing a professional crew to clean a block of 4 newly built townhomes. Final detail cleaning of windows, woodwork, appliances, and bathrooms. Prompt payment upon sign-off.",
    service_type: 'construction',
    source: 'kijiji'
  },
  {
    title: "Need Deep Clean Before Listing — 3 Story Home",
    pay: "$550 Flat Rate",
    location: "[City], ON",
    url: "https://www.simplyhired.ca/search?q=house+cleaner+wanted",
    posted: "5 days ago",
    description: "Homeowner seeking a full deep clean before listing. Carpets, kitchen, windows inside and out, and all surfaces polished. High quality standards expected — please reply with quote.",
    service_type: 'residential',
    source: 'simplyhired'
  }
];

function getCategory(desc: string): 'construction' | 'commercial' | 'residential' {
  const lower = desc.toLowerCase();
  if (lower.includes('construction') || lower.includes('renov') || lower.includes('site') || lower.includes('builder')) {
    return 'construction';
  }
  if (lower.includes('office') || lower.includes('commercial') || lower.includes('clinic') || lower.includes('janitorial') || lower.includes('warehouse')) {
    return 'commercial';
  }
  return 'residential';
}

/**
 * Returns true if the listing should be EXCLUDED.
 * Goal: keep only demand-side posts (people hiring / requesting cleaners).
 * Drop supply-side ads (cleaners / companies offering services).
 */
function shouldExcludeListing(title: string, desc: string): boolean {
  const t = title.toLowerCase();
  const d = desc.toLowerCase();
  const text = `${t} ${d}`;

  // 1. Non-cleaning trades
  const nonCleaningTrades = [
    'plumber', 'plumbing', 'electrician', 'electrical', 'painter', 'painting',
    'handyman', 'carpenter', 'hvac', 'roofing', 'roofer', 'gardening',
    'landscaping', 'pest control', 'snow removal', 'moving service', 'mover',
    'air duct', 'duct cleaning', 'carpet cleaning service', 'window washing company'
  ];
  if (nonCleaningTrades.some((trade) => text.includes(trade))) {
    return true;
  }

  // 2. Must mention cleaning somehow
  const cleaningKeywords = ['clean', 'maid', 'housekeep', 'janitor', 'sanit', 'dust', 'wash', 'sweep'];
  if (!cleaningKeywords.some((kw) => text.includes(kw))) {
    return true;
  }

  // 3. Strong supply-side signals — vendor / cleaner advertising their services
  const supplySidePhrases = [
    'i offer', 'we offer', 'offering my', 'offering cleaning', 'available to clean',
    'hire me', 'cleaner available', 'services offered', 'my services', 'our services',
    'looking for clients', 'looking for work', 'looking for a cleaning job',
    'seeking a cleaning job', 'i am a cleaner', 'experienced cleaner',
    'cleaner looking for', 'housekeeper available', 'available for cleaning',
    'book your clean', 'book now', 'call us today', 'contact us today',
    'cleaner for hire', 'hire a cleaner today', 'we provide', 'we specialize',
    'provides professional', 'our professional team', 'our team provides',
    'fully insured and bonded', 'licensed and insured cleaning',
    'serving the gta', 'serving mississauga', 'serving oakville',
    'now available', 'now avail', 'affordable rates', 'best rates in',
    'free quote', 'get a free estimate', 'schedule your', 'book your next',
    'professional housecleaning', 'professional residential and office',
    'we use commercial', 'high pressure air', 'complete air duct'
  ];
  if (supplySidePhrases.some((phrase) => text.includes(phrase))) {
    return true;
  }

  // 4. Prefer demand-side language (people requesting / hiring)
  const demandSidePhrases = [
    'looking for a cleaner', 'looking for cleaner', 'looking for cleaners',
    'need a cleaner', 'need cleaner', 'need cleaners', 'need a cleaning',
    'need cleaning', 'need house cleaning', 'need a house cleaner',
    'cleaner wanted', 'cleaners wanted', 'housekeeper wanted', 'maid wanted',
    'hiring a cleaner', 'hiring cleaner', 'hiring cleaners', 'hiring a cleaning',
    'seeking a cleaner', 'seeking cleaner', 'seeking cleaners',
    'seeking a reliable', 'looking to hire', 'want to hire',
    'recommend a cleaner', 'anyone know a cleaner', 'anyone recommend',
    'cleaning needed', 'cleaning required', 'cleaning help needed',
    'in need of a cleaner', 'in need of cleaning', 'require a cleaner',
    'require cleaning', 'wanted: cleaner', 'wanted cleaner',
    'job available', 'contract available', 'gig available',
    'sourcing a', 'sourcing out', 'looking for an experienced',
    'looking for a reliable', 'must be available', 'please reply',
    'please message', 'message if available', 'reply with availability',
    'looking to book', 'need someone for', 'need a crew', 'need a team'
  ];
  const hasDemandSignal = demandSidePhrases.some((phrase) => text.includes(phrase));

  // 5. Extra supply heuristics: company-style titles with no hire intent
  const companyAdTitle =
    /^(professional|affordable|best|quality|trusted|premier)\b/.test(t) ||
    /\b(services?|company|ltd|inc|llc)\b/.test(t) ||
    /\b(we |our |i )\b/.test(d.slice(0, 80));

  if (companyAdTitle && !hasDemandSignal) {
    return true;
  }

  // If no clear demand signal, exclude — better empty than vendor spam
  if (!hasDemandSignal) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const { city } = await request.json();
    const targetCity = (city || '').trim();
    const capitalizedCity = targetCity
      ? targetCity.charAt(0).toUpperCase() + targetCity.slice(1).toLowerCase()
      : 'Oakville';

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    const serpapiApiKey = process.env.SERPAPI_API_KEY;

    const hasFirecrawl = !!(firecrawlApiKey && firecrawlApiKey !== 'your_firecrawl_api_key');
    const hasSerpApi = !!(serpapiApiKey && serpapiApiKey !== 'your_serpapi_api_key');

    const allJobs: ScrapedJob[] = [];
    const errors: string[] = [];

    interface ScrapeTask {
      name: string;
      promise: Promise<ScrapedJob[]>;
    }

    const tasks: ScrapeTask[] = [];

    // Demand-side search queries: people hiring / requesting cleaners
    const demandQuery = `"cleaner wanted" OR "looking for a cleaner" OR "need a cleaner" OR "need cleaning" OR "hiring cleaner" OR "housekeeper wanted" ${capitalizedCity} ON`;

    // 1. FIRECRAWL — Jobs / wanted boards (NOT Kijiji services category)
    if (hasFirecrawl) {
      const firecrawlTargets = [
        {
          name: 'kijiji' as const,
          // Jobs board + hire-intent search — avoid /b-services/ (vendor ads)
          url: `https://www.kijiji.ca/b-jobs/gta/${encodeURIComponent('cleaner wanted')}/k0c54l1700272`,
          domain: 'https://www.kijiji.ca'
        },
        {
          name: 'housekeeper' as const,
          url: 'https://housekeeper.com/cleaner-jobs',
          domain: 'https://housekeeper.com'
        },
        {
          name: 'simplyhired' as const,
          url: `https://www.simplyhired.ca/search?q=${encodeURIComponent('cleaner wanted OR "looking for cleaner"')}&l=${encodeURIComponent(capitalizedCity + ', ON')}`,
          domain: 'https://www.simplyhired.ca'
        }
      ];

      firecrawlTargets.forEach((target) => {
        tasks.push({
          name: `Firecrawl (${target.name})`,
          promise: (async () => {
            const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${firecrawlApiKey}`
              },
              body: JSON.stringify({
                url: target.url,
                formats: ['extract'],
                extract: {
                  prompt:
                    'Extract only job posts or classifieds where someone is LOOKING TO HIRE a cleaner or requesting cleaning help. Exclude ads from cleaning companies offering their services.',
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

            if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}`);
            const data = await res.json();
            if (!data.success || !data.data?.extract?.jobs) {
              throw new Error('Success=false or invalid schema response');
            }

            const rawJobs = data.data.extract.jobs as Record<string, string>[];
            const mapped: ScrapedJob[] = rawJobs.map((j): ScrapedJob => {
              const desc = j.description || '';
              const cat = getCategory(`${j.title || ''} ${desc}`);
              return {
                title: j.title || 'Cleaning Help Requested',
                pay: j.pay || (cat === 'construction' ? '$450 Payout' : cat === 'commercial' ? '$290 per visit' : '$200 Flat Rate'),
                location: j.location || `${capitalizedCity}, ON`,
                url: j.url.startsWith('http') ? j.url : `${target.domain}${j.url}`,
                posted: j.posted || 'Just posted',
                description: desc || 'No description provided.',
                service_type: cat,
                source: target.name
              };
            });

            return mapped.filter((job) => !shouldExcludeListing(job.title, job.description));
          })()
        });
      });
    }

    // 2. SERPAPI — Google Jobs & Facebook (hire-intent queries only)
    if (hasSerpApi) {
      tasks.push({
        name: 'SerpApi (Google Jobs)',
        promise: (async () => {
          const query = demandQuery;
          const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(query)}&hl=en&gl=ca&api_key=${serpapiApiKey}`;

          const res = await fetch(url);
          if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
          const data = await res.json();

          const results = data.jobs_results || [];
          interface SerpJob {
            title?: string;
            location?: string;
            description?: string;
            share_link?: string;
            detected_extensions?: {
              posted_at?: string;
              salary?: string;
            };
          }

          const mapped: ScrapedJob[] = results.slice(0, 12).map((j: SerpJob): ScrapedJob => {
            const desc = j.description || '';
            const cat = getCategory(`${j.title || ''} ${desc}`);
            return {
              title: j.title || 'Cleaner Wanted',
              pay: j.detected_extensions?.salary || (cat === 'construction' ? '$450 Payout' : cat === 'commercial' ? '$290 per visit' : '$200 Flat Rate'),
              location: j.location || `${capitalizedCity}, ON`,
              url: j.share_link || `https://google.com/search?q=${encodeURIComponent(j.title || 'cleaner wanted')}`,
              posted: j.detected_extensions?.posted_at || 'Just posted',
              description: desc || 'No description provided.',
              service_type: cat,
              source: 'google_jobs' as const
            };
          });

          return mapped.filter((job) => !shouldExcludeListing(job.title, job.description));
        })()
      });

      tasks.push({
        name: 'SerpApi (Kijiji hire requests)',
        promise: (async () => {
          // Search Kijiji for hire-intent posts; avoid services-category vendor ads
          const query = `site:kijiji.ca ("looking for a cleaner" OR "need a cleaner" OR "cleaner wanted" OR "need cleaning" OR "hiring cleaner") "${capitalizedCity}" -"we offer" -"i offer" -"book now"`;
          const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=en&gl=ca&api_key=${serpapiApiKey}`;

          const res = await fetch(url);
          if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
          const data = await res.json();

          const results = data.organic_results || [];
          interface OrganicResult {
            title?: string;
            link?: string;
            date?: string;
            snippet?: string;
          }

          const mapped: ScrapedJob[] = results.slice(0, 10).map((r: OrganicResult): ScrapedJob => {
            const desc = r.snippet || '';
            const cat = getCategory(`${r.title || ''} ${desc}`);
            return {
              title: r.title || 'Kijiji Cleaner Request',
              pay: cat === 'construction' ? '$450 Payout' : cat === 'commercial' ? '$290 per visit' : '$200 Flat Rate',
              location: `${capitalizedCity}, ON`,
              url: r.link || 'https://www.kijiji.ca',
              posted: r.date || 'Just posted',
              description: desc || 'Hire request posted on Kijiji.',
              service_type: cat,
              source: 'kijiji' as const
            };
          });

          return mapped.filter((job) => !shouldExcludeListing(job.title, job.description));
        })()
      });

      tasks.push({
        name: 'SerpApi (Facebook Groups)',
        promise: (async () => {
          const query = `site:facebook.com/groups ("looking for a cleaner" OR "need a cleaner" OR "cleaning service needed" OR "recommend a cleaner" OR "cleaner wanted") "${capitalizedCity}"`;
          const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=en&gl=ca&api_key=${serpapiApiKey}`;

          const res = await fetch(url);
          if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
          const data = await res.json();

          const results = data.organic_results || [];
          interface OrganicResult {
            title?: string;
            link?: string;
            date?: string;
            snippet?: string;
          }

          const mapped: ScrapedJob[] = results.slice(0, 8).map((r: OrganicResult): ScrapedJob => {
            const desc = r.snippet || '';
            const cat = getCategory(`${r.title || ''} ${desc}`);
            return {
              title: r.title?.replace(' | Facebook', '') || 'Facebook Cleaner Request',
              pay: cat === 'construction' ? '$450 Payout' : cat === 'commercial' ? '$290 per visit' : '$200 Flat Rate',
              location: `${capitalizedCity}, ON`,
              url: r.link || 'https://facebook.com',
              posted: r.date || 'Just posted',
              description: desc || 'Post in public Facebook group requesting a cleaner.',
              service_type: cat,
              source: 'facebook' as const
            };
          });

          return mapped.filter((job) => !shouldExcludeListing(job.title, job.description));
        })()
      });
    }

    if (tasks.length > 0) {
      const results = await Promise.allSettled(tasks.map((t) => t.promise));

      results.forEach((res, i) => {
        const taskName = tasks[i].name;
        if (res.status === 'fulfilled') {
          allJobs.push(...res.value);
        } else {
          const errMsg = res.reason instanceof Error ? res.reason.message : String(res.reason);
          errors.push(`${taskName}: ${errMsg}`);
          console.error(`Scraper error for ${taskName}:`, errMsg);
        }
      });
    }

    // Final pass: demand-only filter on the combined set
    const demandOnlyJobs = allJobs.filter((job) => !shouldExcludeListing(job.title, job.description));

    if (demandOnlyJobs.length > 0) {
      let filteredJobs = demandOnlyJobs;
      if (targetCity) {
        const lowerCity = targetCity.toLowerCase();
        const cityMatched = demandOnlyJobs.filter(
          (job) =>
            job.location.toLowerCase().includes(lowerCity) ||
            job.title.toLowerCase().includes(lowerCity) ||
            job.description.toLowerCase().includes(lowerCity)
        );
        if (cityMatched.length > 0) {
          filteredJobs = cityMatched;
        }
      }

      return NextResponse.json({
        success: true,
        scraped: true,
        hasKey: true,
        intent: 'hire_requests_only',
        jobs: filteredJobs,
        scrapeErrors: errors.length > 0 ? errors : null
      });
    }

    // Fallback mocks — already demand-side wording
    const customizedJobs: ScrapedJob[] = GLOBAL_MOCK_LISTINGS.map((job) => {
      const encCity = encodeURIComponent(capitalizedCity);
      let realUrl = '';

      switch (job.source) {
        case 'simplyhired':
          realUrl = `https://www.simplyhired.ca/search?q=${encodeURIComponent('cleaner wanted')}&l=${encCity}%2C+ON`;
          break;
        case 'kijiji':
          realUrl = `https://www.kijiji.ca/b-jobs/gta/${encodeURIComponent('cleaner wanted')}/k0c54l1700272`;
          break;
        case 'indeed':
          realUrl = `https://ca.indeed.com/jobs?q=${encodeURIComponent('cleaner wanted')}&l=${encCity}%2C+ON`;
          break;
        case 'housekeeper':
          realUrl = 'https://housekeeper.com/cleaner-jobs';
          break;
        default:
          realUrl = 'https://toronto.craigslist.org/search/jjj?query=cleaner+wanted';
      }

      return {
        ...job,
        location: job.location.replace(/\[City\]/g, capitalizedCity),
        title: job.title.replace(/\[City\]/g, capitalizedCity),
        description: job.description.replace(/\[City\]/g, capitalizedCity),
        url: realUrl
      };
    });

    const activeKeysSnippet = {
      firecrawl: hasFirecrawl ? `${firecrawlApiKey!.substring(0, 5)}...` : null,
      serpapi: hasSerpApi ? `${serpapiApiKey!.substring(0, 5)}...` : null
    };

    return NextResponse.json({
      success: true,
      scraped: false,
      hasKey: hasFirecrawl || hasSerpApi,
      intent: 'hire_requests_only',
      activeKeys: activeKeysSnippet,
      scrapeErrors: errors.length > 0 ? errors : null,
      jobs: customizedJobs
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in job-scraper API:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
