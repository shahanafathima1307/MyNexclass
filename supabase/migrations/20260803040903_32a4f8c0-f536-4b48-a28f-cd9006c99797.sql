GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_class_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_assignment_tutor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_class_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_class_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_assignment(uuid) TO authenticated;