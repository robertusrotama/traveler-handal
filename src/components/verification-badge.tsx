import { CircleAlert, Hand, MapPinCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type VerificationStatus = "verified" | "unverified" | "manual" | "none";

// Status tidak boleh hanya warna: selalu ikon + label teks.
const config = {
  verified: { label: "Ada di peta", Icon: MapPinCheck },
  unverified: { label: "Belum terverifikasi", Icon: CircleAlert },
  manual: { label: "Dipilih manual", Icon: Hand },
} as const;

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  if (status === "none") return null;
  const { label, Icon } = config[status];
  return (
    <Badge variant={status} className={className}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
