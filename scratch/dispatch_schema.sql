CREATE TABLE IF NOT EXISTS dispatches (
    job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('BOOKING_CONFIRMED', 'DISPATCH_BROADCAST', 'AWAITING_RESPONSE', 'ASSIGNED', 'CONFIRMED', 'ALERT_OPERATOR')),
    attempts INTEGER DEFAULT 1 NOT NULL,
    assigned_contractor_id UUID REFERENCES contractors(id),
    assigned_contractor_name TEXT,
    assigned_contractor_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
