import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Wordmark({ className = "" }: { className?: string }) {
  return <img src="/roots_wordmark.png" alt="Roots" className={className} />;
}

/** The signature rootwork hairline used under section titles. */
export function RootLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-[2px] w-full opacity-55 ${className}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, var(--color-copper) 0 10px, transparent 10px 16px)",
      }}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink/12 bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-copper ${className}`}
      aria-hidden
    />
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-copper text-[#FBFAF5] hover:bg-copper-deep"
      : "border border-ink/12 bg-transparent text-ink hover:bg-surface-2";
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
