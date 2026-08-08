# Outlook-style Calendar for myNexClass

Rebuild `/calendar` as a full scheduling workspace: Outlook's structure and interaction model, myNexClass branding (teal/lime, existing tokens and shells).

This is a large feature, so it ships in four stages. Each stage leaves the calendar fully working.

## Stage 1 — Calendar shell and views

- New layout: collapsible left rail (mini month, calendar visibility checkboxes, legend), main grid, top bar.
- Top bar: Today, prev/next arrows, date-range heading, view switcher (Day / Work week / Week / Month / Agenda), search, filter menu, timezone chip, Create button.
- Views render client-side, no reloads. Selected view, visible calendars, and last filters persist per user (calendar preferences table, localStorage fallback).
- Two pinned strips above the grid: **Today's classes** and **Next class** (with live Join state).
- Event sources unified into one feed: classes, tutor availability, assignment due dates, Loop requests, personal events, blocked time, holidays. Colour-coded per type with legend.
- Week/day compact event cards with side-by-side overlap layout; month view uses dot/pill indicators; agenda groups by day.
- Mobile: defaults to agenda, sidebar becomes a sheet, swipe between dates, floating create button, Join button always visible.

## Stage 2 — Event details, create, and editing

- Click an event → details panel (date/time, both timezones when tutor and student differ, people, subject, grade, status, meeting link, attendance, description, files, reminders, history).
- Panel actions: Join, Edit, Reschedule, Cancel, Delete, Duplicate, Mark attendance, Message participant.
- Create Event dialog covering one-time class, recurring class, trial class, availability, blocked time, personal reminder, Loop request — with all requested fields (people, subject, grade, timezone, repeat, link, location, description, attachments, reminders, notify participants).
- Quick create: click or drag an empty slot → small popover (title, times, type, Save / More options).
- Drag to move, drag edge to resize, Escape cancels, confirmation before changing a scheduled class, undo toast for the last change, participants notified after a change.

## Stage 3 — Recurrence, availability, booking

- Recurrence rules: daily, weekly, weekdays, monthly, custom; end on date / after N sessions / never. Editing a series asks: this event / this and future / whole series. DST warning on recurring classes.
- Tutor availability manager in-calendar: recurring availability, blocked time, buffer between classes, minimum notice, maximum booking window, vacation days, copy a week's availability to another week.
- Student booking from a tutor's free slot, respecting policy for reschedule and cancel. Double booking blocked at the database level.
- ICS download per event and a subscribable personal feed; "Add to Google / Outlook" links.

## Stage 4 — Admin, history, notifications

- Admin calendar: all classes, filter by tutor/student, cancelled and missed classes, platform-wide blocked dates and holidays, tutor utilisation, double-booking and conflict detection, CSV/ICS export.
- Event history timeline recording action, actor, role, timestamp, previous and new value for creation, time change, tutor/student change, cancellation, deletion, recurrence update, link update, join activity, attendance.
- Reminders (at start, 5/10/15/30 min, 1 hour, 1 day, custom) delivered in-app and by email through the existing branded templates, plus browser notifications. Event triggers: created, rescheduled, cancelled, tutor unavailable, student booked, Loop accepted, assignment due date changed.

## Technical notes

- New tables: `calendar_events`, `event_participants`, `recurrence_rules`, `tutor_blocked_time`, `event_reminders`, `event_history`, `calendar_preferences`, `shared_calendars`, `holidays`. Existing `classes`, `tutor_availability`, `assignments`, `loop_requests` stay the sources of truth for those types and are adapted into the same event shape rather than duplicated.
- All times stored UTC; rendered in the user's selected timezone via the existing `src/lib/timezones.ts`.
- RLS: students see only their own classes, assignments and personal events; tutors see their classes, their students and their own availability; admins see everything. Every new public table gets explicit grants plus policies.
- Overlap/double-booking enforced by a database check on class insert and update, not only in the UI.
- Join behaviour reuses `src/lib/meeting.ts` (`Waiting` / `Join now` / `Ended` / `Cancelled`, active 10 minutes before).
- SMS reminders are listed as optional in the brief and are out of scope unless you want a provider wired in.
