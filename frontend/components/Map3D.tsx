"use client";

// 3D view: Qloo heatmap cells extruded into columns (height = affinity x activity) over OpenFreeMap's
// 3D buildings, with the venue pins and named hotspots. No API key needed.
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type GeoJSONSourceSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Pick } from "@/lib/types";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
// Qloo heatmap cells are geohash-7 squares (~150 m); draw columns slightly smaller so they read as bars.
const HALF_CELL_DEG = 0.00055;
const MAX_HEIGHT_M = 1400;

function cellsToGeoJSON(heat: [number, number, number][]): GeoJSONSourceSpecification["data"] {
  const maxW = Math.max(0.0001, ...heat.map((h) => h[2]));
  return {
    type: "FeatureCollection",
    features: heat.map(([lat, lon, w]) => {
      const dLon = HALF_CELL_DEG / Math.cos((lat * Math.PI) / 180);
      const t = w / maxW;
      return {
        type: "Feature" as const,
        properties: { t, h: 40 + MAX_HEIGHT_M * t ** 1.4 },
        geometry: {
          type: "Polygon" as const,
          coordinates: [[
            [lon - dLon, lat - HALF_CELL_DEG], [lon + dLon, lat - HALF_CELL_DEG],
            [lon + dLon, lat + HALF_CELL_DEG], [lon - dLon, lat + HALF_CELL_DEG], [lon - dLon, lat - HALF_CELL_DEG],
          ]],
        },
      };
    }),
  };
}

function el(className: string, text: string) {
  const d = document.createElement("div");
  d.className = className;
  d.textContent = text;
  return d;
}

function cellsToPoints(heat: [number, number, number][]): GeoJSONSourceSpecification["data"] {
  const maxW = Math.max(0.0001, ...heat.map((h) => h[2]));
  return {
    type: "FeatureCollection",
    features: heat.map(([lat, lon, w]) => ({
      type: "Feature" as const,
      properties: { t: w / maxW },
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
    })),
  };
}

// Same amber ramp for the flat dots and the 3D columns, so both views read alike.
const HEAT_COLOR = ["interpolate", ["linear"], ["get", "t"], 0, "#fde68a", 0.5, "#f59e0b", 1, "#b45309"] as const;

/**
 * MapLibre map on OpenFreeMap's "liberty" style. `flat` gives the 2D view (heat as dots, no tilt);
 * otherwise heat cells are extruded into columns and the camera tilts in.
 */
export default function Map3D({
  venues,
  neighborhoods,
  heat,
  flat = false,
  selectedVenueId,
  onSelectVenue,
  onFail,
}: {
  venues: Pick[];
  neighborhoods: Pick[];
  heat: [number, number, number][];
  flat?: boolean;
  selectedVenueId?: string;
  onSelectVenue?: (id: string) => void;
  /** Called when WebGL is unavailable; the parent can fall back to Leaflet. */
  onFail?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const pinEls = useRef(new Map<string, HTMLDivElement>());
  const selectRef = useRef(onSelectVenue);
  const failRef = useRef(onFail);
  useEffect(() => {
    selectRef.current = onSelectVenue;
    failRef.current = onFail;
  });

  useEffect(() => {
    if (!box.current) return;
    const pins = venues.map((v, i) => ({ v, n: i + 1 })).filter(({ v }) => v.lat != null && v.lon != null);
    const hoods = neighborhoods.map((h, i) => ({ h, rank: i + 1 })).filter(({ h }) => h.lat != null && h.lon != null);
    // Frame the venues and hotspots (the heat covers the whole metro and would zoom out too far).
    const focus: [number, number][] = [
      ...pins.map(({ v }) => [v.lon!, v.lat!] as [number, number]),
      ...hoods.map(({ h }) => [h.lon!, h.lat!] as [number, number]),
    ];
    const pts = focus.length ? focus : heat.slice(0, 40).map(([lat, lon]) => [lon, lat] as [number, number]);
    if (!pts.length) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        center: pts[0],
        zoom: 10,
        pitch: 0,
        dragRotate: !flat,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
    } catch {
      setFailed(true); // no WebGL
      failRef.current?.();
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: !flat, showCompass: !flat }), "top-left");
    map.on("error", () => undefined);
    const els = pinEls.current;
    els.clear();

    map.on("load", () => {
      if (heat.length && flat) {
        map.addSource("heat", { type: "geojson", data: cellsToPoints(heat) });
        map.addLayer({
          id: "heat-dots",
          type: "circle",
          source: "heat",
          paint: {
            "circle-color": HEAT_COLOR as unknown as string,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 12, 5, 15, 10],
            "circle-opacity": ["interpolate", ["linear"], ["get", "t"], 0, 0.35, 1, 0.9],
            "circle-blur": 0.15,
          },
        });
      } else if (heat.length) {
        map.addSource("heat", { type: "geojson", data: cellsToGeoJSON(heat) });
        map.addLayer({
          id: "heat-columns",
          type: "fill-extrusion",
          source: "heat",
          paint: {
            "fill-extrusion-color": HEAT_COLOR as unknown as string,
            "fill-extrusion-height": ["get", "h"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.82,
          },
        });
      }
      pins.forEach(({ v, n }) => {
        const node = el("num-pin", String(n));
        node.style.width = node.style.height = "28px";
        node.style.cursor = "pointer";
        node.title = v.name;
        node.addEventListener("click", () => selectRef.current?.(v.id));
        els.set(v.id, node);
        new maplibregl.Marker({ element: node })
          .setLngLat([v.lon!, v.lat!])
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(
            v.evidence.affinity != null ? `#${n} ${v.name} · Qloo affinity ${v.evidence.affinity.toFixed(2)}` : `#${n} ${v.name}`))
          .addTo(map);
      });
      hoods.forEach(({ h, rank }) => {
        new maplibregl.Marker({ element: el("hood-label", `#${rank} ${h.name}`), anchor: "bottom", offset: [0, -6] })
          .setLngLat([h.lon!, h.lat!])
          .addTo(map);
      });
      const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
      // 3D: tilt and turn so the columns read as 3D.
      if (!flat) map.easeTo({ pitch: 60, bearing: -24, zoom: Math.min(map.getZoom() + 0.6, 14.5), duration: 2200 });
    });

    return () => map.remove();
  }, [venues, neighborhoods, heat, flat]);

  // Highlight the selected venue's pin without rebuilding the map.
  useEffect(() => {
    pinEls.current.forEach((node, id) => node.classList.toggle("is-selected", id === selectedVenueId));
  });

  if (failed) {
    return <div className="grid h-full place-items-center text-sm text-stone-500">This view needs WebGL.</div>;
  }
  return <div ref={box} className="h-full w-full" />;
}
