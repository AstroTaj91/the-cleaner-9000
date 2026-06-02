-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- CONTRACTORS TABLE (Cleaners)
CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    gta_region TEXT NOT NULL CHECK (gta_region IN ('west', 'north', 'east', 'central')),
    rating NUMERIC(3,2) DEFAULT 5.00 NOT NULL CHECK (rating >= 1.00 AND rating <= 5.00),
    insurance_expiry DATE,
    background_check_passed BOOLEAN DEFAULT FALSE NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- GBP LISTINGS TABLE (Google Business Profiles)
CREATE TABLE IF NOT EXISTS gbp_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- E.g. "Mississauga House Cleaning Services"
    city TEXT NOT NULL,
    review_count INTEGER DEFAULT 0 NOT NULL,
    google_review_link TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- COMPETITORS TABLE (Google Maps results)
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gbp_listing_id UUID REFERENCES gbp_listings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    review_count INTEGER NOT NULL,
    rating NUMERIC(3,2) NOT NULL,
    rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 3),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- JOBS TABLE (Bookings)
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    contractor_id UUID REFERENCES contractors(id),
    gbp_listing_id UUID NOT NULL REFERENCES gbp_listings(id),
    beds INTEGER NOT NULL CHECK (beds >= 1),
    baths INTEGER NOT NULL CHECK (baths >= 1),
    is_deep_clean BOOLEAN DEFAULT FALSE NOT NULL,
    retail_price NUMERIC(10,2) NOT NULL,
    wholesale_price NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'assigned', 'completed')),
    gta_region TEXT NOT NULL CHECK (gta_region IN ('west', 'north', 'east', 'central')),
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    recurring_frequency TEXT DEFAULT 'one-off' NOT NULL CHECK (recurring_frequency IN ('one-off', 'weekly', 'bi-weekly', 'monthly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- REVIEW REQUESTS TABLE
CREATE TABLE IF NOT EXISTS review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_contractors_region_active ON contractors(gta_region, active);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_contractor_id ON jobs(contractor_id);
CREATE INDEX IF NOT EXISTS idx_competitors_gbp ON competitors(gbp_listing_id);

-- ATOMIC STORED PROCEDURE FOR CLAIMING JOBS (Prevents double bookings)
CREATE OR REPLACE FUNCTION claim_job(p_job_id UUID, p_contractor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_assigned BOOLEAN;
BEGIN
    -- Perform an atomic SELECT FOR UPDATE row-level lock
    SELECT (contractor_id IS NOT NULL) INTO v_assigned
    FROM jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF v_assigned THEN
        RETURN FALSE; -- Already claimed
    ELSE
        UPDATE jobs
        SET contractor_id = p_contractor_id, status = 'assigned'
        WHERE id = p_job_id;
        RETURN TRUE; -- Successfully claimed
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS POLICIES (Enforce Authenticated Dashboard Access)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users" ON customers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users" ON contractors
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users" ON gbp_listings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users" ON competitors
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users" ON jobs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users" ON review_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
