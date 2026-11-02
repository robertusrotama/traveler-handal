import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Token kustom dari globals.css harus dikenal tailwind-merge, kalau tidak `text-display-lg` dianggap warna & bentrok dengan `text-ink`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-xl",
        "display-lg",
        "display-md",
        "display-sm",
        "title-md",
        "title-sm",
        "body-md",
        "body-sm",
        "caption",
        "caption-sm",
        "badge",
      ],
      shadow: ["card"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
