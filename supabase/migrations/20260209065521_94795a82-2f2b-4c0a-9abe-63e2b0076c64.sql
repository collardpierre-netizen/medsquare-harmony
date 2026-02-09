
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- System (triggers) can insert notifications
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: create notification when booking status changes
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title TEXT;
  _message TEXT;
  _type TEXT;
  _room_name TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get room name
  SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;

  IF NEW.status = 'confirmed' THEN
    _title := 'Réservation confirmée ✅';
    _message := 'Votre réservation pour ' || COALESCE(_room_name, 'une salle') || ' le ' || to_char(NEW.start_time AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || ' a été confirmée.';
    _type := 'success';
  ELSIF NEW.status = 'cancelled' THEN
    _title := 'Réservation refusée ❌';
    _message := 'Votre réservation pour ' || COALESCE(_room_name, 'une salle') || ' le ' || to_char(NEW.start_time AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || ' a été refusée.';
    _type := 'error';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    (SELECT user_id FROM public.profiles WHERE id = NEW.practitioner_id),
    _title,
    _message,
    _type,
    jsonb_build_object('booking_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to bookings table
CREATE TRIGGER on_booking_status_change
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_status_change();
