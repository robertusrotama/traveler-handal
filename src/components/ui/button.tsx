import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors select-none [&_svg]:size-5 [&_svg]:shrink-0 aria-disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "rounded-sm bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active aria-disabled:bg-primary-disabled",
        secondary:
          "rounded-sm border border-ink bg-canvas text-ink hover:bg-surface-soft aria-disabled:border-border-strong aria-disabled:bg-canvas aria-disabled:text-muted-soft",
        tertiary:
          "rounded-sm text-ink underline-offset-4 hover:underline aria-disabled:text-muted-soft aria-disabled:no-underline",
        pill: "rounded-full bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active aria-disabled:bg-primary-disabled",
        ghost:
          "rounded-sm text-ink hover:bg-surface-strong aria-disabled:bg-transparent aria-disabled:text-muted-soft",
        destructive:
          "rounded-sm bg-error text-on-primary hover:bg-error-hover active:bg-error-hover aria-disabled:opacity-50",
      },
      size: {
        md: "h-12 px-6 text-base",
        sm: "h-10 px-4 text-sm",
        // 40px visual; area sentuh diperluas ke 44px lewat pseudo-element.
        icon: "size-10 rounded-full p-0 after:absolute after:-inset-0.5 after:content-['']",
      },
    },
    compoundVariants: [
      { variant: "pill", size: "md", className: "px-5" },
      { variant: "tertiary", className: "px-2" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

/**
 * Status nonaktif memakai `aria-disabled` (bukan atribut `disabled`) supaya tombol tetap bisa difokus
 * dan pembaca layar tahu alasannya; klik diblokir di sini.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  onClick,
  children,
  type,
  ...props
}: ButtonProps) {
  const inactive = disabled || loading;
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? "button")}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (inactive) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner label={null} />}
          {children}
        </>
      )}
    </Comp>
  );
}
