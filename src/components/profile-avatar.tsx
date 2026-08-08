import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/session";
import { resolveAvatarUrl } from "@/lib/tutoring";

export function ProfileAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string | null;
  avatarUrl: string | null;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSrc(null);
    if (!avatarUrl) return;
    resolveAvatarUrl(avatarUrl)
      .then((url) => active && setSrc(url))
      .catch(() => active && setSrc(null));
    return () => {
      active = false;
    };
  }, [avatarUrl]);

  return (
    <Avatar className={cn("size-11", className)}>
      {src && <AvatarImage src={src} alt={name || "Profile picture"} />}
      <AvatarFallback>{initialsOf(name || "?")}</AvatarFallback>
    </Avatar>
  );
}
