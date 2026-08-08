import { logAudit } from "@/lib/audit";
import type { ClassWithPeople } from "@/lib/tutoring";

/** The join button unlocks this many minutes before the scheduled start. */
export const JOIN_WINDOW_MINUTES = 10;
/** Grace period after the scheduled end during which the room stays open. */
const GRACE_MINUTES = 30;

export type MeetingState = "scheduled" | "waiting" | "live" | "ended" | "cancelled";

export type MeetingWindow = {
  /** Coarse state derived from the schedule alone. */
  state: MeetingState;
  /** True once we are inside the join window and before the room closes. */
  canJoin: boolean;
  opensAt: Date;
  startsAt: Date;
  endsAt: Date;
  /** Short human label, e.g. "Opens in 2 h 15 m". */
  label: string;
};

function humanDelta(ms: number) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function meetingWindow(
  item: Pick<ClassWithPeople, "starts_at" | "duration_minutes" | "status">,
  now: number = Date.now(),
): MeetingWindow {
  const startsAt = new Date(item.starts_at);
  const opensAt = new Date(startsAt.getTime() - JOIN_WINDOW_MINUTES * 60_000);
  const endsAt = new Date(startsAt.getTime() + (item.duration_minutes + GRACE_MINUTES) * 60_000);

  if (item.status === "cancelled") {
    return { state: "cancelled", canJoin: false, opensAt, startsAt, endsAt, label: "Cancelled" };
  }
  if (item.status === "completed" || now > endsAt.getTime()) {
    return { state: "ended", canJoin: false, opensAt, startsAt, endsAt, label: "Ended" };
  }
  if (now < opensAt.getTime()) {
    return {
      state: "scheduled",
      canJoin: false,
      opensAt,
      startsAt,
      endsAt,
      label: `Opens in ${humanDelta(opensAt.getTime() - now)}`,
    };
  }
  if (now < startsAt.getTime()) {
    return {
      state: "waiting",
      canJoin: true,
      opensAt,
      startsAt,
      endsAt,
      label: `Starts in ${humanDelta(startsAt.getTime() - now)}`,
    };
  }
  return { state: "live", canJoin: true, opensAt, startsAt, endsAt, label: "Live now" };
}

/** Turns a getUserMedia / WebRTC failure into something a person can act on. */
export function describeMediaError(error: unknown): { code: string; message: string } {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return {
      code: "insecure_context",
      message: "Your browser blocks camera access on insecure pages. Open myNexClass over https.",
    };
  }
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return {
      code: "unsupported_browser",
      message:
        "This browser cannot run the class room. Try the latest Chrome, Safari, Edge or Firefox.",
    };
  }
  const name = error instanceof Error ? error.name : "UnknownError";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        code: "permission_denied",
        message:
          "Camera and microphone access was blocked. Allow them in your browser's site settings, then try again.",
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return {
        code: "no_device",
        message: "No camera or microphone was found on this device. Plug one in and try again.",
      };
    case "NotReadableError":
      return {
        code: "device_busy",
        message:
          "Your camera or microphone is already in use by another app. Close it and try again.",
      };
    default:
      return {
        code: "media_error",
        message: "We could not start your camera and microphone. Try again or reload the page.",
      };
  }
}

/** Records a join failure so tutors and admins can troubleshoot from the audit log. */
export async function logMeetingFailure(input: {
  classId: string;
  code: string;
  message: string;
}) {
  try {
    await logAudit({
      action: "meeting_failure",
      entity: "class",
      entityId: input.classId,
      details: {
        code: input.code,
        message: input.message,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        at: new Date().toISOString(),
      },
    });
  } catch {
    // Never let logging break the join flow.
  }
}
