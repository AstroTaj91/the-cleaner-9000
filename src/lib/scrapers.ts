/**
 * Shared scraping library for the Classifieds / Hire-Request Radar.
 *
 * Sources:
 *  - SerpAPI: Google Jobs, Kijiji (organic), Facebook Groups (organic)
 *  - Apify:   Indeed actor, Facebook Groups actor (curated group URLs)
 *
 * Everything is demand-side focused (people HIRING a cleaner). Supply-side
 * vendor ads, non-cleaning trades and staffing noise are filtered out, and
 * every returned URL is verified/normalized so the UI never shows a dead link.
 */

export interface ScrapedJob {
  title: string;
  pay: string;
  location: string;
  url: string;
  posted: string;
  description: string;
  service_type: 'residential' | 'commercial' | 'construction';
  source: 'simplyhired' | 'kijiji' | 'indeed' | 'housekeeper' | 'google_jobs' | 'facebook';
  has_live_link: boolean;
  /** Formatted contact phone parsed from the listing text, when present. */
  phone: string;
}

/** Internal shape carrying fallback URL candidates before liveness resolution. */
export type RawJob = Omit<ScrapedJob, 'url' | 'has_live_link'> & {
  candidates: string[];
};

/** Core GTA + surrounding markets, ordered roughly west -> east. */
export const GTA_CITIES = [
  'Oakville', 'Burlington', 'Milton', 'Mississauga', 'Brampton',
  'Toronto', 'Etobicoke', 'North York', 'Scarborough',
  'Vaughan', 'Markham', 'Richmond Hill', 'Ajax', 'Pickering', 'Whitby', 'Oshawa'
];

const GTA_PLACES = [
  'toronto', 'north york', 'scarborough', 'etobicoke', 'east york', 'york',
  'mississauga', 'brampton', 'caledon', 'oakville', 'burlington', 'milton', 'halton hills',
  'vaughan', 'markham', 'richmond hill', 'aurora', 'newmarket', 'king city', 'stouffville',
  'thornhill', 'maple', 'concord', 'woodbridge',
  'pickering', 'ajax', 'whitby', 'oshawa', 'clarington', 'durham', 'peel', 'halton', 'ancaster', 'hamilton'
];

/** Neighbouring markets used to "widen" a single-city scan. */
const CITY_NEIGHBOURS: Record<string, string[]> = {
  oakville: ['Burlington', 'Milton', 'Mississauga'],
  burlington: ['Oakville', 'Hamilton', 'Milton'],
  milton: ['Oakville', 'Mississauga', 'Burlington'],
  mississauga: ['Oakville', 'Brampton', 'Etobicoke', 'Milton'],
  brampton: ['Mississauga', 'Vaughan', 'Caledon'],
  toronto: ['North York', 'Scarborough', 'Etobicoke', 'Vaughan'],
  markham: ['Richmond Hill', 'Vaughan', 'Scarborough'],
  vaughan: ['Toronto', 'Richmond Hill', 'Brampton'],
  oshawa: ['Whitby', 'Ajax', 'Pickering'],
  whitby: ['Oshawa', 'Ajax', 'Pickering'],
  ajax: ['Pickering', 'Whitby', 'Scarborough'],
  pickering: ['Ajax', 'Scarborough', 'Whitby']
};

function titleCase(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve the list of cities to scan.
 *  - explicit `cities` array wins
 *  - a single `city` with `wide` adds its GTA neighbours
 *  - a single `city` alone scans just that city
 *  - nothing provided => core GTA sweep
 */
export function resolveTargetCities(city?: string, cities?: string[], wide?: boolean): string[] {
  if (Array.isArray(cities) && cities.length > 0) {
    return dedupeStrings(cities.map(titleCase)).slice(0, 8);
  }
  const c = (city || '').trim();
  if (c) {
    if (wide) {
      const neighbours = CITY_NEIGHBOURS[c.toLowerCase()] || [];
      return dedupeStrings([titleCase(c), ...neighbours]).slice(0, 6);
    }
    return [titleCase(c)];
  }
  return GTA_CITIES.slice(0, 8);
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

export function getCategory(text: string): ScrapedJob['service_type'] {
  const lower = text.toLowerCase();
  if (lower.includes('construction') || lower.includes('renov') || lower.includes('post-construction') || lower.includes('builder') || lower.includes('drywall')) {
    return 'construction';
  }
  if (lower.includes('office') || lower.includes('commercial') || lower.includes('clinic') || lower.includes('janitor') || lower.includes('warehouse') || lower.includes('retail') || lower.includes('hotel') || lower.includes('building')) {
    return 'commercial';
  }
  return 'residential';
}

/**
 * Extract a North-American phone number from free text. Requires separators
 * between digit groups so contiguous IDs (e.g. Kijiji ad ids) never match.
 * Returns a formatted "(905) 555-1234" string, or '' if none found.
 */
export function extractPhone(text: string): string {
  if (!text) return '';
  const m = text.match(/(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]([2-9]\d{2})[\s.\-](\d{4})/);
  if (!m) return '';
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

/** Extract a real GTA location from free text; empty string if none found. */
export function extractLocation(text: string): string {
  const lower = (text || '').toLowerCase();
  for (const place of GTA_PLACES) {
    if (lower.includes(place)) return titleCase(place) + ', ON';
  }
  return '';
}

/** Fix known-bad / legacy hosts. Returns '' for anything non-http. */
export function normalizeListingUrl(url: string): string {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const u = new URL(url);
    if (u.hostname === 'web.kijiji.ca' || u.hostname === 'm.kijiji.ca') u.hostname = 'www.kijiji.ca';
    if (u.hostname === 'm.indeed.com' || u.hostname === 'indeed.com') u.hostname = 'ca.indeed.com';
    return u.toString();
  } catch {
    return '';
  }
}

/**
 * True when URL is a specific listing page (not a search/category index).
 * Also rejects Kijiji's SERVICES category (supply-side cleaner ads).
 */
export function isListingUrl(url: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const full = `${path}?${parsed.search}`.toLowerCase();

    if (host.includes('kijiji.')) {
      if (path.includes('/v-cleaners-cleaning-service')) return false; // supply category
      return path.includes('/v-') && /\/\d{6,}/.test(path);
    }
    if (host.includes('facebook.')) {
      return path.includes('/posts/') || path.includes('/permalink') || path.includes('/groups/');
    }
    if (host.includes('google.')) {
      return full.includes('ibp=htl;jobs') && full.includes('htidocid=');
    }
    if (host.includes('indeed.')) {
      return full.includes('viewjob') || full.includes('jk=');
    }
    if (host.includes('simplyhired.')) return path.includes('/job/');
    if (host.includes('housekeeper.')) return path.includes('/gigs/') || path.includes('/job/') || path.includes('/listing/');
    // Aggregators (jooble, learn4good, talent, etc.) — accept detail-looking pages
    return /\/\d{4,}/.test(path) || path.includes('/jobs/') || path.includes('/job/') || path.includes('/jdp/');
  } catch {
    return false;
  }
}

/**
 * Returns true if the listing should be EXCLUDED (keep demand-side hire posts,
 * drop vendor ads, non-cleaning trades and staffing noise).
 */
export function shouldExcludeListing(title: string, desc: string): boolean {
  const text = `${(title || '').toLowerCase()} ${(desc || '').toLowerCase()}`;

  const nonCleaningTrades = [
    'plumber', 'plumbing', 'electrician', 'electrical', 'painter', 'painting',
    'handyman', 'carpenter', 'hvac', 'roofing', 'roofer', 'gardening',
    'landscaping', 'pest control', 'snow removal', 'moving service', 'mover',
    'air duct', 'duct cleaning'
  ];
  if (nonCleaningTrades.some((t) => text.includes(t))) return true;

  const employmentNoise = [
    'laundromat', 'wash & fold attendant', 'wash and fold attendant',
    'program coordinator', 'j-18808', 'ljbffr', 'msp experience',
    'contingent worker', 'staffing specialist', 'dishwasher'
  ];
  if (employmentNoise.some((p) => text.includes(p))) return true;

  const cleaningKeywords = ['clean', 'maid', 'housekeep', 'janitor', 'sanit', 'dust', 'mop', 'sweep', 'tidy'];
  if (!cleaningKeywords.some((kw) => text.includes(kw))) return true;

  const supplySidePhrases = [
    'i offer', 'we offer', 'offering my', 'offering cleaning', 'available to clean',
    'hire me', 'cleaner available', 'services offered', 'my services', 'our services',
    'looking for clients', 'looking for work', 'looking for a cleaning job',
    'seeking a cleaning job', 'i am a cleaner', 'cleaner looking for',
    'housekeeper available', 'available for cleaning', 'available mon-sun', 'available mon–sun',
    'book your clean', 'book now', 'call us today', 'contact us today',
    'we provide', 'we specialize', 'provides professional', 'our professional team',
    'fully insured and bonded', 'affordable, experienced', 'affordable rates',
    'best rates', 'free quote', 'free estimate', 'professional housecleaning',
    'we use commercial', 'high pressure air', 'satisfaction guaranteed'
  ];
  if (supplySidePhrases.some((p) => text.includes(p))) return true;

  return false;
}

/**
 * Probe URL reachability. 'live' = 2xx/3xx, 'blocked' = anti-bot/auth wall
 * (real page for a human), 'dead' = 404/410/5xx/DNS/timeout.
 */
export async function probeUrl(url: string, timeoutMs = 5000): Promise<'live' | 'blocked' | 'dead'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (res.status >= 200 && res.status < 400) return 'live';
    if ([401, 403, 429, 999].includes(res.status)) return 'blocked';
    return 'dead';
  } catch {
    return 'dead';
  } finally {
    clearTimeout(timer);
  }
}

// Only these hosts are prone to silent expiry and worth a live probe.
const NEEDS_PROBE = /(kijiji\.|housekeeper\.|simplyhired\.)/i;

/** Resolve the first working candidate URL for a job (probing where useful). */
export async function resolveJobUrl(candidates: string[]): Promise<{ url: string; has_live_link: boolean }> {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const url = normalizeListingUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (!isListingUrl(url)) continue;

    if (NEEDS_PROBE.test(url)) {
      const status = await probeUrl(url);
      if (status === 'dead') continue;
      return { url, has_live_link: true };
    }
    return { url, has_live_link: true };
  }
  return { url: '', has_live_link: false };
}

/* ------------------------------------------------------------------ */
/* SerpAPI sources                                                     */
/* ------------------------------------------------------------------ */

interface SerpJob {
  title?: string;
  location?: string;
  description?: string;
  share_link?: string;
  apply_options?: { title?: string; link?: string }[];
  detected_extensions?: { posted_at?: string; salary?: string };
}
interface OrganicResult { title?: string; link?: string; date?: string; snippet?: string }

const HIRE_QUERY = '"cleaner wanted" OR "looking for a cleaner" OR "need a cleaner" OR "house cleaner needed" OR "housekeeper wanted" OR "cleaning help needed"';

async function serpGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  return res.json();
}

/** Google Jobs — stable google.com listing links, apply links as fallback. */
export async function scrapeGoogleJobs(primaryCity: string, key: string): Promise<RawJob[]> {
  const q = `${HIRE_QUERY} ${primaryCity} ON`;
  const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(q)}&hl=en&gl=ca&api_key=${key}`;
  const data = await serpGet(url);
  const results = (data.jobs_results as SerpJob[]) || [];
  return results.slice(0, 15).map((j): RawJob => {
    const desc = j.description || '';
    const applyLinks = (j.apply_options || []).map((o) => o.link).filter((l): l is string => !!l);
    return {
      title: j.title || 'Cleaner Wanted',
      pay: j.detected_extensions?.salary || '',
      location: j.location || extractLocation(`${j.title} ${desc}`) || `${primaryCity}, ON`,
      posted: j.detected_extensions?.posted_at || '',
      description: desc || 'No description provided.',
      service_type: getCategory(`${j.title} ${desc}`),
      source: 'google_jobs',
      phone: extractPhone(`${j.title} ${desc}`),
      candidates: [j.share_link || '', ...applyLinks].filter(Boolean)
    };
  });
}

/** Kijiji hire-intent posts via Google organic (jobs category, services excluded by URL). */
export async function scrapeKijiji(cities: string[], key: string): Promise<RawJob[]> {
  const cityClause = cities.map((c) => `"${c}"`).join(' OR ');
  const q = `site:kijiji.ca ("looking for a cleaner" OR "need a cleaner" OR "cleaner wanted" OR "cleaner needed" OR "housekeeper wanted") (${cityClause}) -"we offer" -"i offer" -"book now"`;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&hl=en&gl=ca&num=20&api_key=${key}`;
  const data = await serpGet(url);
  const results = (data.organic_results as OrganicResult[]) || [];
  return results.slice(0, 15).map((r): RawJob => {
    const desc = r.snippet || '';
    return {
      title: (r.title || 'Kijiji Cleaner Request').replace(/\s*\|\s*Kijiji.*$/i, ''),
      pay: '',
      location: extractLocation(`${r.title} ${desc}`) || `${cities[0]}, ON`,
      posted: r.date || '',
      description: desc || 'Hire request posted on Kijiji.',
      service_type: getCategory(`${r.title} ${desc}`),
      source: 'kijiji',
      phone: extractPhone(`${r.title} ${desc}`),
      candidates: [r.link || '']
    };
  });
}

/** Public Facebook group hire requests via Google organic. */
export async function scrapeFacebookOrganic(cities: string[], key: string): Promise<RawJob[]> {
  const cityClause = cities.map((c) => `"${c}"`).join(' OR ');
  const q = `site:facebook.com/groups ("looking for a cleaner" OR "need a cleaner" OR "cleaner needed" OR "recommend a cleaner" OR "cleaner wanted") (${cityClause})`;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&hl=en&gl=ca&num=20&api_key=${key}`;
  const data = await serpGet(url);
  const results = (data.organic_results as OrganicResult[]) || [];
  return results.slice(0, 12).map((r): RawJob => {
    const desc = r.snippet || '';
    return {
      title: (r.title || 'Facebook Cleaner Request').replace(/\s*\|\s*Facebook.*$/i, ''),
      pay: '',
      location: extractLocation(`${r.title} ${desc}`) || `${cities[0]}, ON`,
      posted: r.date || '',
      description: desc || 'Public Facebook group post requesting a cleaner.',
      service_type: getCategory(`${r.title} ${desc}`),
      source: 'facebook',
      phone: extractPhone(`${r.title} ${desc}`),
      candidates: [r.link || '']
    };
  });
}

/* ------------------------------------------------------------------ */
/* Apify sources                                                       */
/* ------------------------------------------------------------------ */

/** Generic Apify actor runner using run-sync-get-dataset-items. */
async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  opts: { maxItems?: number; timeoutMs?: number } = {}
): Promise<Record<string, unknown>[]> {
  const { maxItems = 40, timeoutMs = 50000 } = opts;
  const apiSeconds = Math.max(30, Math.floor(timeoutMs / 1000));
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&maxItems=${maxItems}&timeout=${apiSeconds}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Apify ${actorId} HTTP ${res.status}`);
    const items = await res.json();
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function firstStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/**
 * Apify Indeed scraper. Runs once for the region (Indeed returns nearby cities),
 * dropping expired postings. Default actor: misceres~indeed-scraper.
 */
export async function scrapeApifyIndeed(primaryCity: string, token: string, actorId: string): Promise<RawJob[]> {
  // Indeed cold-start + scrape must finish inside the function budget, so keep
  // the item count modest (a 15-item run completes in ~30s).
  const items = await runApifyActor(
    actorId,
    { position: 'house cleaner', location: `${primaryCity}, ON`, country: 'CA', maxItems: 15 },
    token,
    { maxItems: 15, timeoutMs: 45000 }
  );
  return items
    .filter((it) => it.isExpired !== true)
    .map((it): RawJob => {
      const title = firstStr(it, ['positionName', 'title', 'jobTitle']) || 'Cleaner Wanted';
      const desc = str(firstStr(it, ['description', 'descriptionText'])).slice(0, 700);
      const url = firstStr(it, ['url', 'jobUrl', 'link', 'externalApplyLink']);
      return {
        title,
        pay: firstStr(it, ['salary']),
        location: firstStr(it, ['location']) || extractLocation(`${title} ${desc}`) || `${primaryCity}, ON`,
        posted: firstStr(it, ['postedAt', 'postingDateParsed', 'date']),
        description: desc || 'Cleaning role posted on Indeed.',
        service_type: getCategory(`${title} ${desc}`),
        source: 'indeed',
        phone: extractPhone(`${title} ${desc}`),
        candidates: [url]
      };
    });
}

/**
 * Apify Facebook Groups scraper over curated public group URLs.
 * Default actor: apify~facebook-groups-scraper. Only runs when group URLs given.
 */
export async function scrapeApifyFacebookGroups(
  groupUrls: string[],
  token: string,
  actorId: string,
  cities: string[]
): Promise<RawJob[]> {
  if (!groupUrls.length) return [];
  const items = await runApifyActor(
    actorId,
    {
      startUrls: groupUrls.map((u) => ({ url: u })),
      resultsLimit: 40,
      maxPosts: 40
    },
    token,
    { maxItems: 60, timeoutMs: 50000 }
  );
  const cityLc = cities.map((c) => c.toLowerCase());
  return items
    .map((it): RawJob => {
      const text = firstStr(it, ['text', 'message', 'content', 'postText', 'title']);
      const url = firstStr(it, ['url', 'postUrl', 'permalink', 'facebookUrl', 'link']);
      const title = (text.split('\n')[0] || 'Facebook cleaner request').slice(0, 90);
      return {
        title,
        pay: '',
        location: extractLocation(text) || `${cities[0]}, ON`,
        posted: firstStr(it, ['time', 'date', 'publishedTime', 'timestamp']),
        description: text.slice(0, 500) || 'Facebook group post.',
        service_type: getCategory(text),
        source: 'facebook',
        phone: extractPhone(text),
        candidates: [url]
      };
    })
    .filter((j) => cityLc.length === 0 || cityLc.some((c) => `${j.description} ${j.location} ${j.title}`.toLowerCase().includes(c)));
}
