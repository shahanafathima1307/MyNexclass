import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, formatBytes, validateFile } from "@/lib/assignments";

interface FileDropProps {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
  disabled?: boolean;
}

/** Drag-and-drop multi file picker with type/size validation. */
export function FileDrop({ files, onChange, label, disabled }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: File[] = [];
    for (const file of Array.from(incoming)) {
      const problem = validateFile(file);
      if (problem) toast.error(problem);
      else if (!files.some((f) => f.name === file.name && f.size === file.size)) {
        accepted.push(file);
      }
    }
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={label ?? "Add files"}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors",
          over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <FileUp className="size-5 text-muted-foreground" aria-hidden />
        <span className="font-medium">{label ?? "Drag files here or browse"}</span>
        <span className="text-xs text-muted-foreground">
          PDF, DOCX, PPTX, XLSX, JPG, PNG, ZIP or video — up to 50 MB each
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {formatBytes(file.size)}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onChange(files.filter((f) => f !== file))}
                >
                  <X className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
