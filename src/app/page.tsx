'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Radar, 
  Store, 
  RefreshCw, 
  Sparkles, 
  ExternalLink, 
  TrendingUp, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  MapPin,
  Check,
  Search,
  MessageSquare,
  Clock,
  Phone,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  BookOpen
} from 'lucide-react';

interface Competitor {
  name: string;
  reviewCount: number;
  rating: number;
  rank: number;
}

interface CompetitorRadarResponse {
  suburb: string;
  keyword: string;
  status: 'GO' | 'NO-GO';
  weakCount: number;
  competitors: Competitor[];
}

interface GbpListing {
  id?: string;
  name: string;
  city: string;
  review_count: number;
  google_review_link: string;
  created_at?: string;
  competitors?: {
    id: string;
    gbp_listing_id: string;
    name: string;
    review_count: number;
    rating: number;
    rank: number;
    scanned_at: string;
  }[];
}

interface GbpPostResponse {
  success: boolean;
  usedAI: boolean;
  city: string;
  charCount: number;
  keywordOccurrences: number;
  postContent: string;
}

interface ScrapedJob {
  title: string;
  pay: string;
  location: string;
  url: string;
  posted: string;
  description: string;
  service_type: 'residential' | 'commercial' | 'construction';
  source?: 'craigslist' | 'kijiji' | 'indeed' | 'housekeeper';
}

interface DispatchRun {
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

const calculateFrontendPrices = (beds: number, baths: number, isDeepClean: boolean) => {
  let retail = 140;
  let wholesale = 85;

  if (beds === 1 && baths === 1) {
    retail = 140;
    wholesale = 85;
  } else if (beds === 2 && baths === 1) {
    retail = 190;
    wholesale = 115;
  } else if (beds === 3 && baths === 2) {
    retail = 250;
    wholesale = 155;
  } else if (beds === 4 && baths === 2) {
    retail = 310;
    wholesale = 195;
  } else {
    const additionalBeds = Math.max(0, beds - 1);
    const additionalBaths = Math.max(0, baths - 1);
    retail = 140 + (additionalBeds * 50) + (additionalBaths * 60);
    wholesale = 85 + (additionalBeds * 30) + (additionalBaths * 40);
  }

  if (isDeepClean) {
    retail += 70;
    wholesale += 35;
  }

  return { retail, wholesale, profit: retail - wholesale };
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'radar' | 'gbp' | 'job-radar' | 'reviews' | 'mission' | 'guide'>('home');

  // Mission Control - Softphone States
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'ringing' | 'in-call'>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeCallName, setActiveCallName] = useState('');

  // Mission Control - Calculator States
  const [calcBeds, setCalcBeds] = useState(1);
  const [calcBaths, setCalcBaths] = useState(1);
  const [calcIsDeep, setCalcIsDeep] = useState(false);

  // Mission Control - Booking Form States
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingAddress, setBookingAddress] = useState('');
  const [bookingCity, setBookingCity] = useState('Oakville');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingFrequency, setBookingFrequency] = useState<'one-off' | 'weekly' | 'bi-weekly' | 'monthly'>('one-off');
  
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingError, setBookingError] = useState('');

  // Active Cleaner Dispatches States
  const [dispatchesList, setDispatchesList] = useState<DispatchRun[]>([]);
  const [dispatchesLoading, setDispatchesLoading] = useState(false);
  
  // Competitor Radar States
  const [radarCity, setRadarCity] = useState('Oakville');
  const [radarKeyword, setRadarKeyword] = useState('house cleaning');
  const [radarResult, setRadarResult] = useState<CompetitorRadarResponse | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState('');

  // Job Radar States
  const [scrapedJobs, setScrapedJobs] = useState<ScrapedJob[]>([]);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperCity, setScraperCity] = useState('Oakville');
  const [scraperError, setScraperError] = useState('');

  // GBP States
  const [gbpListings, setGbpListings] = useState<GbpListing[]>([]);
  const [gbpSyncing, setGbpSyncing] = useState(false);
  const [activeGbpPosts, setActiveGbpPosts] = useState<Record<string, GbpPostResponse>>({});
  const [gbpPostingIds, setGbpPostingIds] = useState<Record<string, boolean>>({});
  const [postServiceTypes, setPostServiceTypes] = useState<Record<string, string>>({});

  // Stats (derived/mocked for display)
  const totalJobs = 148;
  const activeCleaners = 32;
  const totalRevenue = 32400;

  // On page load, fetch synced GBP listings and active dispatches
  useEffect(() => {
    fetchGbpListings(false, 'GET');
    fetchDispatches();
  }, []);

  // Call duration timer hook
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phoneStatus === 'in-call') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [phoneStatus]);

  const fetchDispatches = async () => {
    setDispatchesLoading(true);
    try {
      const res = await fetch('/api/dispatch/status');
      if (res.ok) {
        const data = await res.json();
        setDispatchesList(data.dispatches || []);
      }
    } catch (err) {
      console.error('Error fetching active dispatches:', err);
    } finally {
      setDispatchesLoading(false);
    }
  };

  const handleSimulateTimeout = async (jobId: string) => {
    try {
      const res = await fetch('/api/dispatch/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_timeout', job_id: jobId })
      });
      if (res.ok) {
        fetchDispatches();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to simulate timeout.');
      }
    } catch (err) {
      console.error('Timeout simulation error:', err);
    }
  };

  const handleSimulateClaim = async (jobId: string, cleanerName: string, cleanerPhone: string) => {
    try {
      const res = await fetch('/api/dispatch/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_claim',
          job_id: jobId,
          cleaner_name: cleanerName,
          cleaner_phone: cleanerPhone
        })
      });
      if (res.ok) {
        fetchDispatches();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to simulate claim.');
      }
    } catch (err) {
      console.error('Claim simulation error:', err);
    }
  };

  const handleResetDispatches = async () => {
    if (!confirm('Are you sure you want to clear all active dispatch machine records?')) return;
    try {
      const res = await fetch('/api/dispatch/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      if (res.ok) {
        fetchDispatches();
      }
    } catch (err) {
      console.error('Reset dispatches error:', err);
    }
  };

  const handleBookJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingPhone || !bookingAddress || !bookingDate) {
      setBookingError('Please fill out all booking fields.');
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    setBookingSuccess('');

    try {
      const res = await fetch('/api/jobs/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: bookingName,
          customer_phone: bookingPhone,
          city: bookingCity,
          beds: calcBeds,
          baths: calcBaths,
          is_deep_clean: calcIsDeep,
          appointment_time: bookingDate,
          address: bookingAddress,
          recurring_frequency: bookingFrequency
        })
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        setBookingSuccess(`Job successfully booked! ID: ${data.job_id}. Dispatch broadcast triggered.`);
        // Reset form
        setBookingName('');
        setBookingPhone('');
        setBookingAddress('');
        // Sync lists
        fetchDispatches();
        // Shift active tab to reviews tab to observe FSM
        setTimeout(() => {
          setActiveTab('reviews');
        }, 1500);
      } else {
        setBookingError(data.error || 'Failed to book job.');
      }
    } catch (err) {
      console.error('Booking submission error:', err);
      setBookingError('Network error. Check your backend status.');
    } finally {
      setBookingLoading(false);
    }
  };

  const triggerInboundCallSimulation = (name: string, phone: string, address: string, city: string, beds: number, baths: number, isDeep: boolean) => {
    setPhoneStatus('ringing');
    setPhoneNumber(phone);
    setActiveCallName(name);

    setCalcBeds(beds);
    setCalcBaths(baths);
    setCalcIsDeep(isDeep);

    setBookingName(name);
    setBookingPhone(phone);
    setBookingAddress(address);
    setBookingCity(city);

    // Set appointment date/time to tomorrow at 9:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const offset = tomorrow.getTimezoneOffset();
    const localTomorrow = new Date(tomorrow.getTime() - (offset * 60 * 1000));
    setBookingDate(localTomorrow.toISOString().slice(0, 16));
  };

  const fetchGbpListings = async (showSyncIndicator = false, method = 'GET') => {
    if (showSyncIndicator) setGbpSyncing(true);
    try {
      const res = await fetch('/api/gbp-sync', { method });
      if (res.ok) {
        const data = await res.json();
        setGbpListings(data.listings || []);
      }
    } catch (err) {
      console.error('Error fetching GBP listings:', err);
    } finally {
      if (showSyncIndicator) setGbpSyncing(false);
    }
  };



  const handleRunRadar = async (e: React.FormEvent) => {
    e.preventDefault();
    setRadarLoading(true);
    setRadarError('');
    setRadarResult(null);

    try {
      const res = await fetch('/api/competitor-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: radarCity, keyword: radarKeyword })
      });

      if (!res.ok) {
        throw new Error('Failed to run competitor radar scan.');
      }

      const data = await res.json();
      setRadarResult(data);
      // Fetch updated listings to refresh the review gap benchmarks
      fetchGbpListings(false, 'GET');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred.';
      setRadarError(errMsg);
    } finally {
      setRadarLoading(false);
    }
  };

  const handleScanClassifieds = async (e: React.FormEvent) => {
    e.preventDefault();
    setScraperLoading(true);
    setScraperError('');
    setScrapedJobs([]);

    try {
      const res = await fetch('/api/job-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: scraperCity })
      });

      if (!res.ok) {
        throw new Error('Failed to scan classified listings.');
      }

      const data = await res.json();
      setScrapedJobs(data.jobs || []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred during scanning.';
      setScraperError(errMsg);
    } finally {
      setScraperLoading(false);
    }
  };

  const handleImportJob = (job: ScrapedJob) => {
    // Parse city name
    const cityPart = job.location.split(',')[0].trim();
    
    // Parse beds/baths from title/description
    let beds = 2;
    let baths = 1;
    let isDeep = false;

    const fullText = (job.title + ' ' + job.description).toLowerCase();
    
    const bedMatch = fullText.match(/(\d+)\s*(?:bed|bd)/);
    if (bedMatch) beds = Math.max(1, Math.min(6, parseInt(bedMatch[1])));

    const bathMatch = fullText.match(/(\d+)\s*(?:bath|ba)/);
    if (bathMatch) baths = Math.max(1, Math.min(4, parseInt(bathMatch[1])));

    if (fullText.includes('deep') || fullText.includes('sparkle') || fullText.includes('final') || fullText.includes('renov') || fullText.includes('post-construction')) {
      isDeep = true;
    }

    setCalcBeds(beds);
    setCalcBaths(baths);
    setCalcIsDeep(isDeep);

    setBookingName(`Lead: ${job.title.length > 35 ? job.title.slice(0, 35) + '...' : job.title}`);
    setBookingPhone('+19055550199');
    setBookingAddress(`Source: ${job.url}`);
    setBookingCity(cityPart);

    // Set appointment to tomorrow at 9:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const offset = tomorrow.getTimezoneOffset();
    const localTomorrow = new Date(tomorrow.getTime() - (offset * 60 * 1000));
    setBookingDate(localTomorrow.toISOString().slice(0, 16));

    // Clear previous alerts and switch tab
    setBookingError('');
    setBookingSuccess('Classified gig details successfully imported! Review price and confirm.');
    setActiveTab('mission');
  };

  const handleGenerateWeeklyPost = async (listing: GbpListing) => {
    const listingKey = listing.city;
    const serviceType = postServiceTypes[listingKey] || 'residential';
    setGbpPostingIds(prev => ({ ...prev, [listingKey]: true }));
    try {
      const res = await fetch('/api/gbp-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          city: listing.city, 
          gbp_listing_id: listing.id,
          service_type: serviceType
        })
      });

      if (!res.ok) throw new Error('Failed to generate GBP post.');

      const data = await res.json();
      setActiveGbpPosts(prev => ({ ...prev, [listingKey]: data }));
    } catch (err) {
      console.error('Error generating post:', err);
      alert('Failed to generate SEO post. Check your server logs.');
    } finally {
      setGbpPostingIds(prev => ({ ...prev, [listingKey]: false }));
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-neutral-800 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-indigo-600/30">
              C
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide">THE CLEANER 9,000</h1>
              <p className="text-xs text-neutral-400 font-medium">AUTOMATOR v2.0</p>
            </div>
          </div>
          
          <nav className="p-4 space-y-1.5">
            <button 
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'home' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard Home</span>
            </button>

            <button 
              onClick={() => setActiveTab('radar')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'radar' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <Radar size={18} />
              <span>Market Intel (Radar)</span>
            </button>

            <button 
              onClick={() => setActiveTab('gbp')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'gbp' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <Store size={18} />
              <span>GBP Manager</span>
            </button>

            <button 
              onClick={() => setActiveTab('job-radar')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'job-radar' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <Search size={18} />
              <span>Job Radar (Craigslist)</span>
            </button>

            <button 
              onClick={() => setActiveTab('mission')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'mission' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <PhoneCall size={18} />
              <span>Mission Control</span>
            </button>

            <button 
              onClick={() => setActiveTab('reviews')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'reviews' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <MessageSquare size={18} />
              <span>Dispatch Board</span>
            </button>

            <button 
              onClick={() => setActiveTab('guide')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'guide' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              <BookOpen size={18} />
              <span>How-To Guide</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-neutral-800">
          <div className="bg-neutral-950/60 rounded-xl p-3 border border-neutral-800/80">
            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Console Connected</span>
            </div>
            <p className="text-[10px] text-neutral-400">Manual call scripts and pricing calculators active.</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold tracking-tight capitalize">
            {activeTab === 'home' && "Operational Overview"}
            {activeTab === 'radar' && "Competitor Radar"}
            {activeTab === 'gbp' && "Google Business Profile Sync"}
            {activeTab === 'job-radar' && "Classifieds Job Radar (Craigslist)"}
            {activeTab === 'reviews' && "Live Cleaner Dispatch Board"}
            {activeTab === 'mission' && "Mission Control (Call Console)"}
            {activeTab === 'guide' && "How-To Guide & Operational Flow"}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-300 font-medium border border-neutral-700">
              GTA Region
            </span>
          </div>
        </header>

        <div className="p-8 max-w-6xl w-full mx-auto space-y-8">
          
          {/* ==================== TAB: HOME ==================== */}
          {activeTab === 'home' && (
            <div className="space-y-8">
              {/* STAT CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex items-center justify-between hover:border-neutral-700 transition-all">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Total Active Jobs</p>
                    <h3 className="text-2xl font-bold">{totalJobs}</h3>
                  </div>
                  <div className="p-3.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <TrendingUp size={22} />
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex items-center justify-between hover:border-neutral-700 transition-all">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Estimated Revenue</p>
                    <h3 className="text-2xl font-bold">${totalRevenue.toLocaleString()}</h3>
                  </div>
                  <div className="p-3.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <DollarSign size={22} />
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex items-center justify-between hover:border-neutral-700 transition-all">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Active Cleaners</p>
                    <h3 className="text-2xl font-bold">{activeCleaners}</h3>
                  </div>
                  <div className="p-3.5 bg-blue-500/10 rounded-xl text-blue-400">
                    <Users size={22} />
                  </div>
                </div>
              </div>

              {/* REVIEW GAP STATUS */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-100">Review Gap Monitor</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Comparing synced GBP counts against top competitor benchmarks.</p>
                  </div>
                  <button 
                    onClick={() => fetchGbpListings(true, 'GET')} 
                    disabled={gbpSyncing}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 text-xs font-medium rounded-lg text-neutral-200 transition-all"
                  >
                    <RefreshCw size={14} className={gbpSyncing ? 'animate-spin' : ''} />
                    <span>Sync Metrics</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {gbpListings.length === 0 ? (
                    <div className="p-12 text-center">
                      <Store className="mx-auto text-neutral-600 mb-3" size={32} />
                      <p className="text-sm text-neutral-400 mb-4">No listings synced yet.</p>
                      <button 
                        onClick={() => fetchGbpListings(true, 'POST')} 
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition-all"
                      >
                        Sync Profiles
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-neutral-950/40 text-neutral-400 border-b border-neutral-800 text-xs uppercase font-semibold">
                          <th className="px-6 py-4">City</th>
                          <th className="px-6 py-4">Our Profile Name</th>
                          <th className="px-6 py-4 text-center">Our Reviews</th>
                          <th className="px-6 py-4 text-center">Benchmark (Top 3 Max)</th>
                          <th className="px-6 py-4 text-center">Review Gap</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-850">
                        {gbpListings.map((listing) => {
                          // Default benchmarks if no competitors scanned yet
                          const benchmarks: Record<string, number> = {
                            Mississauga: 220,
                            Oakville: 310,
                            Brampton: 68,
                            Vaughan: 110,
                            Scarborough: 120
                          };
                          const dbMax = listing.competitors && listing.competitors.length > 0 
                            ? Math.max(...listing.competitors.map((c) => c.review_count)) 
                            : null;
                          const maxCompetitorReviews = dbMax !== null ? dbMax : (benchmarks[listing.city] || 150);
                          const gap = maxCompetitorReviews - listing.review_count;

                          return (
                            <tr key={listing.city} className="hover:bg-neutral-900/40 transition-colors">
                              <td className="px-6 py-4 font-semibold text-neutral-200 flex items-center space-x-2">
                                <MapPin size={14} className="text-neutral-500" />
                                <span>{listing.city}</span>
                              </td>
                              <td className="px-6 py-4 text-neutral-300 text-xs font-mono">{listing.name}</td>
                              <td className="px-6 py-4 text-center font-bold text-indigo-400">{listing.review_count}</td>
                              <td className="px-6 py-4 text-center text-neutral-400">{maxCompetitorReviews}</td>
                              <td className="px-6 py-4 text-center">
                                {gap <= 0 ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Check size={12} />
                                    <span>Leader ({Math.abs(gap)})</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <span>-{gap} reviews</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: RADAR ==================== */}
          {activeTab === 'radar' && (
            <div className="space-y-8">
              {/* RADAR CONTROL PANEL */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <form onSubmit={handleRunRadar} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">GTA Suburb / City</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-3.5 text-neutral-500" />
                      <input 
                        type="text" 
                        value={radarCity}
                        onChange={(e) => setRadarCity(e.target.value)}
                        placeholder="e.g. Oakville"
                        className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Service Keyword</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-3.5 text-neutral-500" />
                      <input 
                        type="text" 
                        value={radarKeyword}
                        onChange={(e) => setRadarKeyword(e.target.value)}
                        placeholder="e.g. house cleaning"
                        className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={radarLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                  >
                    {radarLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Analyzing Maps...</span>
                      </>
                    ) : (
                      <>
                        <Radar size={16} />
                        <span>Analyze Competitors</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* RADAR ERROR */}
              {radarError && (
                <div className="bg-rose-500/10 border border-rose-500/25 text-rose-400 p-4 rounded-xl flex items-center space-x-3 text-sm">
                  <AlertTriangle size={18} />
                  <span>{radarError}</span>
                </div>
              )}

              {/* RADAR RESULTS */}
              {radarResult && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* TRAFFIC LIGHT GO/NO-GO CARD */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between items-center text-center">
                    <h3 className="font-semibold text-neutral-300 text-sm tracking-wider uppercase mb-4">THE CLEANER 9,000 Threshold Verdict</h3>
                    
                    <div className="flex flex-col items-center">
                      {radarResult.status === 'GO' ? (
                        <>
                          <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
                            <CheckCircle2 size={48} />
                          </div>
                          <span className="text-3xl font-extrabold text-emerald-400 tracking-wide">GO</span>
                        </>
                      ) : (
                        <>
                          <div className="w-24 h-24 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                            <XCircle size={48} />
                          </div>
                          <span className="text-3xl font-extrabold text-rose-400 tracking-wide">NO-GO</span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed max-w-[240px] mt-6">
                      {radarResult.status === 'GO' 
                        ? `Market is winnable. ${radarResult.weakCount} of the top 3 ranking business profiles have fewer than 100 reviews.`
                        : `Market is saturated. Only ${radarResult.weakCount} of the top 3 ranking business profiles have fewer than 100 reviews.`
                      }
                    </p>
                  </div>

                  {/* COMPETITOR TABLE */}
                  <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                    <div className="p-6 border-b border-neutral-800">
                      <h3 className="font-semibold text-neutral-100">Top 3 Organic Google Maps Competitors</h3>
                      <p className="text-xs text-neutral-400 mt-0.5">Scanned for &quot;{radarResult.suburb}&quot; using Maps metadata.</p>
                    </div>

                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-neutral-950/40 text-neutral-400 border-b border-neutral-800 text-xs uppercase font-semibold">
                            <th className="px-6 py-4 text-center">Rank</th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4 text-center">Reviews</th>
                            <th className="px-6 py-4 text-center">Avg Rating</th>
                            <th className="px-6 py-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-850">
                          {radarResult.competitors.map((comp) => (
                            <tr key={comp.rank} className="hover:bg-neutral-900/40 transition-colors">
                              <td className="px-6 py-4 text-center font-bold text-neutral-400">#{comp.rank}</td>
                              <td className="px-6 py-4 font-semibold text-neutral-200">{comp.name}</td>
                              <td className="px-6 py-4 text-center font-bold text-neutral-300">{comp.reviewCount}</td>
                              <td className="px-6 py-4 text-center text-amber-400 font-bold">{comp.rating.toFixed(1)} ★</td>
                              <td className="px-6 py-4 text-center">
                                {comp.reviewCount < 100 ? (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                                    Vulnerable
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 rounded-full">
                                    Established
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB: GBP ==================== */}
          {activeTab === 'gbp' && (
            <div className="space-y-8">
              {/* GBP LISTINGS & AI WRITER */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-100">Active Service Area listings</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Profiles manually created with exact-match naming strategies and synced to THE CLEANER 9,000.</p>
                  </div>
                  <button 
                    onClick={() => fetchGbpListings(true, 'POST')}
                    disabled={gbpSyncing}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-xl text-white shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    <RefreshCw size={14} className={gbpSyncing ? 'animate-spin' : ''} />
                    <span>Sync active Profiles</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {gbpListings.length === 0 ? (
                    <div className="p-12 text-center">
                      <Store className="mx-auto text-neutral-600 mb-3" size={32} />
                      <p className="text-sm text-neutral-400">Click the sync button above to sync active GBPs.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-850">
                      {gbpListings.map((listing) => {
                        const listingKey = listing.city;
                        const post = activeGbpPosts[listingKey];
                        const isGenerating = gbpPostingIds[listingKey];

                        return (
                          <div key={listing.city} className="p-6 space-y-4 hover:bg-neutral-900/20 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start space-x-3.5">
                                <div className="p-2.5 bg-neutral-800 rounded-xl text-neutral-300 border border-neutral-700/60">
                                  <Store size={20} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-neutral-200">{listing.name}</h4>
                                  <div className="flex items-center space-x-3 text-xs text-neutral-400 mt-1">
                                    <span className="flex items-center space-x-1">
                                      <MapPin size={12} />
                                      <span>{listing.city}</span>
                                    </span>
                                    <span>•</span>
                                    <span>{listing.review_count} Reviews</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                <a 
                                  href={listing.google_review_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold rounded-lg text-neutral-300 border border-neutral-700 transition-all"
                                >
                                  <span>Review Link</span>
                                  <ExternalLink size={12} />
                                </a>

                                <select
                                  value={postServiceTypes[listing.city] || 'residential'}
                                  onChange={(e) => setPostServiceTypes(prev => ({ ...prev, [listing.city]: e.target.value }))}
                                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 transition-all"
                                >
                                  <option value="residential">Residential (Maids)</option>
                                  <option value="commercial">Commercial (Buildings)</option>
                                  <option value="construction">Post-Construction (Sites)</option>
                                </select>

                                <button 
                                  onClick={() => handleGenerateWeeklyPost(listing)}
                                  disabled={isGenerating}
                                  className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 text-xs font-semibold rounded-lg text-white shadow-md shadow-indigo-600/10 transition-all"
                                >
                                  <Sparkles size={13} />
                                  <span>{isGenerating ? 'Generating...' : 'Generate & Post SEO Update'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Generated Post Box */}
                            {post && (
                              <div className="bg-neutral-950/70 border border-neutral-850 rounded-xl p-4 space-y-3 animate-fadeIn">
                                <div className="flex items-center justify-between text-xs border-b border-neutral-900 pb-2">
                                  <span className="text-neutral-400 font-semibold flex items-center space-x-1.5">
                                    <Sparkles size={12} className="text-indigo-400" />
                                    <span>Google Business Profile SEO Draft</span>
                                  </span>
                                  <div className="flex items-center space-x-4 text-neutral-400">
                                    <span>Characters: <b className="text-neutral-300">{post.charCount}/750</b></span>
                                    <span>Keyword Occurrences: <b className="text-indigo-400">{post.keywordOccurrences}x</b></span>
                                  </div>
                                </div>
                                <p className="text-sm text-neutral-300 leading-relaxed font-sans">{post.postContent}</p>
                                <div className="flex items-center space-x-2 text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10 w-fit">
                                  <CheckCircle2 size={11} />
                                  <span>Simulated publish to localPosts API endpoint completed successfully</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: JOB RADAR ==================== */}
          {activeTab === 'job-radar' && (
            <div className="space-y-8 animate-fadeIn">
              {/* CONTROL BAR */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <form onSubmit={handleScanClassifieds} className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Target City / Suburb</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input 
                        type="text" 
                        value={scraperCity} 
                        onChange={(e) => setScraperCity(e.target.value)}
                        placeholder="e.g. Oakville, Ancaster, Mississauga"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-neutral-200 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={scraperLoading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold rounded-xl text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2"
                  >
                    <RefreshCw size={16} className={scraperLoading ? 'animate-spin' : ''} />
                    <span>{scraperLoading ? 'Scanning GTA Cleaning Gigs...' : 'Scan GTA Cleaning Gigs'}</span>
                  </button>
                </form>

                {scraperError && (
                  <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center space-x-2">
                    <XCircle size={14} />
                    <span>{scraperError}</span>
                  </div>
                )}
              </div>

              {/* SCRAPED JOBS LIST */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-neutral-800">
                  <h3 className="font-semibold text-base text-neutral-100">Scraped Cleaning Gigs & Contracts</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Scraped cleaning jobs and contracts from across Craigslist, Kijiji, Indeed, and Housekeeper.com. Review details and import to book.</p>
                </div>

                <div className="p-6">
                  {scrapedJobs.length === 0 ? (
                    <div className="py-12 text-center">
                      <Search className="mx-auto text-neutral-600 mb-3" size={36} />
                      <h4 className="text-sm font-semibold text-neutral-300">No scraped results found</h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">Enter a target city above, then click Scan to pull cleaning contracts from Craigslist, Kijiji, Indeed, and Housekeeper.com.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {scrapedJobs.map((job, idx) => (
                        <div key={idx} className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-5 space-y-4 hover:border-neutral-700 transition-all">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  job.service_type === 'construction'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : job.service_type === 'commercial'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }`}>
                                  {job.service_type.charAt(0).toUpperCase() + job.service_type.slice(1)}
                                </span>
                                {job.source && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    job.source === 'craigslist'
                                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                      : job.source === 'kijiji'
                                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                      : job.source === 'indeed'
                                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  }`}>
                                    {job.source.charAt(0).toUpperCase() + job.source.slice(1)}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-neutral-150 text-base leading-snug">{job.title}</h4>
                              <div className="flex items-center space-x-3 text-xs text-neutral-400 pt-1">
                                <span className="flex items-center space-x-1">
                                  <MapPin size={12} className="text-neutral-500" />
                                  <span>{job.location}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center space-x-1">
                                  <Clock size={12} className="text-neutral-500" />
                                  <span>{job.posted}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 self-start md:self-auto">
                              <span className="text-sm font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 rounded-lg">
                                {job.pay}
                              </span>
                              <a 
                                href={job.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg border border-neutral-700 transition-all"
                                title="Open Original Ad"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </div>
                          </div>

                          <p className="text-xs text-neutral-400 leading-relaxed bg-neutral-900/40 p-4.5 rounded-xl border border-neutral-900">
                            {job.description}
                          </p>

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleImportJob(job)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white shadow-md shadow-indigo-600/10 transition-all flex items-center space-x-1.5"
                            >
                              <Plus size={14} />
                              <span>Import to Booking Console</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: REVIEWS ==================== */}
          {activeTab === 'reviews' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* LIVE DISPATCH BOARD */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-100 flex items-center space-x-2">
                      <RefreshCw size={16} className={`text-indigo-400 ${dispatchesLoading ? 'animate-spin' : ''}`} />
                      <span>Live Cleaner Dispatch Board</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Monitor active FSM dispatch instances broadcasting regional job alerts.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={fetchDispatches}
                      disabled={dispatchesLoading}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg flex items-center space-x-1"
                    >
                      <RefreshCw size={12} className={dispatchesLoading ? 'animate-spin' : ''} />
                      <span>Refresh</span>
                    </button>
                    <button 
                      onClick={handleResetDispatches}
                      className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-300 text-xs font-semibold rounded-lg flex items-center space-x-1"
                    >
                      <Trash2 size={12} />
                      <span>Reset Dispatches</span>
                    </button>
                  </div>
                </div>

                {dispatchesList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    No active dispatches. Book a new job in the <b>Mission Control</b> tab to launch the FSM.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dispatchesList.map((d) => {
                      const formattedTime = new Date(d.appointment_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + new Date(d.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      return (
                        <div key={d.job_id} className="bg-neutral-950/50 border border-neutral-800/80 rounded-xl p-4 space-y-3 relative overflow-hidden">
                          {/* Top Status Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-mono text-neutral-455">JOB ID: {d.job_id.substring(0, 12)}</div>
                              <h4 className="font-bold text-neutral-200 text-sm">{d.customer_name}</h4>
                            </div>
                            
                            {/* Badges mapped to FSM status */}
                            <div>
                              {d.status === 'BOOKING_CONFIRMED' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                                  Confirmed
                                </span>
                              )}
                              {d.status === 'DISPATCH_BROADCAST' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                                  Broadcasting...
                                </span>
                              )}
                              {d.status === 'AWAITING_RESPONSE' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  Awaiting YES (Try {d.attempts})
                                </span>
                              )}
                              {d.status === 'ASSIGNED' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                                  Assigned
                                </span>
                              )}
                              {d.status === 'CONFIRMED' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  FSM Confirmed
                                </span>
                              )}
                              {d.status === 'ALERT_OPERATOR' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-450 border border-rose-500/20 animate-bounce">
                                  Operator Alert!
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Details Row */}
                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-neutral-900 pt-2.5">
                            <div>
                              <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Location:</span>
                              <span className="text-neutral-300 font-medium">{d.address}, {d.city}</span>
                            </div>
                            <div>
                              <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Region Segment:</span>
                              <span className="text-indigo-400 font-medium capitalize">{d.region} GTA</span>
                            </div>
                            <div>
                              <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Appointment:</span>
                              <span className="text-neutral-300 font-medium">{formattedTime}</span>
                            </div>
                            <div>
                              <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Prices (Wholesale / Retail):</span>
                              <span className="text-neutral-350 font-medium">${d.wholesale_price} / ${d.retail_price}</span>
                            </div>
                          </div>

                          {/* Cleaner details if assigned */}
                          {(d.status === 'ASSIGNED' || d.status === 'CONFIRMED') && d.assigned_contractor_name && (
                            <div className="bg-emerald-950/30 border border-emerald-900/40 p-2.5 rounded-lg text-xs space-y-1">
                              <div className="font-semibold text-emerald-450">Cleaner Claimed Job:</div>
                              <div className="text-neutral-300">{d.assigned_contractor_name} ({d.assigned_contractor_phone})</div>
                            </div>
                          )}

                          {/* FSM simulator action buttons */}
                          {d.status === 'AWAITING_RESPONSE' && (
                            <div className="flex items-center space-x-2 pt-2 border-t border-neutral-900">
                              <button
                                onClick={() => handleSimulateClaim(d.job_id, 'Alice Green', '+19055550191')}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded transition-all animate-pulse"
                              >
                                Simulate Claim
                              </button>
                              <button
                                onClick={() => handleSimulateTimeout(d.job_id)}
                                className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[10px] font-bold rounded border border-neutral-700 transition-all"
                              >
                                Simulate Timeout (15m)
                              </button>
                            </div>
                          )}

                          {d.status === 'ALERT_OPERATOR' && (
                            <div className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg text-xs space-y-1">
                              <div className="font-semibold text-rose-450">Timeout Reached (3 attempts):</div>
                              <p className="text-[10px] text-neutral-400">No regional cleaners claimed. Call backup agency or assign manually.</p>
                              <button
                                onClick={() => handleSimulateClaim(d.job_id, 'Agency Contractor', '+14165559999')}
                                className="w-full mt-1.5 py-1.5 bg-rose-900/50 hover:bg-rose-900/70 text-rose-200 text-[10px] font-bold rounded border border-rose-800/40"
                              >
                                Assign Agency Backup
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* REVIEW GAP COMPARATOR PROGRESS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gbpListings.map((listing) => {
                  const benchmarks: Record<string, number> = {
                    Mississauga: 220,
                    Oakville: 310,
                    Brampton: 68,
                    Vaughan: 110,
                    Scarborough: 120
                  };
                  const dbMax = listing.competitors && listing.competitors.length > 0 
                    ? Math.max(...listing.competitors.map((c) => c.review_count)) 
                    : null;
                  const competitorBenchmark = dbMax !== null ? dbMax : (benchmarks[listing.city] || 150);
                  const gap = competitorBenchmark - listing.review_count;
                  
                  // Calculate progress percentage
                  const pct = Math.min(100, Math.max(5, Math.round((listing.review_count / competitorBenchmark) * 100)));

                  return (
                    <div key={listing.city} className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl flex flex-col justify-between hover:border-neutral-750 transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-neutral-100 flex items-center space-x-1.5">
                            <MapPin size={14} className="text-neutral-500" />
                            <span>{listing.city}</span>
                          </span>
                          {gap <= 0 ? (
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
                              Leader
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-semibold">
                              Gap: -{gap}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 mb-4">
                          <div className="flex justify-between text-xs text-neutral-400">
                            <span>Our Reviews: <b className="text-indigo-400">{listing.review_count}</b></span>
                            <span>Benchmark: <b>{competitorBenchmark}</b></span>
                          </div>
                          
                          <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${gap <= 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-neutral-400 border-t border-neutral-850 pt-2.5 flex items-center justify-between">
                        <span>Review Deep Link:</span>
                        <a 
                          href={listing.google_review_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-0.5"
                        >
                          <span>Open link</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ==================== TAB: MISSION CONTROL ==================== */}
          {activeTab === 'mission' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
              
              {/* LEFT COLUMN: SOFTPHONE & SCRIPT */}
              <div className="space-y-8">
                
                {/* TWILIO WEBSOFTPHONE WIDGET */}
                <div className={`bg-neutral-900 border p-6 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                  phoneStatus === 'ringing' ? 'border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 
                  phoneStatus === 'in-call' ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-neutral-800'
                }`}>
                  {phoneStatus === 'ringing' && (
                    <div className="absolute inset-0 bg-amber-550/5 animate-pulse pointer-events-none"></div>
                  )}
                  {phoneStatus === 'in-call' && (
                    <div className="absolute inset-0 bg-emerald-550/5 pointer-events-none"></div>
                  )}

                  <div className="flex items-center justify-between mb-4 border-b border-neutral-850 pb-3">
                    <div>
                      <h3 className="font-semibold text-base text-neutral-100 flex items-center space-x-2">
                        <PhoneCall size={16} className="text-indigo-400 animate-pulse" />
                        <span>Manual Call & Script Console</span>
                      </h3>
                      <p className="text-[10px] text-neutral-400">GTA Dispatch Operator Center</p>
                    </div>
                    <div>
                      {phoneStatus === 'idle' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500"></span>
                          <span>Idle / Connected</span>
                        </span>
                      )}
                      {phoneStatus === 'ringing' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          <span>Inbound Ringing</span>
                        </span>
                      )}
                      {phoneStatus === 'in-call' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>In Call ({Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')})</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Softphone Dialer Interface */}
                  {phoneStatus === 'idle' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Outbound Dial Phone</label>
                        <div className="flex space-x-2">
                          <input 
                            type="text" 
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+19055550123"
                            className="flex-1 bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-255 transition-all"
                          />
                          <button
                            onClick={() => {
                              if (phoneNumber) {
                                setPhoneStatus('in-call');
                                setActiveCallName('Outbound Call');
                              } else {
                                alert('Enter a phone number to dial.');
                              }
                            }}
                            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                          >
                            <Phone size={12} />
                            <span>Dial</span>
                          </button>
                        </div>
                      </div>

                      {/* Inbound Simulator triggers */}
                      <div className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-xl space-y-3">
                        <div className="text-xs font-semibold text-neutral-300">Inbound Call Simulators:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => triggerInboundCallSimulation('Sarah Jenkins', '+19055550123', '1248 Lakeshore Rd', 'Oakville', 3, 2, false)}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-medium text-neutral-350 rounded-lg text-left space-y-1 transition-all"
                          >
                            <div className="font-bold text-neutral-250">Sarah Jenkins</div>
                            <div className="text-neutral-400">Oakville • 3B/2B</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerInboundCallSimulation('John Doe', '+14165550456', '789 Hurontario St', 'Mississauga', 1, 1, false)}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-medium text-neutral-355 rounded-lg text-left space-y-1 transition-all"
                          >
                            <div className="font-bold text-neutral-250">John Doe</div>
                            <div className="text-neutral-400">Mississauga • 1B/1B</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerInboundCallSimulation('Rajesh Patel', '+12895550789', '45 Main St S', 'Brampton', 2, 1, true)}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-medium text-neutral-360 rounded-lg text-left space-y-1 transition-all"
                          >
                            <div className="font-bold text-neutral-250">Rajesh Patel</div>
                            <div className="text-neutral-400">Brampton • 2B/1B + DC</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ringing incoming banner */}
                  {phoneStatus === 'ringing' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="bg-neutral-950 p-4 rounded-xl border border-amber-500/30 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 bg-amber-500/10 rounded-full text-amber-400 animate-bounce">
                            <PhoneCall size={20} />
                          </div>
                          <div>
                            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Incoming Request</div>
                            <h4 className="font-bold text-neutral-200 text-sm">{activeCallName || 'Unknown Caller'}</h4>
                            <p className="text-xs text-neutral-400 font-mono">{phoneNumber}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={() => setPhoneStatus('in-call')}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-emerald-650/20"
                        >
                          <Phone size={14} />
                          <span>Accept Call</span>
                        </button>
                        <button
                          onClick={() => setPhoneStatus('idle')}
                          className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-rose-650/20"
                        >
                          <PhoneOff size={14} />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active In-Call controls */}
                  {phoneStatus === 'in-call' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="bg-neutral-950 p-4 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 animate-pulse">
                            <Phone size={20} />
                          </div>
                          <div>
                            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">In-Call Connected</div>
                            <h4 className="font-bold text-neutral-200 text-sm">{activeCallName}</h4>
                            <p className="text-xs text-neutral-400 font-mono">{phoneNumber}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-1.5 transition-all ${
                            isMuted 
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                              : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-750 text-neutral-300'
                          }`}
                        >
                          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          <span>{isMuted ? 'Muted' : 'Mute'}</span>
                        </button>
                        <button
                          onClick={() => setPhoneStatus('idle')}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-rose-650/20"
                        >
                          <PhoneOff size={14} />
                          <span>Hang Up</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* DYNAMIC SCROLLABLE CALL SCRIPT */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col h-[400px]">
                  <div className="border-b border-neutral-850 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-100 text-sm">Interactive GTA Call Script</h3>
                      <p className="text-[10px] text-neutral-400">Coaching script updates live with calculator inputs.</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 bg-neutral-950 border border-neutral-800 text-indigo-400 rounded-full font-mono font-bold">
                      Flat-rate System
                    </span>
                  </div>

                  <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs text-neutral-300 leading-relaxed font-sans scrollbar-thin">
                    <div className="space-y-1.5">
                      <div className="font-bold text-indigo-455 text-[10px] uppercase tracking-wider">Step 1: Friendly Greeting</div>
                      <p className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">
                        &quot;Thank you for calling <b>THE CLEANER 9,000</b>! This is {activeCallName ? 'your operator' : 'the dispatch desk'} speaking, how can I help make your home sparkle today?&quot;
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-indigo-455 text-[10px] uppercase tracking-wider">Step 2: Bedrooms & Bathrooms Qualification</div>
                      <p className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">
                        &quot;To give you a precise quote, may I ask how many bedrooms and bathrooms are in your home? ...Excellent.&quot;
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-indigo-455 text-[10px] uppercase tracking-wider">Step 3: Presentation of Quote</div>
                      <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-850 space-y-2">
                        <p>
                          &quot;Great! For a <b>{calcBeds} Bed / {calcBaths} Bath</b> home in <b>{bookingCity}</b>, our standard retail flat rate is <b>${calculateFrontendPrices(calcBeds, calcBaths, calcIsDeep).retail}</b>.
                          {calcIsDeep ? ' This rate includes our Deep Clean add-on to ensure heavy grease, grime, and baseboards are detailed.' : ' This covers all living areas, kitchens, bathrooms, and dusting/mopping throughout.'}&quot;
                        </p>
                        <div className="border-t border-neutral-900 pt-2 flex items-center justify-between text-[10px]">
                          <span className="text-neutral-500 font-medium">Internal Margins:</span>
                          <span className="text-emerald-450 font-bold">Wholesale Payout: ${calculateFrontendPrices(calcBeds, calcBaths, calcIsDeep).wholesale} | Net Profit: ${calculateFrontendPrices(calcBeds, calcBaths, calcIsDeep).profit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-indigo-455 text-[10px] uppercase tracking-wider">Step 4: Close and Book</div>
                      <p className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">
                        &quot;We have local cleaners in your neighborhood ready. What date and time works best to schedule your booking? ...Perfect, I will lock that in and dispatch your cleaner immediately!&quot;
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: CALCULATOR & BOOKING FORM */}
              <div className="space-y-8">
                
                {/* INSTANT QUOTE CALCULATOR */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-100">GTA Quoting Engine</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Adjust beds/baths/deep clean to calculate client price vs cleaner payout.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Bedrooms</label>
                      <select 
                        value={calcBeds}
                        onChange={(e) => setCalcBeds(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-sm text-neutral-250 transition-all font-medium"
                      >
                        <option value={1}>1 Bed</option>
                        <option value={2}>2 Beds</option>
                        <option value={3}>3 Beds</option>
                        <option value={4}>4 Beds</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Bathrooms</label>
                      <select 
                        value={calcBaths}
                        onChange={(e) => setCalcBaths(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-sm text-neutral-250 transition-all font-medium"
                      >
                        <option value={1}>1 Bath</option>
                        <option value={2}>2 Baths</option>
                      </select>
                    </div>
                  </div>

                  {/* Deep Clean checkbox */}
                  <label className="flex items-center space-x-3 p-3 bg-neutral-950/40 hover:bg-neutral-950/75 border border-neutral-850 rounded-xl cursor-pointer transition-all">
                    <input 
                      type="checkbox"
                      checked={calcIsDeep}
                      onChange={(e) => setCalcIsDeep(e.target.checked)}
                      className="rounded border-neutral-800 text-indigo-650 focus:ring-0 w-4 h-4 bg-neutral-900"
                    />
                    <div>
                      <div className="text-xs font-semibold text-neutral-200">Include Deep Clean Add-On</div>
                      <div className="text-[10px] text-neutral-450 mt-0.5">+$70 Retail / +$35 Wholesale payout</div>
                    </div>
                  </label>

                  {/* Side-by-Side pricing cards */}
                  <div className="grid grid-cols-3 gap-3 border-t border-neutral-850 pt-4">
                    <div className="bg-neutral-950/60 border border-neutral-850 p-3.5 rounded-xl text-center">
                      <span className="text-[9px] text-neutral-500 uppercase tracking-wider block font-bold mb-1">Retail Flat-rate</span>
                      <span className="text-lg font-bold text-neutral-100">${calculateFrontendPrices(calcBeds, calcBaths, calcIsDeep).retail}</span>
                    </div>

                    <div className="bg-neutral-950/60 border border-neutral-850 p-3.5 rounded-xl text-center">
                      <span className="text-[9px] text-neutral-500 uppercase tracking-wider block font-bold mb-1">Contractor Payout</span>
                      <span className="text-lg font-bold text-indigo-400">${calculateFrontendPrices(calcBeds, calcBaths, calcIsDeep).wholesale}</span>
                    </div>

                    <div className="bg-emerald-950/30 border border-emerald-900/20 p-3.5 rounded-xl text-center">
                      <span className="text-[9px] text-emerald-500 uppercase tracking-wider block font-bold mb-1">Net Margin</span>
                      <span className="text-lg font-bold text-emerald-400">${calculateFrontendPrices(calcBeds, calcBaths, calcIsDeep).profit}</span>
                    </div>
                  </div>
                </div>

                {/* BOOK JOB FORM */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-100">Schedule & Register Booking</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Input customer metadata. Triggering books job in DB and launches regional FSM dispatch.</p>
                  </div>

                  <form onSubmit={handleBookJobSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Customer Name</label>
                        <input 
                          type="text" 
                          value={bookingName}
                          onChange={(e) => setBookingName(e.target.value)}
                          placeholder="Jane Doe"
                          className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-neutral-200 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Phone Number</label>
                        <input 
                          type="text" 
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          placeholder="+19055550123"
                          className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-200 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Address</label>
                      <input 
                        type="text" 
                        value={bookingAddress}
                        onChange={(e) => setBookingAddress(e.target.value)}
                        placeholder="123 Queen St W"
                        className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-neutral-200 transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">City (GTA Suburb)</label>
                        <select 
                          value={bookingCity}
                          onChange={(e) => setBookingCity(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-sm text-neutral-250 transition-all font-medium"
                        >
                          <option value="Oakville">Oakville (West)</option>
                          <option value="Mississauga">Mississauga (West)</option>
                          <option value="Brampton">Brampton (North)</option>
                          <option value="Vaughan">Vaughan (North)</option>
                          <option value="Scarborough">Scarborough (East)</option>
                          <option value="Toronto">Toronto (Central)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Appointment Time</label>
                        <input 
                          type="datetime-local" 
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-neutral-200 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Recurring Frequency</label>
                      <select 
                        value={bookingFrequency}
                        onChange={(e) => setBookingFrequency(e.target.value as 'one-off' | 'weekly' | 'bi-weekly' | 'monthly')}
                        className="w-full bg-neutral-950 border border-neutral-850 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-sm text-neutral-255 transition-all font-medium"
                      >
                        <option value="one-off">One-off Cleaning</option>
                        <option value="weekly">Weekly Recurring</option>
                        <option value="bi-weekly">Bi-weekly Recurring</option>
                        <option value="monthly">Monthly Recurring</option>
                      </select>
                    </div>

                    {/* Messages feedback */}
                    {bookingSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium animate-fadeIn">
                        {bookingSuccess}
                      </div>
                    )}
                    {bookingError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium animate-fadeIn">
                        {bookingError}
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={bookingLoading}
                      className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-indigo-605/20"
                    >
                      <Plus size={16} />
                      <span>{bookingLoading ? 'Booking Job...' : 'Confirm Booking & Dispatch'}</span>
                    </button>
                  </form>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto pb-12">
              
              {/* INTRO HERO */}
              <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-100">THE CLEANER 9,000 Playbook</h3>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Welcome to the official interactive operational cockpit. This guide walks you through the GTA house cleaning automation strategy. This system is designed for a <strong>wholesale-to-retail arbitrage business model</strong>, coordinating a regional contractor network to service customers while the operator manages the desk manually.
                </p>
              </div>

              {/* ARBITRAGE MODEL EXPLANATION */}
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <DollarSign size={20} />
                  <h4 className="font-bold text-neutral-100 text-sm">Wholesale-to-Retail Cleaning Arbitrage &amp; Bidding Model</h4>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  This system is built for a <strong>brokerage model</strong> where the operator does not perform any physical cleaning. Instead, you broker contracts between homeowners and independent regional cleaning contractors:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <h5 className="font-semibold text-neutral-200 mb-2 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>1. The Arbitrage (Pricing Spread)</span>
                    </h5>
                    <p className="text-neutral-400 leading-relaxed">
                      You secure a client at a high <strong>Retail Price</strong> (e.g., $250 for a 3-bed clean) and contract the work out to a verified cleaner in our network at a lower <strong>Wholesale Price</strong> (e.g., $155). You pocket the difference ($95) as pure arbitrage profit for brokering the deal.
                    </p>
                  </div>
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <h5 className="font-semibold text-neutral-200 mb-2 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>2. The Bid (First-Reply Wins)</span>
                    </h5>
                    <p className="text-neutral-400 leading-relaxed">
                      When a job is confirmed in Mission Control, the dispatch agent automatically broadcasts the job details and the wholesale payout to all active cleaners in the corresponding GTA region via SMS. The cleaners bid on the contract by replying <strong><code>YES</code></strong> via text. The first responder is assigned the job automatically.
                    </p>
                  </div>
                </div>
                <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-xl text-xs text-neutral-400 leading-relaxed">
                  <strong>The Operational Edge:</strong> By automating the dispatch state machine and the subsequent review loop in Supabase, you can run a multi-city cleaning brand with zero equipment, zero employee overhead, and zero manual cleaning labor.
                </div>
              </div>

              {/* CORE JOURNEY STAGES */}
              <div className="space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-2">
                  <span>Step-by-Step Operator Journey</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  {/* Step 1 */}
                  <div className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 p-6 rounded-2xl transition-all flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 shrink-0">1</div>
                    <div className="space-y-1">
                      <h5 className="font-semibold text-neutral-100 text-sm">Receive a Manual Call</h5>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        When a customer calls your business line, navigate to the <span className="text-indigo-400 font-medium">Mission Control</span> tab. If they are a returning customer, you can click their profile under the <strong>Call Simulators / Quick Logs</strong> to pre-populate details.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 p-6 rounded-2xl transition-all flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 shrink-0">2</div>
                    <div className="space-y-1">
                      <h5 className="font-semibold text-neutral-100 text-sm">Follow Call Script & Quote</h5>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Read the step-by-step phone scripts on the left panel to lead the conversation. Toggle the bedroom/bathroom counters and add-ons on the right panel. The <strong>Instant Quote Calculator</strong> will display the Retail and Wholesale prices side-by-side. Quote the customer the retail price.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 p-6 rounded-2xl transition-all flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 shrink-0">3</div>
                    <div className="space-y-1">
                      <h5 className="font-semibold text-neutral-100 text-sm">Book and Broadcast Job</h5>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Input the customer&apos;s address, date/time, select the GTA region (West, North, East, or Central), and click <strong>Confirm Booking & Dispatch</strong>. This writes the job to Supabase and fires the dispatch state machine.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 p-6 rounded-2xl transition-all flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 shrink-0">4</div>
                    <div className="space-y-1">
                      <h5 className="font-semibold text-neutral-100 text-sm">Cleaners Bid & Claim via SMS</h5>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        The dispatch agent automatically broadcasts the job details and wholesale payout to all active cleaners in the matching region. The first cleaner to text back <strong><code>YES</code></strong> is automatically assigned. The system updates the job status, alerts the customer, and stops the broadcast.
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 p-6 rounded-2xl transition-all flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 shrink-0">5</div>
                    <div className="space-y-1">
                      <h5 className="font-semibold text-neutral-100 text-sm">Job Completion & Review Blitz</h5>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Once the job is completed, the background sweeper waits 30 minutes to avoid pestering the client, then automatically sends a coached review request via SMS. This request prompts the client to write a Google review and explicitly mention the city + keyword (e.g. `Oakville house cleaning`) to improve your local GBP ranking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETAILED FEATURE REFERENCE */}
              <div className="space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-2">
                  <span>Functional Modules Reference</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-550"></span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <Radar size={16} />
                      <h5 className="font-bold text-neutral-200 text-sm">Market Intel & Competitor Radar</h5>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Enter a GTA suburb and service keyword. The system uses the Google Places API to search the top 3 ranking businesses in that city. It applies the <strong>Velch Threshold Rule</strong>: it flags the city as a <strong>GO (Green)</strong> if at least 2 of the top 3 competitors have fewer than 100 reviews (indicating a winnable market), and <strong>NO-GO (Red)</strong> if they are saturated.
                    </p>
                  </div>

                  <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <Store size={16} />
                      <h5 className="font-bold text-neutral-200 text-sm">GBP Manager & AI Post Writer</h5>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Manages your exact-match Google Business Profiles. Clicking &quot;Generate Weekly Post&quot; calls OpenAI GPT-4o to write localized updates under 750 characters. The model is constrained to naturally repeat the keyword (e.g., <code>[City] house cleaning</code>) 2-3 times to boost local search relevance.
                    </p>
                  </div>

                  <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <PhoneCall size={16} />
                      <h5 className="font-bold text-neutral-200 text-sm">Mission Control & Pricing Calculator</h5>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Handles manual calls. Features a scrollable scripts panel (Introduction, Pricing, Handling Objections, Scheduling) and the Instant Quote Calculator. The calculator enforces the wholesale-to-retail pricing matrix (1 bed: $140/85, 2 bed: $190/115, 3 bed: $250/155, 4 bed: $310/195, deep clean: +$70/35), letting you see your net arbitrage profit immediately.
                    </p>
                  </div>

                  <div className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <MessageSquare size={16} />
                      <h5 className="font-bold text-neutral-200 text-sm">Dispatch Engine & Review Blitz</h5>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Coordinates bookings with regional contractors (West, North, East, Central) to prevent cross-region dispatch errors. Manages the FSM state machine: sends SMS broadcasts, waits for incoming claims, handles 15-minute rebroadcast timeouts (up to 3 attempts), and automates keyword-coached review requests.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
