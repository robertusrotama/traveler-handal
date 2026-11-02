"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Track 48×28, area sentuh 48×44. Pasangkan dengan `<Label htmlFor>` atau `aria-label`. */
export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-muted-soft p-0.5 transition-colors after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-6 rounded-full bg-canvas shadow-card transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
