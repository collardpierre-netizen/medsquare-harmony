
ALTER TABLE public.activities
ADD COLUMN start_date date DEFAULT NULL,
ADD COLUMN end_date date DEFAULT NULL;
