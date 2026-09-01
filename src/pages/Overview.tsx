import { useEffect, useState } from "react";
import { KpiCard } from "../components/KpiCard";
import { TrendPanel } from "../components/TrendPanel";
import { FlagStrip } from "../components/FlagStrip";
import { RootLine } from "../components/ui";
import {
  fetchListensSeries,
  fetchOverview,
  fetchRateFlags,
  fetchSignupsSeries,
  rangeToParams,
  type RangeKey,
} from "../lib/api";
import type { RateFlag, SeriesPoint, Overview as OverviewData } from "../lib/types";

export function Overview() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [flags, setFlags] = useState<RateFlag[] | null>(null);
  const [flagsLoading, setFlagsLoading] = useState(true);

  const [signups, setSignups] = useState<SeriesPoint[] | null>(null);
  const [signupsErr, setSignupsErr] = useState<string | null>(null);
  const [signupsLoading, setSignupsLoading] = useState(true);
  const [signupRange, setSignupRange] = useState<RangeKey>("30d");

  const [listens, setListens] = useState<SeriesPoint[] | null>(null);
  const [listensErr, setListensErr] = useState<string | null>(null);
  const [listensLoading, setListensLoading] = useState(true);
  const [listenRange, setListenRange] = useState<RangeKey>("30d");

  useEffect(() => {
    let active = true;
    fetchOverview().then((r) => {
      if (!active) return;
      setOverview(r.data);
      setOverviewLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchRateFlags().then((r) => {
      if (!active) return;
      setFlags(r.data);
      setFlagsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSignupsLoading(true);
    fetchSignupsSeries(signupRange).then((r) => {
      if (!active) return;
      setSignups(r.data);
      setSignupsErr(r.error);
      setSignupsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [signupRange]);

  useEffect(() => {
    let active = true;
    setListensLoading(true);
    fetchListensSeries(listenRange).then((r) => {
      if (!active) return;
      setListens(r.data);
      setListensErr(r.error);
      setListensLoading(false);
    });
    return () => {
      active = false;
    };
  }, [listenRange]);

  return (
    <div>
      <FlagStrip flags={flags} loading={flagsLoading} />

      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-copper-deep">
          Audience
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-espresso">
          Overview
        </h1>
        <RootLine className="mt-4" />
      </header>

      <section className="mb-7 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          value={overview?.total_users ?? null}
          loading={overviewLoading}
          sublabel={
            overview && overview.signups_7d > 0
              ? `+${overview.signups_7d.toLocaleString("en-ZA")} this week`
              : undefined
          }
        />
        <KpiCard
          label="Storytellers"
          value={overview?.total_storytellers ?? null}
          loading={overviewLoading}
        />
        <KpiCard
          label="Roots"
          value={overview?.total_roots ?? null}
          loading={overviewLoading}
        />
        <KpiCard
          label="Total listens"
          value={overview?.total_listens ?? null}
          loading={overviewLoading}
          accent="lime"
        />
        <KpiCard
          label="Listens this week"
          value={overview?.listens_7d ?? null}
          loading={overviewLoading}
          accent="lime"
        />
        <KpiCard
          label="Hours of roots (all)"
          value={overview?.total_seconds_all ?? null}
          loading={overviewLoading}
          kind="hours"
        />
        <KpiCard
          label="Hours of roots (active)"
          value={overview?.total_seconds_active ?? null}
          loading={overviewLoading}
          kind="hours"
        />
        <KpiCard
          label="Storage used"
          value={overview?.storage_bytes ?? null}
          loading={overviewLoading}
          kind="bytes"
          accent="lime"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendPanel
          title="Signups over time"
          color="#B46C48"
          data={signups}
          loading={signupsLoading}
          error={signupsErr}
          range={signupRange}
          bucket={rangeToParams(signupRange).bucket}
          onRangeChange={setSignupRange}
        />
        <TrendPanel
          title="Listens over time"
          color="#9FA573"
          data={listens}
          loading={listensLoading}
          error={listensErr}
          range={listenRange}
          bucket={rangeToParams(listenRange).bucket}
          onRangeChange={setListenRange}
        />
      </section>
    </div>
  );
}
