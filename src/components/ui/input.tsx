"use client";

import { cn } from "@/lib/utils";
import { useFieldControl } from "./field";

// Fokus: border 2px ink (1px border + 1px ring, tanpa geser layout), tanpa glow — sesuai referensi text-input.
export const controlClass =
  "w-full rounded-sm border border-hairline bg-canvas px-3 text-body-md text-ink placeholder:text-muted outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink focus-visible:outline-none aria-invalid:border-error aria-invalid:ring-1 aria-invalid:ring-error disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted";

export function Input({
  className,
  type = "text",
  ...props
}: React.ComponentProps<"input">) {
  const field = useFieldControl(props);
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(controlClass, "h-14", className)}
      {...props}
      {...field}
    />
  );
}
