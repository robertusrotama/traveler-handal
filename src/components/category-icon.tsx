import {
  BedDouble,
  Bus,
  Flower,
  Landmark,
  MapPin,
  MoonStar,
  Mountain,
  Palette,
  ShoppingBag,
  Trees,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  kuliner: Utensils,
  alam: Trees,
  sejarah_budaya: Landmark,
  belanja: ShoppingBag,
  seni_museum: Palette,
  hiburan_malam: MoonStar,
  santai_spa: Flower,
  outdoor: Mountain,
  transportasi: Bus,
  akomodasi: BedDouble,
  lainnya: MapPin,
};

/** Ikon kategori dalam tile `primary-soft` (pengganti foto). Dekoratif kecuali `label` diisi. */
export function CategoryIcon({
  category,
  label,
  className,
}: {
  category: string;
  /** Isi bila ikon berdiri sendiri tanpa teks kategori di dekatnya. */
  label?: string;
  className?: string;
}) {
  const Icon = icons[category] ?? MapPin;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}
