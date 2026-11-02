"use client";

import { cn } from "@/lib/utils";
import { useFieldControl } from "./field";
import { controlClass } from "./input";

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  const field = useFieldControl(props);
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClass, "min-h-28 py-3", className)}
      {...props}
      {...field}
    />
  );
}
