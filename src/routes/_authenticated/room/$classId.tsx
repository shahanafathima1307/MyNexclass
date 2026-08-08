import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Mic, MicOff, PhoneOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ClassWhiteboard } from "@/components/class-whiteboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useClasses } from "@/lib/tutoring";
import { markAttendanceJoin, markAttendanceLeave } from "@/lib/class-people";
import {
  JOIN_WINDOW_MINUTES,
  describeMediaError,
  logMeetingFailure,
  meetingWindow,
} from "@/lib/meeting";
import { formatInZone, zoneAbbrev } from "@/lib/timezones";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/room/$classId")({
  head: () => ({
    meta: [
      { title: "Class room — myNexClass" },
      {
        name: "description",
        content: "Join your myNexClass class in the built-in video room — no external apps needed.",
      },
      { property: "og:title", content: "Class room — myNexClass" },
      {
        property: "og:description",
        content: "Join your myNexClass class in the built-in video room — no external apps needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

type Phase = "idle" | "connecting" | "waiting" | "live" | "ended" | "error";
type Knock = "none" | "knocking" | "declined" | "admitted";
type Guest = { userId: string; name: string };

function RoomPage() {
  const { classId } = Route.useParams();
  const { user } = useSession();
  const { data: classes } = useClasses(user?.id);
  const item = classes?.find((c) => c.id === classId) ?? null;
  const isHost = !!item && !!user && item.tutor_id === user.id;

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lobbyRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const peerRef = useRef<string | null>(null);
  const attendanceRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string>("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteLive, setRemoteLive] = useState(false);
  const [knock, setKnock] = useState<Knock>("none");
  const [waitingGuests, setWaitingGuests] = useState<Guest[]>([]);
  const [hostPresent, setHostPresent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const knockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps the join window and countdown labels fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const window_ = item ? meetingWindow(item, now) : null;
  const canJoin = !window_ || window_.canJoin;

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (knockTimer.current) {
      clearTimeout(knockTimer.current);
      knockTimer.current = null;
    }
    peerRef.current = null;
    pendingIce.current = [];
    setRemoteLive(false);
    void markAttendanceLeave(attendanceRef.current);
    attendanceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);


  const join = useCallback(async () => {
    if (!user) return;
    if (knockTimer.current) {
      clearTimeout(knockTimer.current);
      knockTimer.current = null;
    }
    const myId = `${user.id}-${Math.random().toString(36).slice(2, 8)}`;
    setPhase("connecting");
    setMessage("");

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (error) {
      const detail = describeMediaError(error);
      setPhase("error");
      setMessage(detail.message);
      void logMeetingFailure({ classId, code: detail.code, message: detail.message });
      return;
    }

    streamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    setMicOn(true);
    setCamOn(true);

    const channel = supabase.channel(`class-room:${classId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    const send = (event: string, payload: Record<string, unknown>) =>
      channel.send({ type: "broadcast", event, payload: { from: myId, ...payload } });

    function createPeer() {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) void send("ice", { candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
        setRemoteLive(true);
        setPhase("live");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          const message =
            "The video connection failed — this often happens on restricted office or school networks. Try rejoining, or switch network.";
          setPhase("error");
          setMessage(message);
          void logMeetingFailure({ classId, code: "peer_connection_failed", message });
        }
        if (pc.connectionState === "disconnected") setRemoteLive(false);
      };

      return pc;
    }

    async function drainIce(pc: RTCPeerConnection) {
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
    }

    async function maybeOffer(peerId: string) {
      peerRef.current = peerId;
      if (myId < peerId) return; // the higher id initiates
      const pc = createPeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      void send("offer", { sdp: pc.localDescription });
    }

    channel
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (payload.from === myId) return;
        void send("hello-ack", {});
        void maybeOffer(payload.from as string);
      })
      .on("broadcast", { event: "hello-ack" }, ({ payload }) => {
        if (payload.from === myId) return;
        void maybeOffer(payload.from as string);
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === myId) return;
        const pc = createPeer();
        await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
        await drainIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void send("answer", { sdp: pc.localDescription });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc || payload.from === myId || pc.signalingState === "stable") return;
        await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
        await drainIce(pc);
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === myId) return;
        const candidate = payload.candidate as RTCIceCandidateInit;
        const pc = pcRef.current;
        if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {});
        else pendingIce.current.push(candidate);
      })
      .on("broadcast", { event: "bye" }, ({ payload }) => {
        if (payload.from === myId) return;
        setRemoteLive(false);
        setPhase("waiting");
        pcRef.current?.close();
        pcRef.current = null;
        pendingIce.current = [];
        toast.info("The other person left the room");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setPhase("waiting");
          void send("hello", {});
          void markAttendanceJoin(classId).then((id) => {
            attendanceRef.current = id;
          });
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const message =
            "We could not reach the live class service. Check your connection and try again.";
          setPhase("error");
          setMessage(message);
          void logMeetingFailure({ classId, code: `channel_${status.toLowerCase()}`, message });
        }
      });

  }, [classId, user]);

  /**
   * Waiting room: the tutor hosts and can admit people. If no tutor is on the
   * page, students are never left stranded — they enter the room on their own.
   */
  useEffect(() => {
    if (!user) return;
    const lobby = supabase.channel(`class-lobby:${classId}`, {
      config: { broadcast: { self: false } },
    });
    lobbyRef.current = lobby;
    const say = (event: string, payload: Record<string, unknown> = {}) =>
      lobby.send({ type: "broadcast", event, payload });

    lobby
      .on("broadcast", { event: "knock" }, ({ payload }) => {
        if (!isHost) return;
        const guest = { userId: payload.userId as string, name: payload.name as string };
        setWaitingGuests((prev) =>
          prev.some((g) => g.userId === guest.userId) ? prev : [...prev, guest],
        );
        toast.info(`${guest.name} is waiting to join`);
        void say("host-here");
      })
      .on("broadcast", { event: "host-here" }, () => {
        if (!isHost) setHostPresent(true);
      })
      .on("broadcast", { event: "who-hosts" }, () => {
        if (isHost) void say("host-here");
      })
      .on("broadcast", { event: "admit" }, ({ payload }) => {
        if (isHost || payload.userId !== user.id) return;
        setKnock("admitted");
        void join();
      })
      .on("broadcast", { event: "decline" }, ({ payload }) => {
        if (isHost || payload.userId !== user.id) return;
        if (knockTimer.current) {
          clearTimeout(knockTimer.current);
          knockTimer.current = null;
        }
        setKnock("declined");
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (isHost) void say("host-here");
        else void say("who-hosts");
      });

    return () => {
      supabase.removeChannel(lobby);
      lobbyRef.current = null;
    };
  }, [classId, isHost, user, join]);

  function askToJoin() {
    if (!user) return;
    setKnock("knocking");
    void lobbyRef.current?.send({
      type: "broadcast",
      event: "knock",
      payload: {
        userId: user.id,
        name:
          (item?.tutor_id === user.id ? item?.tutor : item?.student)?.full_name ||
          user.email ||
          "A participant",
      },
    });
    // No tutor on the page? Let the student in anyway rather than blocking them.
    if (knockTimer.current) clearTimeout(knockTimer.current);
    knockTimer.current = setTimeout(() => {
      knockTimer.current = null;
      setKnock((current) => {
        if (current !== "knocking") return current;
        toast.info("Your tutor is not here yet — taking you into the room to wait.");
        void join();
        return "admitted";
      });
    }, 8000);
  }


  function admit(guest: Guest) {
    setWaitingGuests((prev) => prev.filter((g) => g.userId !== guest.userId));
    void lobbyRef.current?.send({
      type: "broadcast",
      event: "admit",
      payload: { userId: guest.userId },
    });
  }

  function decline(guest: Guest) {
    setWaitingGuests((prev) => prev.filter((g) => g.userId !== guest.userId));
    void lobbyRef.current?.send({
      type: "broadcast",
      event: "decline",
      payload: { userId: guest.userId },
    });
  }


  function leave() {
    void channelRef.current?.send({
      type: "broadcast",
      event: "bye",
      payload: { from: user?.id ?? "" },
    });
    cleanup();
    setKnock("none");
    setPhase("ended");
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  const inRoom = phase === "connecting" || phase === "waiting" || phase === "live";
  const start = item ? new Date(item.starts_at) : null;
  const counterpart = item ? (item.tutor_id === user?.id ? item.student : item.tutor) : null;
  // "Live" means someone is actually connected; otherwise fall back to the schedule.
  const liveState = remoteLive || phase === "live" ? "live" : (window_?.state ?? "scheduled");


  return (
    <AppShell
      title={item ? item.title : "Class room"}
      subtitle="Your class happens right here — no external meeting apps."
      actions={
        <Button variant="outline" asChild>
          <Link to="/classes">
            <ArrowLeft className="size-4" />
            Back to classes
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6">
        <Card className="border-border shadow-soft">
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            {item ? (
              <>
                <Badge
                  className={cn(
                    "capitalize",
                    liveState === "live" && "bg-accent text-accent-foreground hover:bg-accent",
                  )}
                  variant={liveState === "ended" || liveState === "cancelled" ? "outline" : "default"}
                >
                  {liveState === "live"
                    ? "Live"
                    : liveState === "waiting"
                      ? "Waiting"
                      : liveState === "ended"
                        ? "Ended"
                        : liveState === "cancelled"
                          ? "Cancelled"
                          : "Scheduled"}
                </Badge>
                {item.is_demo && (
                  <Badge className="bg-accent text-accent-foreground hover:bg-accent">Demo</Badge>
                )}
                {item.subject && <Badge variant="outline">{item.subject}</Badge>}

                {start && (
                  <span className="text-sm text-muted-foreground">
                    {formatInZone(start, item.time_zone)} {zoneAbbrev(start, item.time_zone)} ·{" "}
                    {item.duration_minutes} min · your time {format(start, "EEE d MMM · HH:mm")}
                  </span>
                )}
                {counterpart && (
                  <span className="text-sm">
                    <span className="text-muted-foreground">With </span>
                    {counterpart.full_name || "your class partner"}
                  </span>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Loading class details — you can still join the room.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <VideoTile
            label={remoteLive ? counterpart?.full_name || "Your class partner" : "Waiting…"}
            videoRef={remoteVideo}
            muted={false}
            placeholder={
              inRoom
                ? "Waiting for the other person to join this room."
                : "Join the room to start the class."
            }
            active={remoteLive}
          />
          <VideoTile
            label="You"
            videoRef={localVideo}
            muted
            mirrored
            placeholder="Your camera preview appears here."
            active={inRoom && camOn}
          />
        </div>

        {user && <ClassWhiteboard classId={classId} userId={user.id} canClear={isHost} />}

        {isHost && waitingGuests.length > 0 && (
          <Card className="border-accent shadow-soft">
            <CardContent className="space-y-3 pt-6">
              <h3 className="font-display text-sm font-semibold">Waiting room</h3>
              {waitingGuests.map((guest) => (
                <div key={guest.userId} className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm">{guest.name} wants to join</span>
                  <Button size="sm" onClick={() => admit(guest)}>
                    Admit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decline(guest)}>
                    Decline
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {phase === "error"
                ? message
                : phase === "live"
                  ? "You are connected."
                  : phase === "waiting"
                    ? isHost
                      ? "You are hosting — admit people from the waiting room as they knock."
                      : "You are in the room — waiting for your tutor."
                    : phase === "ended"
                      ? "You left the room."
                      : !canJoin && window_
                        ? window_.state === "scheduled"
                          ? `The room opens ${JOIN_WINDOW_MINUTES} minutes before the class — ${window_.label.toLowerCase()}.`
                          : window_.state === "cancelled"
                            ? "This class was cancelled, so the room stays closed."
                            : "This class has ended. Ask your tutor to schedule another one."
                        : knock === "knocking"
                          ? hostPresent
                            ? "Your tutor has been notified — waiting to be let in."
                            : "Looking for your tutor — we will take you in shortly."
                          : knock === "declined"
                            ? "Your tutor did not let you in yet. You can ask again."
                            : isHost
                              ? "Open the room so your students can be let in."
                              : "Everything runs inside myNexClass — nothing opens in another app."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!inRoom ? (
                isHost ? (
                  <Button onClick={() => void join()} disabled={!canJoin}>
                    <VideoIcon className="size-4" />
                    {!canJoin && window_?.state === "scheduled"
                      ? window_.label
                      : phase === "ended"
                        ? "Reopen room"
                        : "Open room"}
                  </Button>
                ) : (
                  <Button onClick={askToJoin} disabled={knock === "knocking" || !canJoin}>
                    <VideoIcon className="size-4" />
                    {!canJoin && window_?.state === "scheduled"
                      ? window_.label
                      : knock === "knocking"
                        ? "Waiting to be let in…"
                        : knock === "declined"
                          ? "Ask again"
                          : "Join class"}
                  </Button>
                )
              ) : (

                <>
                  <Button variant="outline" onClick={toggleMic}>
                    {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                    {micOn ? "Mute" : "Unmute"}
                  </Button>
                  <Button variant="outline" onClick={toggleCam}>
                    {camOn ? <VideoIcon className="size-4" /> : <VideoOff className="size-4" />}
                    {camOn ? "Camera off" : "Camera on"}
                  </Button>
                  <Button variant="destructive" onClick={leave}>
                    <PhoneOff className="size-4" />
                    Leave
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function VideoTile({
  label,
  videoRef,
  muted,
  mirrored = false,
  placeholder,
  active,
}: {
  label: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted: boolean;
  mirrored?: boolean;
  placeholder: string;
  active: boolean;
}) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-secondary">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={cn("size-full object-cover", mirrored && "-scale-x-100", !active && "opacity-0")}
      />
      {!active && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
          {placeholder}
        </p>
      )}
      <span className="absolute bottom-3 left-3 rounded-md bg-background/80 px-2 py-1 text-xs font-medium">
        {label}
      </span>
    </div>
  );
}
