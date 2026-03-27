
-- Create practitioner_notifications table
CREATE TABLE public.practitioner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'feature_announcement',
  title text NOT NULL,
  body text NOT NULL,
  cta_label text,
  cta_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.practitioner_notifications ENABLE ROW LEVEL SECURITY;

-- Practitioners can view their own notifications
CREATE POLICY "Practitioners can view own notifications"
  ON public.practitioner_notifications FOR SELECT
  TO authenticated
  USING (
    practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Practitioners can update (mark as read) their own notifications
CREATE POLICY "Practitioners can update own notifications"
  ON public.practitioner_notifications FOR UPDATE
  TO authenticated
  USING (
    practitioner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Admins can insert notifications
CREATE POLICY "Admins can insert notifications"
  ON public.practitioner_notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
  ON public.practitioner_notifications FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for practitioner_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.practitioner_notifications;

-- Create notification_logs table
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification_logs"
  ON public.notification_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
