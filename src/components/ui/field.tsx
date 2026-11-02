"use client";

import { createContext, useContext, useId } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type FieldControl = { id: string; describedBy?: string; invalid: boolean };

const FieldContext = createContext<FieldControl | null>(null);

/** Dipakai Input/Textarea/SelectTrigger agar id, aria-describedby, dan aria-invalid tersambung otomatis. */
export function useFieldControl(props: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
}) {
  const field = useContext(FieldContext);
  const describedBy =
    [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") ||
    undefined;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid || undefined),
  };
}

export function Field({
  label,
  hint,
  error,
  required,
  id,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** id kontrol; default dibuat otomatis. */
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{
        id: controlId,
        describedBy: [errorId, hintId].filter(Boolean).join(" ") || undefined,
        invalid: Boolean(error),
      }}
    >
      <div data-slot="field" className={cn("flex flex-col gap-2", className)}>
        <Label htmlFor={controlId}>
          {label}
          {required && (
            <span className="text-error" aria-hidden="true">
              {" "}
              *
            </span>
          )}
          {required && <span className="sr-only"> (wajib)</span>}
        </Label>
        {children}
        {hint && (
          <p id={hintId} className="text-body-sm text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-body-sm text-error"
          >
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
