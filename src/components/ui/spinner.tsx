import { cn } from "@/lib/utils";

export function Spinner({
  className,
  label = "Memuat",
}: {
  className?: string;
  /** Teks untuk pembaca layar; isi `null` bila konteks sudah menjelaskan (mis. di dalam tombol berlabel). */
  label?: string | null;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      className={cn("inline-flex", className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="size-[1.25em] animate-spin"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
