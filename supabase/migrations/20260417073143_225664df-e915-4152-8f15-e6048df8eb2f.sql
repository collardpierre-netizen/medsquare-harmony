-- TEST: Schedule privatization scenarios for QA
-- Cabinet N°1: future privatization (starts in 30 days, ends in 60 days)
UPDATE public.rooms 
SET privatized_from = (CURRENT_DATE + INTERVAL '30 days')::date,
    privatized_until = (CURRENT_DATE + INTERVAL '60 days')::date,
    is_available = true
WHERE name = 'Cabinet N°1';

-- Cabinet N°4: ACTIVE scheduled privatization (started yesterday, ends in 7 days)
UPDATE public.rooms 
SET privatized_from = (CURRENT_DATE - INTERVAL '1 day')::date,
    privatized_until = (CURRENT_DATE + INTERVAL '7 days')::date,
    is_available = true
WHERE name = 'Cabinet N°4';