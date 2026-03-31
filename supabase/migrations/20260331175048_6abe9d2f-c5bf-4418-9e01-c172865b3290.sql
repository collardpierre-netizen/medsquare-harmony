UPDATE settings 
SET value = jsonb_set(
  value::jsonb,
  '{items,0,answer}',
  '"Vous pouvez prendre rendez-vous directement en contactant le praticien depuis sa fiche sur notre site (bouton « Contacter »), par téléphone ou par email via notre page Contact."'::jsonb
),
updated_at = now()
WHERE key = 'faq';