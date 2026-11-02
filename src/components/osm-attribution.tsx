import { cn } from "@/lib/utils";

/** Atribusi wajib untuk data/tile OpenStreetMap (ODbL). */
export function OsmAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-caption-sm text-muted", className)}>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted underline underline-offset-2 hover:text-ink"
      >
        © OpenStreetMap contributors
        <span className="sr-only"> (membuka tab baru)</span>
      </a>
    </p>
  );
}
