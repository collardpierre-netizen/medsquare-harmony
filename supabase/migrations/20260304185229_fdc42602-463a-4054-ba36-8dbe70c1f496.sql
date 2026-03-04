
-- Legal documents table (admin-managed center documents)
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Version history
CREATE TABLE public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Acknowledgments tracking
CREATE TABLE public.legal_document_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_acknowledged integer NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

-- RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Legal documents: anyone authenticated can read active, admins can manage
CREATE POLICY "Authenticated users can view active legal documents"
  ON public.legal_documents FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Versions: authenticated can read, admins can insert
CREATE POLICY "Authenticated users can view versions"
  ON public.legal_document_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert versions"
  ON public.legal_document_versions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Acknowledgments: users can read/insert their own, admins can read all
CREATE POLICY "Users can view own acknowledgments"
  ON public.legal_document_acknowledgments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all acknowledgments"
  ON public.legal_document_acknowledgments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can acknowledge documents"
  ON public.legal_document_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own acknowledgments"
  ON public.legal_document_acknowledgments FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
