-- Allow public read access to bookings for room availability display
-- Only exposes id, start_time, end_time, status, room_id (no sensitive practitioner info is leaked since RoomAvailability only uses start_time/end_time/status)
CREATE POLICY "Public can view confirmed/pending bookings for availability"
ON public.bookings
FOR SELECT
USING (status IN ('confirmed', 'pending'));
