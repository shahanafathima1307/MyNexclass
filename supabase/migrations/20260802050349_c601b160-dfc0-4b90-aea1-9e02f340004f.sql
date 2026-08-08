
REVOKE ALL ON FUNCTION private.can_access_assignment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_assignment_tutor(uuid) FROM PUBLIC, anon, authenticated;
