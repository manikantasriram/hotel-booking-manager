// Small, reusable building blocks. Keeping them here means every page looks and behaves the same.

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { APP_NAME, buttonClass, cx, type Variant } from "./classes";

// ---------- icons ----------
// A few hand-drawn 24px icons in one stroke style, so no emoji or text glyphs stand in for icons.
const iconPaths = {
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 18l-6-6 6-6",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  sort: "M8 10l4-4 4 4M8 14l4 4 4-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
} as const;

export type IconName = keyof typeof iconPaths;

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

// ---------- buttons ----------
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

// ---------- form controls ----------
/** A label + control + error message, wired up for screen readers. */
export function Field({
  label,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-mute"> (optional)</span>}
      </label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="text-sm text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-sm text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlBase =
  "rounded-lg border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-mute transition-colors " +
  "hover:border-mute focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-mute aria-invalid:border-bad";

// Controls are full width unless the caller gives them a width class (w-40, sm:w-56...).
const hasWidth = (className?: string) => /(^|\s)([a-z]+:)?w-/.test(className ?? "");

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlBase, "h-10", !hasWidth(className) && "w-full", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(controlBase, "h-10 pr-8", !hasWidth(className) && "w-full", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlBase, "w-full py-2", className)} {...props} />;
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-brand" {...props} />
      {label}
    </label>
  );
}

// ---------- surfaces and status ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-line bg-white", className)}>{children}</div>;
}

type Tone = "slate" | "green" | "red" | "blue" | "amber";

const tones: Record<Tone, string> = {
  slate: "bg-hover text-mute",
  green: "bg-ok-soft text-ok",
  red: "bg-bad-soft text-bad",
  blue: "bg-brand-soft text-brand-dark",
  amber: "bg-warn-soft text-warn",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-mute">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad-line bg-bad-soft px-3 py-2 text-sm text-bad">
      <Icon name="alert" className="mt-0.5 h-4 w-4" />
      <span>{message}</span>
    </p>
  );
}

/** Shown where a list would be when it has nothing in it yet. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-mute">{children}</div>}
    </div>
  );
}

/** The page's heading. It also names the browser tab, so every page has its own title. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <title>{`${title} · ${APP_NAME}`}</title>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A modal built on the native <dialog>: it traps focus and closes on Escape for free. */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on the backdrop
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-white p-0 text-ink shadow-[0_24px_48px_-12px_rgb(14_26_51/0.25)] backdrop:bg-ink/40"
      aria-labelledby={titleId}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-hover hover:text-ink"
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";

/** A 1–5 star rating. Filled and outlined stars both stand out from the page (3:1 or more). */
export function Stars({ count }: { count: number }) {
  return (
    <span role="img" aria-label={`${count} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={cx("h-4 w-4", n <= count ? "text-star" : "text-mute")}
          fill={n <= count ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
}
