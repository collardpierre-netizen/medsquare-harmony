
-- Add 'patient' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'patient';

-- Update handle_new_user to support patient/professional signup
-- Professionals get is_active = false (pending admin activation)
-- Patients get is_active = true
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_type TEXT;
  _is_active BOOLEAN;
  _role app_role;
BEGIN
  _account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'patient');
  
  IF _account_type = 'practitioner' THEN
    _is_active := false;  -- Needs admin activation
    _role := 'practitioner';
  ELSE
    _is_active := true;
    _role := 'patient';
  END IF;

  INSERT INTO public.profiles (user_id, first_name, last_name, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    _is_active
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  -- Notify admins when a professional registers
  IF _account_type = 'practitioner' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    SELECT ur.user_id,
      'Nouveau professionnel inscrit 👤',
      COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '') || ' (' || NEW.email || ') souhaite rejoindre Medsquare en tant que professionnel. Son compte est en attente de validation.',
      'warning',
      jsonb_build_object('new_user_id', NEW.id, 'email', NEW.email, 'action', 'practitioner_signup')
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;
