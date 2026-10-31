"use client";

import { Box, Layers } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Pick, Plan, Section } from "@/lib/types";
import { cx, evidenceLabel, fmt, NotEnoughData, reasonFor } from "./ui";

const loading = () => <div className="h-full w-full animate-pulse bg-stone-200" />;
const MapView = dynamic(() => import("./MapView"), { ssr: false, loading });
// MapLibre (OpenFreeMap "liberty" style) draws both the flat 2D and the 3D view; Leaflet is the no-WebGL fallback.
const Map3D = dynamic(() => import("./Map3D"), { ssr: false, loading });

export default function MapVisualization({
  plan,
  venues,
  neighborhoods,
  section,
  heat,
  selectedVenueId,
  onSelectVenue,
}: {
  plan: Plan;
  venues: Pick[];
  neighborhoods: Pick[];
  section: Section;
  heat: [number, number, number][];
  selectedVenueId?: string;
  onSelectVenue: (id: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  // Without WebGL the 2D view falls back to the Leaflet map.
  const [noWebGL, setNoWebGL] = useState(false);
  const hasMap = venues.some((v) => v.lat != null) || heat.length > 0;

  useEffect(() => {
    if (window.location.hash === "#3d") setViewMode("3D"); // handy for demos: /plan/<id>#3d
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
      <div className="p-4 sm:px-6 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-4 bg-stone-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-stone-900 font-sans">Supporter Heatmap & Venue Density</h3>
            <span className="text-xs text-stone-400">·</span>
            <span className="text-xs font-medium text-stone-600">{plan.inputs.city} Metro</span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Color intensity is Qloo&apos;s heatmap of affinity × activity for your supporters&apos; tastes.
          </p>
        </div>

        {hasMap && (
          <div className="no-print flex items-center p-1 bg-stone-200/70 rounded-lg text-xs font-medium" role="group" aria-label="Map view">
            <button
              type="button"
              aria-pressed={viewMode === "2D"}
              onClick={() => setViewMode("2D")}
              className={cx(
                "px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                viewMode === "2D" ? "bg-white text-stone-900 shadow-xs font-semibold" : "text-stone-600 hover:text-stone-900",
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Map</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "3D"}
              onClick={() => setViewMode("3D")}
              className={cx(
                "px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                viewMode === "3D" ? "bg-white text-stone-900 shadow-xs font-semibold" : "text-stone-600 hover:text-stone-900",
              )}
            >
              <Box className="w-3.5 h-3.5 text-amber-700" />
              <span>3D Perspective</span>
            </button>
          </div>
        )}
      </div>

      <div className="relative w-full h-[420px] bg-stone-100 overflow-hidden select-none">
        {!hasMap ? (
          <div className="grid h-full place-items-center text-sm text-stone-500">No map data from Qloo for this plan</div>
        ) : viewMode === "3D" ? (
          <Map3D venues={venues} neighborhoods={neighborhoods} heat={heat} />
        ) : !noWebGL ? (
          <Map3D
            flat
            venues={venues}
            neighborhoods={neighborhoods}
            heat={heat}
            selectedVenueId={selectedVenueId}
            onSelectVenue={onSelectVenue}
            onFail={() => setNoWebGL(true)}
          />
        ) : (
          <MapView venues={venues} neighborhoods={neighborhoods} heat={heat} selectedVenueId={selectedVenueId} onSelectVenue={onSelectVenue} />
        )}

        {hasMap && (
          <>
            <div className="absolute bottom-3 left-3 bg-stone-950/85 backdrop-blur-md border border-stone-800 rounded-lg p-2.5 text-xs text-stone-300 z-[500] space-y-1.5 shadow-lg max-w-xs pointer-events-none">
              <div className="text-[11px] font-semibold text-stone-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Qloo Supporter Density Index</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-stone-400">
                <span className="inline-block w-4 h-2 bg-amber-200 rounded-xs" /> Low
                <span className="inline-block w-4 h-2 bg-amber-500 rounded-xs ml-2" /> Moderate
                <span className="inline-block w-4 h-2 bg-amber-700 rounded-xs ml-2" /> High Density
              </div>
              {venues.length > 0 && (
                <div className="text-[10px] text-stone-400 pt-0.5">
                  Numbered pins <span className="text-amber-300 font-bold">(1–{venues.length})</span> match recommended venues below.
                </div>
              )}
            </div>

            <div className="absolute top-3 right-3 bg-stone-950/75 backdrop-blur-md border border-stone-800 px-2.5 py-1 rounded text-[11px] text-amber-300 font-mono z-[500] flex items-center gap-1.5 pointer-events-none">
              <span>{viewMode === "3D" ? "Isometric Extrusion" : "Cartographic 2D"}</span>
            </div>
          </>
        )}
      </div>

      <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Top {neighborhoods.length || ""} Supporter Neighborhoods (Ranked by Qloo Taste Affinity)
        </div>

        {neighborhoods.length === 0 ? (
          <NotEnoughData title="Neighborhoods" section={section} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {neighborhoods.map((n, i) => (
              <div
                key={n.id}
                className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs hover:border-amber-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <h4 className="text-sm font-bold text-stone-900 truncate">{n.name}</h4>
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0">
                      affinity {fmt(n.evidence.affinity)}
                    </div>
                  </div>
                  {reasonFor(plan, n) && <p className="text-xs text-stone-600 leading-relaxed mt-2">{reasonFor(plan, n)}</p>}
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-[11px] text-stone-500">
                  <span className="truncate" title={n.evidence.signal}>Qloo {n.evidence.basis}</span>
                  <span className="font-mono font-semibold text-stone-800 shrink-0">{evidenceLabel(n.evidence)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
