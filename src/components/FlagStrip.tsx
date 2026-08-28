import type { RateFlag } from "../lib/types";

type Props = {
  flags: RateFlag[] | null;
  loading?: boolean;
};

// Live attention strip. Renders nothing when there are no flags, so the page
// stays calm when all is well.
export function FlagStrip({ flags, loading }: Props) {
  if (loading || !flags || flags.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-copper/40 bg-copper/5">
      <div className="flex items-center gap-2 border-b border-copper/20 px-4 py-2.5">
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-copper px-1.5 text-[11px] font-bold text-[#FBFAF5]"
          aria-hidden
        >
          {flags.length}
        </span>
        <span className="font-display text-sm font-semibold text-espresso">
          Rate flags &middot; unusual activity in the last hour
        </span>
      </div>
      <ul className="divide-y divide-copper/15">
        {flags.map((f) => {
          const name =
            f.display_name?.trim() ||
            (f.handle ? `@${f.handle}` : `user ${f.owner_id.slice(0, 8)}`);
          return (
            <li
              key={f.owner_id}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{name}</span>
                {f.handle && f.display_name && (
                  <span className="ml-2 text-ink/45">@{f.handle}</span>
                )}
              </span>
              <span className="ml-3 flex-none font-semibold tabular-nums text-copper-deep">
                {f.roots_last_hour.toLocaleString("en-ZA")} roots / hr
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
