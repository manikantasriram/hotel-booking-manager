// Class-name helpers shared by components. They live outside ui.tsx so that file only exports
// components (React's fast refresh needs that).

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-line-strong bg-white text-ink hover:border-brand hover:text-brand",
  danger: "border border-bad-line bg-white text-bad hover:bg-bad-soft",
  ghost: "text-mute hover:bg-hover hover:text-ink",
};

/** Shared look for anything that should look like a button, including router links. */
export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
    variants[variant],
    className,
  );
}

export const APP_NAME = "Hotel Rate & Booking Manager";
