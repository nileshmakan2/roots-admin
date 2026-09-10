import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RootLine, Button, Spinner } from "../components/ui";
import { MAPBOX_TOKEN, HERITAGE_OWNER_ID } from "../config";
import { fetchMapRoots, fetchMapRoutes, fetchRootAudioUrl, movePin, updateRootTitle } from "../lib/api";
import type { MapRoot, MapRoute, PinMoveResult } from "../lib/types";

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isBroken(r: MapRoot): boolean {
  return num(r.lat) === 0 && num(r.lng) === 0;
}

function colorFor(r: MapRoot): string {
  if (r.status === "hidden") return "#9aa0a6";
  switch (r.visibility) {
    case "Public":
      return "#0E7C86";
    case "Friends":
      return "#B46C48";
    case "Private":
      return "#603018";
    default:
      return "#8A7855";
  }
}

const MAX_LIST = 500; // cap rendered rows so a huge view stays smooth

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
  const [bounds, setBounds] = useState<mapboxgl.LngLatBounds | null>(null);

  // Name editing (Heritage only).
  const [editTitle, setEditTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleErr, setTitleErr] = useState<string | null>(null);
  const [titleSaved, setTitleSaved] = useState(false);

  // Coordinate editing (Heritage only).
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

  const listItems = useMemo(() => {
    let items = filtered;
    if (bounds) {
      items = items.filter((r) => {
        const lat = num(r.lat);
        const lng = num(r.lng);
        return lat !== null && lng !== null && bounds.contains([lng, lat]);
      });
    }
    const broken = items.filter(isBroken);
    const ok = items.filter((r) => !isBroken(r));
    return [...broken, ...ok];
  }, [filtered, bounds]);
  const shownItems = listItems.slice(0, MAX_LIST);

  const brokenCount = useMemo(() => filtered.filter(isBroken).length, [filtered]);

  const filteredRoutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return routes.filter((rt) => {
      if (heritageOnly && rt.owner_id !== HERITAGE_OWNER_ID) return false;
      if (!q) return true;
      return (rt.owner_handle ?? "").toLowerCase().includes(q);
    });
  }, [routes, search, heritageOnly]);

  const selected = useMemo(() => roots.find((r) => r.root_id === selectedId) ?? null, [roots, selectedId]);
  const selectedIsHeritage = !!selected && selected.owner_id === HERITAGE_OWNER_ID;

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
      map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } as never });
      map.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "selected",
        paint: {
          "circle-radius": 11,
          "circle-color": "#B46C48",
          "circle-opacity": 0.12,
          "circle-stroke-color": "#B46C48",
          "circle-stroke-width": 2,
        },
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

      map.on("moveend", () => setBounds(map.getBounds()));
      setBounds(map.getBounds());
      setLoading(false);
    });

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource("roots") as mapboxgl.GeoJSONSource | undefined)?.setData(rootsToGeo(filtered) as never);
    (map.getSource("routes") as mapboxgl.GeoJSONSource | undefined)?.setData(routesToLineGeo(filteredRoutes) as never);
    (map.getSource("route-stops") as mapboxgl.GeoJSONSource | undefined)?.setData(
      routesToStopGeo(filteredRoutes) as never
    );

    const b = new mapboxgl.LngLatBounds();
    let any = false;
    for (const r of filtered) {
      const lng = num(r.lng);
      const lat = num(r.lat);
      if (lng !== null && lat !== null) {
        b.extend([lng, lat]);
        any = true;
      }
    }
    if (any && (!didFitRef.current || search.trim() || heritageOnly)) {
      map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 300 });
      didFitRef.current = true;
    }

    if (selectedId && !filtered.some((r) => r.root_id === selectedId)) setSelectedId(null);
  }, [filtered, filteredRoutes, search, heritageOnly, selectedId]);

  // Selection: seed edit fields, ease to the pin, add a draggable marker (Heritage).
  useEffect(() => {
    setSaveErr(null);
    setSaveResult(null);
    setTitleErr(null);
    setTitleSaved(false);
    editMarkerRef.current?.remove();
    editMarkerRef.current = null;

    if (!selected) return;
    setEditTitle(selected.title ?? "");
    setEditLat(String(selected.lat));
    setEditLng(String(selected.lng));
    setEditLoc("");

    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const lat = num(selected.lat);
    const lng = num(selected.lng);
    if (lat !== null && lng !== null) {
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), duration: 500 });
    }
    if (selected.owner_id === HERITAGE_OWNER_ID && lat !== null && lng !== null) {
      const marker = new mapboxgl.Marker({ color: "#B46C48", draggable: true }).setLngLat([lng, lat]).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setEditLat(ll.lat.toFixed(6));
        setEditLng(ll.lng.toFixed(6));
      });
      editMarkerRef.current = marker;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const m = editMarkerRef.current;
    const lat = num(editLat);
    const lng = num(editLng);
    if (m && lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      m.setLngLat([lng, lat]);
    }
  }, [editLat, editLng]);

  // Keep the selected-pin ring in sync.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("selected") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const lat = selected ? num(selected.lat) : null;
    const lng = selected ? num(selected.lng) : null;
    if (selected && lat !== null && lng !== null) {
      src.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} }],
      } as never);
    } else {
      src.setData({ type: "FeatureCollection", features: [] } as never);
    }
  }, [selectedId, selected, roots]);

  const latNum = num(editLat);
  const lngNum = num(editLng);
  const coordsValid =
    latNum !== null && lngNum !== null && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const coordsChanged = !!selected && (Number(editLat) !== selected.lat || Number(editLng) !== selected.lng);

  const titleTrimmed = editTitle.trim();
  const titleValid = titleTrimmed.length >= 1 && titleTrimmed.length <= 200;
  const titleChanged = !!selected && titleTrimmed !== (selected.title ?? "").trim();

  async function onSaveTitle() {
    if (!selected || !titleValid) return;
    setSavingTitle(true);
    setTitleErr(null);
    setTitleSaved(false);
    const r = await updateRootTitle(selected.root_id, titleTrimmed);
    setSavingTitle(false);
    if (r.error) return setTitleErr(r.error);
    setTitleSaved(true);
    setRoots((prev) => prev.map((x) => (x.root_id === selected.root_id ? { ...x, title: r.data?.title ?? titleTrimmed } : x)));
  }

  async function onSaveCoords() {
    if (!selected || !coordsValid) return;
    setSaving(true);
    setSaveErr(null);
    setSaveResult(null);
    const r = await movePin(selected.root_id, latNum!, lngNum!, editLoc.trim() || undefined);
    setSaving(false);
    if (r.error) return setSaveErr(r.error);
    setSaveResult(r.data);
    setRoots((prev) => prev.map((x) => (x.root_id === selected.root_id ? { ...x, lat: latNum!, lng: lngNum! } : x)));
  }

  function resetCoords() {
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
            {brokenCount > 0 && (
              <button
                onClick={() => mapRef.current?.flyTo({ center: [0, 0], zoom: 3, duration: 800 })}
                className="ml-2 text-danger underline underline-offset-2 hover:opacity-80"
                title="Fly to the 0,0 pins to fix them"
              >
                · {brokenCount} at 0,0
              </button>
            )}
          </div>
        </div>
        <RootLine className="mt-4" />
      </header>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Site list (in view) */}
        <div className="flex h-[40vh] flex-col overflow-hidden rounded-2xl border border-ink/12 bg-surface lg:h-[74vh]">
          <div className="flex items-center justify-between border-b border-ink/12 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">
              In view ({listItems.length.toLocaleString("en-ZA")})
            </span>
            {brokenCount > 0 && (
              <button
                onClick={() => mapRef.current?.flyTo({ center: [0, 0], zoom: 3, duration: 800 })}
                className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger/15"
                title="Fly to the 0,0 pins"
              >
                {brokenCount} at 0,0
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {listItems.length === 0 ? (
              <div className="p-4 text-sm text-ink/45">
                No sites in view. Pan or zoom the map, or clear the filter.
              </div>
            ) : (
              <ul>
                {shownItems.map((r) => {
                  const broken = isBroken(r);
                  const sel = r.root_id === selectedId;
                  const heritage = r.owner_id === HERITAGE_OWNER_ID;
                  return (
                    <li key={r.root_id}>
                      <button
                        onClick={() => setSelectedId(r.root_id)}
                        className={`w-full border-b border-ink/8 px-3 py-2.5 text-left transition-colors ${
                          sel ? "bg-copper/5" : "hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 flex-none rounded-full" style={{ background: colorFor(r) }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                            {r.title?.trim() || "Untitled root"}
                          </span>
                          {heritage && (
                            <span className="flex-none text-[10px] font-semibold uppercase tracking-wide text-copper-deep">
                              Edit
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 pl-4">
                          <span className="min-w-0 truncate text-xs text-ink/45">
                            {r.owner_handle ? `@${r.owner_handle}` : r.owner_display_name || ""}
                          </span>
                          {broken ? (
                            <span className="flex-none rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                              0,0
                            </span>
                          ) : (
                            <span className="flex-none text-[10px] tabular-nums text-ink/35">
                              {num(r.lat)?.toFixed(2)}, {num(r.lng)?.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {listItems.length > MAX_LIST && (
              <div className="border-t border-ink/12 px-3 py-2 text-[11px] text-ink/45">
                Showing first {MAX_LIST} of {listItems.length.toLocaleString("en-ZA")} in view. Zoom in to narrow.
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative overflow-hidden rounded-2xl border border-ink/12" style={{ height: "74vh", minHeight: 440 }}>
          <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />
          {loading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/60">
              <Spinner className="h-7 w-7" />
            </div>
          )}

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

              {/* Name (Heritage only) */}
              {selectedIsHeritage && (
                <div className="mt-4">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Name</div>
                  <input
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      setTitleSaved(false);
                      setTitleErr(null);
                    }}
                    maxLength={200}
                    className="w-full rounded-lg border border-ink/12 bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-copper focus:ring-2 focus:ring-copper/30"
                  />
                  {titleErr && <div className="mt-1 text-xs text-danger">{titleErr}</div>}
                  {titleSaved && <div className="mt-1 text-xs text-[#4c5330]">Name saved.</div>}
                  <div className="mt-2 flex items-center gap-2">
                    <Button onClick={onSaveTitle} disabled={savingTitle || !titleValid || !titleChanged}>
                      {savingTitle ? "Saving…" : "Save name"}
                    </Button>
                    {editTitle.trim().length > 190 && (
                      <span className="text-[11px] text-ink/40">{200 - editTitle.trim().length} left</span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Listen</div>
                <Player rootId={selected.root_id} />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Location</div>

                {isBroken(selected) && (
                  <div className="mb-2 rounded-lg border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-xs text-danger">
                    This root has no real location (0,0).
                    {selectedIsHeritage ? " Set the correct coordinates below." : ""}
                  </div>
                )}

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
                      <div className="text-xs text-danger">Latitude must be -90 to 90, longitude -180 to 180.</div>
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
                      <Button onClick={onSaveCoords} disabled={saving || !coordsValid || !coordsChanged}>
                        {saving ? "Saving…" : "Save location"}
                      </Button>
                      <Button variant="ghost" onClick={resetCoords} disabled={saving || !coordsChanged}>
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
    </div>
  );
}
