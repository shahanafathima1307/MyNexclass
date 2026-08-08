import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eraser, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Normalised (0–1) segment so the board looks the same on every screen size. */
type Segment = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
};

const BOARD_W = 1600;
const BOARD_H = 900;

const PENS: { label: string; value: string }[] = [
  { label: "Ink", value: "#1f2937" },
  { label: "Teal", value: "#0d9488" },
  { label: "Lime", value: "#65a30d" },
  { label: "Coral", value: "#e11d48" },
  { label: "Amber", value: "#d97706" },
];

const WIDTHS = [3, 6, 12];

export function ClassWhiteboard({
  classId,
  userId,
  canClear = true,
}: {
  classId: string;
  userId: string;
  canClear?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<Segment[]>([]);
  const meRef = useRef(userId);

  const [color, setColor] = useState(PENS[0].value);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [erasing, setErasing] = useState(false);
  const [connected, setConnected] = useState(false);

  const paint = useCallback((seg: Segment) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(seg.x0 * BOARD_W, seg.y0 * BOARD_H);
    ctx.lineTo(seg.x1 * BOARD_W, seg.y1 * BOARD_H);
    ctx.stroke();
  }, []);

  const wipe = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const replay = useCallback(
    (segments: Segment[]) => {
      wipe();
      segments.forEach(paint);
    },
    [paint, wipe],
  );

  useEffect(() => {
    meRef.current = userId;
  }, [userId]);

  useEffect(() => {
    wipe();
    const channel = supabase.channel(`class-board:${classId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const seg = payload.segment as Segment;
        history.current.push(seg);
        paint(seg);
      })
      .on("broadcast", { event: "clear" }, () => {
        history.current = [];
        wipe();
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        if (!history.current.length) return;
        void channel.send({
          type: "broadcast",
          event: "sync-state",
          payload: { to: payload.from, segments: history.current.slice(-4000) },
        });
      })
      .on("broadcast", { event: "sync-state" }, ({ payload }) => {
        if (payload.to !== meRef.current || history.current.length) return;
        history.current = payload.segments as Segment[];
        replay(history.current);
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          void channel.send({
            type: "broadcast",
            event: "sync-request",
            payload: { from: meRef.current },
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [classId, paint, replay, wipe]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const next = point(e);
    const segment: Segment = {
      x0: last.current.x,
      y0: last.current.y,
      x1: next.x,
      y1: next.y,
      color: erasing ? "#ffffff" : color,
      width: erasing ? width * 4 : width,
    };
    last.current = next;
    history.current.push(segment);
    paint(segment);
    void channelRef.current?.send({ type: "broadcast", event: "stroke", payload: { segment } });
  }

  function stop() {
    drawing.current = false;
    last.current = null;
  }

  function clearBoard() {
    history.current = [];
    wipe();
    void channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }

  function saveImage() {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${classId.slice(0, 8)}.png`;
    a.click();
  }

  return (
    <Card className="border-border shadow-soft">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Scratch pad</h3>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Everyone in this class sees your strokes live."
                : "Connecting the shared board…"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {PENS.map((pen) => (
              <button
                key={pen.value}
                type="button"
                aria-label={`${pen.label} pen`}
                aria-pressed={!erasing && color === pen.value}
                onClick={() => {
                  setColor(pen.value);
                  setErasing(false);
                }}
                className={cn(
                  "size-6 rounded-full border-2 transition",
                  !erasing && color === pen.value
                    ? "border-foreground scale-110"
                    : "border-border",
                )}
                style={{ backgroundColor: pen.value }}
              />
            ))}
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-label={`Stroke ${w}`}
                  aria-pressed={width === w}
                  onClick={() => setWidth(w)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded",
                    width === w ? "bg-secondary" : "hover:bg-muted",
                  )}
                >
                  <span
                    className="block rounded-full bg-foreground"
                    style={{ width: w, height: w }}
                  />
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant={erasing ? "default" : "outline"}
              onClick={() => setErasing((v) => !v)}
            >
              {erasing ? <Eraser className="size-4" /> : <PenLine className="size-4" />}
              {erasing ? "Erasing" : "Drawing"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={saveImage}>
              <Download className="size-4" />
              Save
            </Button>
            {canClear && (
              <Button type="button" size="sm" variant="ghost" onClick={clearBoard}>
                <Trash2 className="size-4" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={BOARD_W}
          height={BOARD_H}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          className="w-full touch-none rounded-lg border border-border bg-white"
          style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
        />
      </CardContent>
    </Card>
  );
}
