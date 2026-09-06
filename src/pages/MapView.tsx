import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RootLine, Button, Spinner } from "../components/ui";
import { MAPBOX_TOKEN, HERITAGE_OWNER_ID } from "../config";
import { fetchMapRoots, fetchMapRoutes, fetchRootAudioUrl, movePin } from "../lib/api";
import type { MapRoot, MapRoute, PinMoveResult } from "../lib/types";

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const ROOT_COLOR: unknown = [
  "case",
  ["==", ["get", "status"], "hidden"],
  "#9aa0a6",
  ["match", ["get", "visibility"], "Public", "#0E7C86", "Friends", "#B46C48", "Private", "#603018", "#8A7855"],
];

function rootsToGeo(roots: MapRoot[]) {
  return {
    type: "FeatureCollection",
    features: roots
      .filter((r) => num(r.lng) !== null && num(r.lat) !== null)
      .map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [num(r.lng), num(r.lat)] },
        properties: { root_id: r.root_id, status: r.status ?? "active", visibility: r.visibility ?? "" },
      })),
  };
}

function routesToLineGeo(routes: MapRoute[]) {
  return {
    type: "FeatureCollection",
    features: routes
      .map((rt) => {
        const coords = (rt.stops ?? [])
          .map((s) => [num(s.lng), num(s.lat)])
          .filter((c) => c[0] !== null && c[1] !== null) as [number, number][];
        return { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} };
      })
      .filter((f) => (f.geometry.coordinates as unknown[]).length >= 2),
  };
}

function routesToStopGeo(routes: MapRoute[]) {
  const feats: unknown[] = [];
  for (const rt of routes) {
    for (const s of rt.stops ?? []) {
      const lng = num(s.lng);
      const lat = num(s.lat);
      if (lng === null || lat === null) continue;
      feats.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} });
    }
  }
  return { type: "FeatureCollection", features: feats };
}

function StatusVis({ status, visibility }: { status: string | null; visibility: string | null }) {
  const hidden = status === "hidden";
  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          hidden ? "bg-ink/10 text-ink/60" : "bg-olive/20 text-[#4c5330]"
        }`}
      >
        {hidden ? "Hidden" : status ?? "active"}
      </span>
      {visibility && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/60">
          {visibility}
        </span>
      )}
    </div>
  );
}

function Player({ rootId }: { rootId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    setError(null);
    setLoading(false);
  }, [rootId]);
  async function load() {
    setLoading(true);
    setError(null);
    const r = await fetchRootAudioUrl(rootId);
    if (r.error) setError(r.error);
    else setUrl(r.data);
    setLoading(false);
  }
  return (
    <div>
      {url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={url} className="w-full" />
      ) : (
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-surface-2 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Play audio"}
        </button>
      )}
      {error && <div className="mt-1 text-xs text-danger">{error}</div>}
    </div>
  );
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const editMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const didFitRef = useRef(false);

  const [roots, setRoots] = useState<MapRoot[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [heritageOnly, setHeritageOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Edit state (Heritage pins only).
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<PinMoveResult | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roots.filter((r) => {
      if (heritageOnly && r.owner_id !== HERITAGE_OWNER_ID) return false;
      if (!q) return true;
      return (
        (r.owner_handle ?? "").toLowerCase().includes(q) ||
        (r.owner_display_name ?? "").toLowerCase().includes(q) ||
        (r.owner_email ?? "").toLowerCase().includes(q) ||
        (r.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [roots, search, heritageOnly]);

  const filteredRoutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return routes.filter((rt) => {
      if (heritageOnly && rt.owner_id !== HERITAGE_OWNER_ID) return false;
      if (!q) return true;
      return (rt.owner_handle ?? "").toLowerCase().includes(q);
    });
  }, [routes, search, heritageOnly]);

  const selected = useMemo(
    () => filtered.find((r) => r.root_id === selectedId) ?? roots.find((r) => r.root_id === selectedId) ?? null,
    [filtered, roots, selectedId]
  );
  const selectedIsHeritage = !!selected && selected.owner_id === HERITAGE_OWNER_ID;

  // Load data once.
  useEffect(() => {
    let active = true;
    Promise.all([fetchMapRoots(), fetchMapRoutes()]).then(([r, rt]) => {
      if (!active) return;
      if (r.error && rt.error) setError(r.error);
      setRoots(r.data ?? []);
      setRoutes(rt.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  // Init map once.
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setError("No Mapbox token found. Add VITE_MAPBOX_TOKEN to your .env and restart the dev server.");
      setLoading(false);
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [25, -29],
      zoom: 4,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("error", (e) => {
      const msg = (e && (e as { error?: { message?: string } }).error?.message) || "Unknown map error.";
      if (/401|unauthor|access token|forbidden|not allowed/i.test(msg)) {
        setError(
          "Mapbox rejected the token. It's likely URL-restricted — add http://localhost:5173 (and your admin domain) to this token's allowed URLs, or use an unrestricted public token."
        );
      }
    });

    map.on("load", () => {
      loadedRef.current = true;
      map.resize();

      map.addSource("routes", { type: "geojson", data: routesToLineGeo([]) as never });
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        paint: { "line-color": "#B46C48", "line-width": 2, "line-opacity": 0.6, "line-dasharray": [2, 1] },
      });
      map.addSource("route-stops", { type: "geojson", data: routesToStopGeo([]) as never });
      map.addLayer({
        id: "route-stops",
        type: "circle",
        source: "route-stops",
        paint: { "circle-radius": 3, "circle-color": "#B46C48", "circle-opacity": 0.75 },
      });
      map.addSource("roots", { type: "geojson", data: rootsToGeo([]) as never });
      map.addLayer({
        id: "roots-circles",
        type: "circle",
        source: "roots",
        paint: {
          "circle-radius": 6,
          "circle-color": ROOT_COLOR as never,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "roots-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as Record<string, string>).root_id;
        if (id) setSelectedId(id);
      });
      map.on("mouseenter", "roots-circles", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "roots-circles", () => (map.getCanvas().style.cursor = ""));

      setLoading(false);
    });

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push filtered data to the map + fit on filter change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource("roots") as mapboxgl.GeoJSONSource | undefined)?.setData(rootsToGeo(filtered) as never);
    (map.getSource("routes") as mapboxgl.GeoJSONSource | undefined)?.setData(
      routesToLineGeo(filteredRoutes) as never
    );
    (map.getSource("route-stops") as mapboxgl.GeoJSONSource | undefined)?.setData(
      routesToStopGeo(filteredRoutes) as never
    );

    const bounds = new mapboxgl.LngLatBounds();
    let any = false;
    for (const r of filtered) {
      const lng = num(r.lng);
      const lat = num(r.lat);
      if (lng !== null && lat !== null) {
        bounds.extend([lng, lat]);
        any = true;
      }
    }
    // Fit on first data and whenever a filter is applied.
    if (any && (!didFitRef.current || search.trim() || heritageOnly)) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 300 });
      didFitRef.current = true;
    }

    // Deselect if the selection fell out of the filter.
    if (selectedId && !filtered.some((r) => r.root_id === selectedId)) setSelectedId(null);
  }, [filtered, filteredRoutes, search, heritageOnly, selectedId]);

  // Selection → seed edit fields; manage the draggable edit marker.
  useEffect(() => {
    setSaveErr(null);
    setSaveResult(null);

    // Remove any prior edit marker.
    editMarkerRef.current?.remove();
    editMarkerRef.current = null;

    if (!selected) return;
    setEditLat(String(selected.lat));
    setEditLng(String(selected.lng));
    setEditLoc("");

    const map = mapRef.current;
    if (map && loadedRef.current && selected.owner_id === HERITAGE_OWNER_ID) {
      const marker = new mapboxgl.Marker({ color: "#B46C48", draggable: true })
        .setLngLat([selected.lng, selected.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setEditLat(ll.lat.toFixed(6));
        setEditLng(ll.lng.toFixed(6));
      });
      editMarkerRef.current = marker;
      map.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Typing coordinates repositions the marker live.
  useEffect(() => {
    const m = editMarkerRef.current;
    const lat = num(editLat);
    const lng = num(editLng);
    if (m && lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      m.setLngLat([lng, lat]);
    }
  }, [editLat, editLng]);

  const latNum = num(editLat);
  const lngNum = num(editLng);
  const coordsValid =
    latNum !== null && lngNum !== null && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const changed = !!selected && (Number(editLat) !== selected.lat || Number(editLng) !== selected.lng);

  async function onSave() {
    if (!selected || !coordsValid) return;
    setSaving(true);
    setSaveErr(null);
    setSaveResult(null);
    const r = await movePin(selected.root_id, latNum!, lngNum!, editLoc.trim() || undefined);
    setSaving(false);
    if (r.error) return setSaveErr(r.error);
    setSaveResult(r.data);
    // Reflect the new location in local state so the circle + fields update.
    setRoots((prev) =>
      prev.map((x) => (x.root_id === selected.root_id ? { ...x, lat: latNum!, lng: lngNum! } : x))
    );
  }

  function resetEdit() {
    if (!selected) return;
    setEditLat(String(selected.lat));
    setEditLng(String(selected.lng));
    setEditLoc("");
    setSaveErr(null);
    setSaveResult(null);
    editMarkerRef.current?.setLngLat([selected.lng, selected.lat]);
  }

  return (
    <div>
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-copper-deep">Content</div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-espresso">Map</h1>
          <div className="text-sm text-ink/55">
            {filtered.length.toLocaleString("en-ZA")} of {roots.length.toLocaleString("en-ZA")} roots
            {" · "}
            {filteredRoutes.length.toLocaleString("en-ZA")} routes
          </div>
        </div>
        <RootLine className="mt-4" />
      </header>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, handle, email or title"
          className="w-full max-w-sm rounded-xl border border-ink/12 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
        />
        <button
          onClick={() => setHeritageOnly((v) => !v)}
          className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            heritageOnly ? "border-copper bg-copper text-[#FBFAF5]" : "border-ink/12 text-ink/70 hover:bg-surface-2"
          }`}
        >
          Heritage only
        </button>
        {(search || heritageOnly) && (
          <button
            onClick={() => {
              setSearch("");
              setHeritageOnly(false);
            }}
            className="text-sm text-ink/55 underline underline-offset-2 hover:text-ink/80"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-ink/12" style={{ height: "74vh", minHeight: 440 }}>
        <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/60">
            <Spinner className="h-7 w-7" />
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 rounded-xl border border-ink/12 bg-paper/95 px-3 py-2.5 text-xs shadow-sm">
          <div className="mb-1.5 font-semibold text-ink/70">Roots</div>
          <div className="flex flex-col gap-1">
            {[
              { c: "#0E7C86", label: "Public" },
              { c: "#B46C48", label: "Friends" },
              { c: "#603018", label: "Private" },
              { c: "#9aa0a6", label: "Hidden" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.c }} />
                <span className="text-ink/60">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[340px] max-w-[calc(100%-1.5rem)] flex-col overflow-y-auto rounded-2xl border border-ink/12 bg-surface p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-espresso">
                {selected.title?.trim() || "Untitled root"}
              </h2>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg px-2 py-0.5 text-lg leading-none text-ink/40 hover:bg-surface-2 hover:text-ink/70"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-1 text-sm text-ink/60">
              {selected.owner_display_name?.trim() || "—"}
              {selected.owner_handle && <span className="text-ink/40"> · @{selected.owner_handle}</span>}
            </div>
            {selected.owner_email && <div className="text-xs text-ink/45">{selected.owner_email}</div>}

            <div className="mt-3">
              <StatusVis status={selected.status} visibility={selected.visibility} />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Listen</div>
              <Player rootId={selected.root_id} />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Location</div>

              {selectedIsHeritage ? (
                <div className="space-y-2">
                  <p className="text-xs text-ink/50">Drag the pin, or type exact coordinates.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ink/55">Latitude</span>
                      <input
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-ink/12 bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ink/55">Longitude</span>
                      <input
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-ink/12 bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-ink/55">Location label (optional)</span>
                    <input
                      value={editLoc}
                      onChange={(e) => setEditLoc(e.target.value)}
                      placeholder="Leave blank to keep current"
                      className="w-full rounded-lg border border-ink/12 bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                    />
                  </label>

                  {!coordsValid && (
                    <div className="text-xs text-danger">
                      Latitude must be -90 to 90, longitude -180 to 180.
                    </div>
                  )}
                  {saveErr && <div className="text-xs text-danger">{saveErr}</div>}
                  {saveResult && (
                    <div className="rounded-lg border border-olive/40 bg-olive/10 px-2.5 py-2 text-xs text-[#4c5330]">
                      Moved from {saveResult.old.lat.toFixed(5)}, {saveResult.old.lng.toFixed(5)} to{" "}
                      {saveResult.new.lat.toFixed(5)}, {saveResult.new.lng.toFixed(5)}.
                      {saveResult.audit_warning && (
                        <div className="mt-1 text-ink/45">Note: {saveResult.audit_warning}</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button onClick={onSave} disabled={saving || !coordsValid || !changed}>
                      {saving ? "Saving…" : "Save location"}
                    </Button>
                    <Button variant="ghost" onClick={resetEdit} disabled={saving || !changed}>
                      Reset
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm tabular-nums text-ink/70">
                    {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
                  </div>
                  <div className="mt-1.5 text-xs italic text-ink/45">
                    Editing is limited to owned (Heritage) accounts.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
