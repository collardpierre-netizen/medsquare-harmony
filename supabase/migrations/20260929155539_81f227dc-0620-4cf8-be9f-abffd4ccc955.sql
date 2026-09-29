UPDATE public.bookings b SET room_id = (SELECT id FROM public.rooms WHERE name ILIKE '%N°3%' LIMIT 1)
FROM public.profiles p
WHERE p.id = b.practitioner_id AND p.first_name = 'Isabelle'
AND b.room_id = (SELECT id FROM public.rooms WHERE name ILIKE '%N°4%' LIMIT 1)
AND b.status <> 'cancelled' AND b.start_time >= '2026-11-01';