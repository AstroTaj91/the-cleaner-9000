import { NextResponse } from 'next/server';
import {
  ScrapedJob,
  RawJob,
  resolveTargetCities,
  shouldExcludeListing,
  resolveJobUrl,
  scrapeGoogleJobs,
  scrapeKijiji,
  scrapeFacebookOrganic,
  scrapeApifyIndeed,
  scrapeApifyFacebookGroups
} from '@/lib/scrapers';

// Multi-source + link-liveness probing needs headroom beyond the 10s default.
export const maxDuration = 60;

const SAMPLE_JOBS: ScrapedJob[] = [
  {
    title: 'Looking for Cleaner — Post-Construction Final Clean',
    pay: '', location: '[City], ON', url: '', posted: 'Sample',
    description: 'Builder seeking a reliable crew for final detail cleaning on 3 new townhouse units. Drywall dust, windows, and floors before occupancy.',
    service_type: 'construction', source: 'kijiji', has_live_link: false, phone: ''
  },
  {
    title: 'Need House Cleaner — 4 Bed / 3 Bath Deep Clean',
    pay: '', location: '[City], ON', url: '', posted: 'Sample',
    description: 'Homeowner looking for a top-tier team for a detailed spring clean. Baseboards, vents, blinds, light fixtures, and kitchen appliances.',
    service_type: 'residential', source: 'kijiji', has_live_link: false, phone: ''
  },
  {
    title: 'Cleaner Needed — Move-Out Clean 3 Bed / 2 Bath',
    pay: '', location: '[City], ON', url: '', posted: 'Sample',
    description: 'End of lease cleaning needed. Empty house. Appliance cleaning (fridge, oven), inside cabinets, baseboards, and window tracks.',
    service_type: 'residential', source: 'kijiji', has_live_link: false, phone: ''
  }
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { city, cities, wide } = body as { city?: string; cities?: string[]; wide?: boolean };

    const targetCities = resolveTargetCities(city, cities, wide);
    const primaryCity = targetCities[0] || 'Oakville';

    const serpKey = process.env.SERPAPI_API_KEY;
    const apifyToken = process.env.APIFY_API_TOKEN;
    const hasSerp = !!(serpKey && serpKey !== 'your_serpapi_api_key');
    const hasApify = !!(apifyToken && apifyToken !== 'your_apify_api_token');

    const indeedActor = process.env.APIFY_INDEED_ACTOR || 'misceres~indeed-scraper';
    const fbActor = process.env.APIFY_FB_GROUPS_ACTOR || 'apify~facebook-groups-scraper';
    const fbGroupUrls = (process.env.APIFY_FB_GROUP_URLS || '')
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const tasks: { name: string; promise: Promise<RawJob[]> }[] = [];

    if (hasSerp) {
      tasks.push({ name: 'SerpApi Google Jobs', promise: scrapeGoogleJobs(primaryCity, serpKey!) });
      tasks.push({ name: 'SerpApi Kijiji', promise: scrapeKijiji(targetCities, serpKey!) });
      tasks.push({ name: 'SerpApi Facebook', promise: scrapeFacebookOrganic(targetCities, serpKey!) });
    }
    if (hasApify) {
      tasks.push({ name: 'Apify Indeed', promise: scrapeApifyIndeed(primaryCity, apifyToken!, indeedActor) });
      if (fbGroupUrls.length > 0) {
        tasks.push({ name: 'Apify Facebook Groups', promise: scrapeApifyFacebookGroups(fbGroupUrls, apifyToken!, fbActor, targetCities) });
      }
    }

    const rawJobs: RawJob[] = [];
    const errors: string[] = [];
    const sourceCounts: Record<string, number> = {};

    if (tasks.length > 0) {
      const settled = await Promise.allSettled(tasks.map((t) => t.promise));
      settled.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          rawJobs.push(...res.value);
          sourceCounts[tasks[i].name] = res.value.length;
        } else {
          const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
          errors.push(`${tasks[i].name}: ${msg}`);
          sourceCounts[tasks[i].name] = 0;
          console.error(`Scraper error for ${tasks[i].name}:`, msg);
        }
      });
    }

    // Intent filter, then resolve a live URL for each (dead links dropped).
    const candidates = rawJobs.filter((j) => !shouldExcludeListing(j.title, j.description));

    const resolved = await Promise.all(
      candidates.map(async (j): Promise<ScrapedJob | null> => {
        const { url, has_live_link } = await resolveJobUrl(j.candidates);
        if (!has_live_link) return null;
        return {
          title: j.title,
          pay: j.pay,
          location: j.location,
          url,
          posted: j.posted || 'Recently',
          description: j.description,
          service_type: j.service_type,
          source: j.source,
          has_live_link: true,
          phone: j.phone || ''
        };
      })
    );

    // Dedupe by URL
    const seen = new Set<string>();
    let liveJobs = resolved.filter((j): j is ScrapedJob => {
      if (!j || seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });

    // Prefer results that mention one of the target cities, but keep all if none match.
    const cityLc = targetCities.map((c) => c.toLowerCase());
    const cityMatched = liveJobs.filter((j) =>
      cityLc.some((c) =>
        j.location.toLowerCase().includes(c) ||
        j.title.toLowerCase().includes(c) ||
        j.description.toLowerCase().includes(c)
      )
    );
    if (cityMatched.length > 0) liveJobs = cityMatched;

    if (liveJobs.length > 0) {
      return NextResponse.json({
        success: true,
        scraped: true,
        hasKey: true,
        intent: 'hire_requests_only',
        citiesScanned: targetCities,
        liveLinkCount: liveJobs.length,
        sourceCounts,
        jobs: liveJobs,
        scrapeErrors: errors.length > 0 ? errors : null
      });
    }

    // No live results — return clearly non-clickable sample cards.
    const sampleJobs: ScrapedJob[] = SAMPLE_JOBS.map((job) => ({
      ...job,
      location: job.location.replace(/\[City\]/g, primaryCity),
      title: job.title.replace(/\[City\]/g, primaryCity),
      description: job.description.replace(/\[City\]/g, primaryCity)
    }));

    return NextResponse.json({
      success: true,
      scraped: false,
      hasKey: hasSerp || hasApify,
      intent: 'hire_requests_only',
      citiesScanned: targetCities,
      note: hasSerp || hasApify
        ? 'No live listings passed validation right now. Showing sample cards.'
        : 'No scraper API keys configured. Showing sample cards.',
      sourceCounts,
      scrapeErrors: errors.length > 0 ? errors : null,
      jobs: sampleJobs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in job-scraper API:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
