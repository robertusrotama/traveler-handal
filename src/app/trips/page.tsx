import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Map, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TripCard, type TripCardData } from "@/features/trips/components/trip-card";
import { UserMenu } from "@/features/trips/components/user-menu";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trip kamu" };

function TripGrid({ trips, ownerId }: { trips: (TripCardData & { owner_id: string })[]; ownerId: string }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {trips.map((t) => (
        <li key={t.id} className="flex">
          <TripCard trip={t} isOwner={t.owner_id === ownerId} />
        </li>
      ))}
    </ul>
  );
}

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/trips");

  // RLS: hanya trip tempat user jadi member aktif. Member dicabut (revoked_at) tidak dihitung.
  const { data, error } = await supabase
    .from("trips")
    .select("id, title, country_code, cities, start_date, end_date, status, owner_id, trip_members(revoked_at)")
    .order("start_date", { ascending: true });

  const trips = (data ?? []).map(({ trip_members, ...t }) => ({
    ...t,
    memberCount: trip_members.filter((m) => m.revoked_at === null).length,
  }));
  const active = trips.filter((t) => t.status === "active");
  const owned = active.filter((t) => t.owner_id === user.id);
  const joined = active.filter((t) => t.owner_id !== user.id);
  const archived = trips.filter((t) => t.status === "archived").reverse();
  const canCreate = !user.is_anonymous;

  const createCta = (
    <Link href="/trips/new" className={buttonVariants()}>
      <Plus aria-hidden="true" />
      Buat trip
    </Link>
  );

  return (
    <AppShell actions={<UserMenu user={user} />}>
      <div className="flex flex-col gap-8 md:gap-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-display-xl text-ink">Trip kamu</h1>
          {canCreate && active.length > 0 && createCta}
        </div>

        {!canCreate && (
          <div className="flex flex-col gap-3 rounded-md bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-md text-ink">
              Kamu masuk sebagai tamu. Tamu bisa ikut mengedit trip teman, tapi belum bisa membuat trip sendiri.
            </p>
            <Link href="/login?next=/trips/new" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Masuk dengan Google
            </Link>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-body-md text-error">
            Gagal memuat daftar trip. Muat ulang halaman, ya.
          </p>
        ) : active.length === 0 ? (
          <EmptyState
            icon={<Map />}
            title="Belum ada trip"
            description={
              canCreate
                ? "Tentukan tujuan dan tanggal, lalu biarkan AI menyusun draft itinerary-nya."
                : "Buka link undangan dari teman untuk ikut trip mereka."
            }
            action={canCreate ? createCta : undefined}
          />
        ) : null}

        {owned.length > 0 && (
          <section aria-labelledby="trip-saya" className="flex flex-col gap-4">
            <h2 id="trip-saya" className="text-display-sm text-ink">
              Trip saya
            </h2>
            <TripGrid trips={owned} ownerId={user.id} />
          </section>
        )}

        {joined.length > 0 && (
          <section aria-labelledby="trip-diikuti" className="flex flex-col gap-4">
            <h2 id="trip-diikuti" className="text-display-sm text-ink">
              Trip yang saya ikuti
            </h2>
            <TripGrid trips={joined} ownerId={user.id} />
          </section>
        )}

        {archived.length > 0 && (
          <details className="group flex flex-col gap-4">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-sm text-display-sm text-ink [&::-webkit-details-marker]:hidden">
              <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
              Diarsipkan ({archived.length})
            </summary>
            <div className="pt-4">
              <TripGrid trips={archived} ownerId={user.id} />
            </div>
          </details>
        )}
      </div>
    </AppShell>
  );
}
