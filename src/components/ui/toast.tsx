"use client";

import { useSyncExternalStore } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: "default" | "error";
  /** Mis. `{ label: "Urungkan", onClick: restore }` untuk undo hapus. */
  action?: { label: string; onClick: () => void; altText?: string };
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

// Store modul sederhana: `toast()` bisa dipanggil dari mana saja (handler, mutation callback).
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: ToastItem[] = [];

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(input: ToastInput) {
  const id = nextId++;
  items = [...items, { ...input, id }].slice(-3);
  emit();
  return { id, dismiss: () => dismiss(id) };
}

export function useToast() {
  return { toast, dismiss };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );

  return (
    <ToastPrimitive.Provider label="Notifikasi" swipeDirection="down">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          // Toast dengan aksi (undo) diberi waktu lebih lama agar sempat ditekan.
          duration={t.duration ?? (t.action ? 8000 : 5000)}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "flex w-full items-start gap-3 rounded-md p-4 text-on-primary shadow-card data-[state=open]:animate-slide-up data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y) data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-[translate]",
            t.variant === "error" ? "bg-error" : "bg-ink",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
            <ToastPrimitive.Title className="text-title-sm">
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="text-body-sm opacity-90">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          {t.action && (
            <ToastPrimitive.Action
              altText={t.action.altText ?? t.action.label}
              onClick={t.action.onClick}
              className="-my-1 inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-title-md underline underline-offset-4 hover:bg-white/10 focus-visible:outline-white"
            >
              {t.action.label}
            </ToastPrimitive.Action>
          )}
          <ToastPrimitive.Close
            aria-label="Tutup notifikasi"
            className="-my-1.5 -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-white"
          >
            <X aria-hidden="true" className="size-5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-[100] flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none md:right-0 md:left-auto md:w-full md:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}
