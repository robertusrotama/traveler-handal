"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { CloseButton, overlayClass } from "./dialog";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sides = {
  // Bottom sheet di mobile; di layar lebar tetap dari bawah tapi selebar dialog.
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=open]:animate-slide-up md:left-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2",
  right:
    "inset-y-0 right-0 h-full w-full max-w-md data-[state=open]:animate-slide-in-right",
};

export function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof sides;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className={overlayClass} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto bg-canvas p-6 text-ink shadow-card",
          sides[side],
          className,
        )}
        {...props}
      >
        {children}
        <CloseButton />
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1 pr-10", className)} {...props} />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("text-display-sm", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-body-md text-body", className)}
      {...props}
    />
  );
}
