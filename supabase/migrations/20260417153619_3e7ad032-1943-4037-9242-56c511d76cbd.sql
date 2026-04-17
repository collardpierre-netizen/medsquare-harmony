DELETE FROM activity_registrations
WHERE session_id = 'ea01108d-f7b3-472e-b7e8-2ef711d762ab'
  AND (guest_email LIKE 'filler%@test.com' OR guest_email = 'test.e2e@example.com');