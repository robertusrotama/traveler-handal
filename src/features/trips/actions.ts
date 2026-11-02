"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { tripFormSchema } from "@/lib/schemas/trip";
import { createClient } from "@/lib/supabase/server";
import { rpcErrorMessage, toCreateTripArgs, toTripUpdate } from "./mapping";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Data trip tidak valid.";
const SAVE_FAILED = "Gagal menyimpan perubahan. Coba lagi sebentar lagi.";

export async function createTrip(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = tripFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { ok: false, error: "Masuk dengan Google dulu untuk membuat trip." };

  const { data, error } = await supabase.rpc("create_trip", toCreateTripArgs(parsed.data));
  if (error || !data) return { ok: false, error: rpcErrorMessage(error) };

  revalidatePath("/trips");
  return { ok: true, id: data };
}

export async function updateTrip(tripId: unknown, input: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(tripId);
  const parsed = tripFormSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Trip tidak ditemukan." };
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi kamu habis. Masuk lagi, ya." };

  const { data: trip } = await supabase
    .from("trips")
    .select("owner_id, start_date, end_date, title, country_code, cities, travelers_count, interests, interests_note, pace, budget_level")
    .eq("id", id.data)
    .maybeSingle();
  if (!trip || trip.owner_id !== user.id) return { ok: false, error: "Hanya owner yang bisa mengubah trip ini." };

  if (trip.start_date !== v.start_date || trip.end_date !== v.end_date) {
    const { error } = await supabase.rpc("update_trip_dates", {
      p_trip_id: id.data,
      p_start_date: v.start_date,
      p_end_date: v.end_date,
    });
    if (error) return { ok: false, error: rpcErrorMessage(error) };
  }

  const patch = toTripUpdate(trip, v);
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("trips").update(patch).eq("id", id.data);
    if (error) {
      console.error("updateTrip", error);
      return { ok: false, error: SAVE_FAILED };
    }
  }

  revalidatePath("/trips");
  revalidatePath(`/trips/${id.data}`);
  return { ok: true };
}

const statusSchema = z.object({ tripId: z.uuid(), status: z.enum(["active", "archived"]) });

export async function setTripStatus(tripId: unknown, status: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse({ tripId, status });
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  const supabase = await createClient();
  // Hanya kirim `status` (column-level grant). RLS membatasi ke owner → 0 baris bila bukan owner.
  const { data, error } = await supabase
    .from("trips")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.tripId)
    .select("id");
  if (error) {
    console.error("setTripStatus", error);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!data.length) return { ok: false, error: "Hanya owner yang bisa mengarsipkan trip ini." };

  revalidatePath("/trips");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
