
CREATE OR REPLACE FUNCTION public.notify_legal_document_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _practitioner RECORD;
  _title TEXT;
  _message TEXT;
  _type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _title := 'Nouveau document juridique 📄';
    _message := 'Un nouveau document juridique « ' || NEW.title || ' » a été publié. Veuillez en prendre connaissance.';
    _type := 'warning';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify if content/version actually changed
    IF OLD.version = NEW.version THEN RETURN NEW; END IF;
    _title := 'Document juridique mis à jour 📄';
    _message := 'Le document « ' || NEW.title || ' » a été mis à jour en version ' || NEW.version || '. Veuillez en prendre connaissance.';
    _type := 'warning';
  END IF;

  -- Only notify if document is active
  IF NOT NEW.is_active THEN RETURN NEW; END IF;

  -- Notify all active practitioners
  FOR _practitioner IN
    SELECT p.user_id
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'practitioner' AND p.is_active = true
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      _practitioner.user_id,
      _title,
      _message,
      _type,
      jsonb_build_object('document_id', NEW.id, 'version', NEW.version, 'action', 'legal_document_update')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_legal_document_change
  AFTER INSERT OR UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_legal_document_change();
