import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClasses from "./tools/list-classes";
import listPeople from "./tools/list-people";
import listRecordings from "./tools/list-recordings";
import scheduleClass from "./tools/schedule-class";
import updateClass from "./tools/update-class";

// The OAuth issuer must be the direct Supabase host; the project ref is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mynexclass-mcp",
  title: "myNexClass",
  version: "0.1.0",
  instructions:
    "Tools for myNexClass, a tutoring platform. Use `list_people` to find tutors and students, `list_classes` to review upcoming and past classes, `schedule_class` to book a new class, `update_class` to change a class time, status or meeting link, and `list_recordings` to find lesson recordings. All data is scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPeople, listClasses, scheduleClass, updateClass, listRecordings],
});
