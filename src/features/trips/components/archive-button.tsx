"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setTripStatus } from "../actions";

export function ArchiveButton({ tripId, title, archived }: { tripId: string; title: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();

  function run(status: "active" | "archived") {
    startTransition(async () => {
      const r = await setTripStatus(tripId, status);
      if (!r.ok) {
        toast({ title: r.error, variant: "error" });
      } else if (status === "archived") {
        toast({ title: "Trip diarsipkan", action: { label: "Urungkan", onClick: () => run("active") } });
      } else {
        toast({ title: "Trip dipulihkan" });
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-11"
      loading={pending}
      aria-label={`${archived ? "Pulihkan" : "Arsipkan"} ${title}`}
      onClick={() => run(archived ? "active" : "archived")}
    >
      {!pending && (archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />)}
      {archived ? "Pulihkan" : "Arsipkan"}
    </Button>
  );
}
