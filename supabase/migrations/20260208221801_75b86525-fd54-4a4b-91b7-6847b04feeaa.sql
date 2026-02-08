
-- Activities table: yoga, pilates, etc.
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'autre',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER DEFAULT 10,
  location TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  recurrence JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Anyone can see active activities
CREATE POLICY "Anyone can view active activities"
ON public.activities
FOR SELECT
USING (is_active = true);

-- Authenticated users can view all activities
CREATE POLICY "Authenticated users can view all activities"
ON public.activities
FOR SELECT
TO authenticated
USING (true);

-- Practitioners can insert their own activities
CREATE POLICY "Practitioners can insert their own activities"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Practitioners can update their own activities
CREATE POLICY "Practitioners can update their own activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Practitioners can delete their own activities
CREATE POLICY "Practitioners can delete their own activities"
ON public.activities
FOR DELETE
TO authenticated
USING (practitioner_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Activity sessions: specific scheduled sessions
CREATE TABLE public.activity_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  room_id UUID REFERENCES public.rooms(id),
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can view sessions
CREATE POLICY "Anyone can view sessions"
ON public.activity_sessions
FOR SELECT
USING (true);

-- Practitioners can manage sessions of their activities
CREATE POLICY "Practitioners can insert sessions"
ON public.activity_sessions
FOR INSERT
TO authenticated
WITH CHECK (activity_id IN (
  SELECT a.id FROM activities a
  JOIN profiles p ON p.id = a.practitioner_id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Practitioners can update sessions"
ON public.activity_sessions
FOR UPDATE
TO authenticated
USING (activity_id IN (
  SELECT a.id FROM activities a
  JOIN profiles p ON p.id = a.practitioner_id
  WHERE p.user_id = auth.uid()
) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practitioners can delete sessions"
ON public.activity_sessions
FOR DELETE
TO authenticated
USING (activity_id IN (
  SELECT a.id FROM activities a
  JOIN profiles p ON p.id = a.practitioner_id
  WHERE p.user_id = auth.uid()
) OR has_role(auth.uid(), 'admin'::app_role));

-- Activity registrations: users sign up for sessions
CREATE TABLE public.activity_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE public.activity_registrations ENABLE ROW LEVEL SECURITY;

-- Users can view registrations for sessions they're part of
CREATE POLICY "Users can view their own registrations"
ON public.activity_registrations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins/practitioners can view all registrations for their sessions
CREATE POLICY "Practitioners can view session registrations"
ON public.activity_registrations
FOR SELECT
TO authenticated
USING (session_id IN (
  SELECT s.id FROM activity_sessions s
  JOIN activities a ON a.id = s.activity_id
  JOIN profiles p ON p.id = a.practitioner_id
  WHERE p.user_id = auth.uid()
) OR has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can register
CREATE POLICY "Users can register for sessions"
ON public.activity_registrations
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can cancel their own registration
CREATE POLICY "Users can cancel their registration"
ON public.activity_registrations
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_activities_updated_at
BEFORE UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
