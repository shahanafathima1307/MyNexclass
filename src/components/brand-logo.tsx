import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * myNexClass wordmark — "my" in muted ink, "NexClass" in the teal→lime brand gradient.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold tracking-tight", className)}>
      <span className="text-muted-foreground">my</span>
      <span className="bg-gradient-to-r from-primary from-25% to-accent bg-clip-text text-transparent">
        NexClass
      </span>
    </span>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground",
        className,
      )}
    >
      <GraduationCap className="size-5" />
    </span>
  );
}
