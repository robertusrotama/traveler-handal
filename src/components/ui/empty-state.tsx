import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  /** Ikon dekoratif (mis. `<MapPin />` dari lucide-react). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Biasanya satu `<Button>` CTA. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-4 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-7"
        >
          {icon}
        </div>
      )}
      <h2 className="text-display-sm text-ink">{title}</h2>
      {description && (
        <p className="max-w-md text-body-md text-muted">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
