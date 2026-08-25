ALTER TABLE public.activity_prices
ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'htva'
CHECK (vat_mode IN ('htva', 'ttc'));