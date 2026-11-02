import Link from "next/link";
import { Users } from "lucide-react";
import { tripGradient } from "@/components/trip-color";
import type { Tables } from "@/types/database";
import { countryName } from "../countries";
import { formatTripDates } from "../dates";
import { ArchiveButton } from "./archive-button";

export type TripCardData = Pick<
  Tables<"trips">,
  "id" | "title" | "country_code" | "cities" | "start_date" | "end_date" | "status"
> & { memberCount: number };

export function TripCard({ trip, isOwner }: { trip: TripCardData; isOwner: boolean }) {
  const more = trip.cities.length - 1;
  return (
    <article className="relative flex flex-col overflow-hidden rounded-md border border-hairline bg-canvas transition-shadow hover:shadow-card has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <div className="flex h-32 items-end gap-2 p-4" style={{ backgroundImage: tripGradient(trip.id) }}>
        <p className="min-w-0 truncate text-display-xl text-ink">{trip.cities[0]}</p>
        {more > 0 && <p className="shrink-0 pb-1.5 text-caption text-body">+{more} kota</p>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-title-md">
          <Link
            href={`/trips/${trip.id}`}
            className="text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {trip.title}
          </Link>
        </h3>
        <p className="text-body-sm text-muted">
          {countryName(trip.country_code)} · {formatTripDates(trip.start_date, trip.end_date)}
        </p>
        <p className="flex items-center gap-1.5 text-body-sm text-muted">
          <Users aria-hidden="true" className="size-4" />
          {trip.memberCount} anggota
        </p>
      </div>
      {isOwner && (
        // z-10: di atas area klik link kartu.
        <div className="relative z-10 flex justify-end border-t border-hairline-soft px-2 py-1">
          <ArchiveButton tripId={trip.id} title={trip.title} archived={trip.status === "archived"} />
        </div>
      )}
    </article>
  );
}
