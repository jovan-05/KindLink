"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Pick } from "@/lib/types";

type LatLng = [number, number];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

const numIcon = (n: number, selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="num-pin${selected ? " is-selected" : ""}" style="width:28px;height:28px">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const hoodIcon = (rank: number, name: string) =>
  L.divIcon({
    className: "",
    html: `<div class="hood-label">#${rank} ${name.replace(/[<>&"]/g, "")}</div>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });

export default function MapView({
  venues,
  neighborhoods,
  heat,
  selectedVenueId,
  onSelectVenue,
}: {
  venues: Pick[];
  neighborhoods: Pick[];
  heat: [number, number, number][];
  selectedVenueId?: string;
  onSelectVenue?: (id: string) => void;
}) {
  const pins = venues.map((v, i) => ({ v, n: i + 1 })).filter(({ v }) => v.lat != null && v.lon != null);
  const hoods = neighborhoods.map((h, i) => ({ h, rank: i + 1 })).filter(({ h }) => h.lat != null && h.lon != null);
  const points = useMemo<LatLng[]>(
    () => [
      ...venues.filter((v) => v.lat != null && v.lon != null).map((v) => [v.lat!, v.lon!] as LatLng),
      ...neighborhoods.filter((h) => h.lat != null && h.lon != null).map((h) => [h.lat!, h.lon!] as LatLng),
    ],
    [venues, neighborhoods],
  );
  const maxW = Math.max(0.0001, ...heat.map((h) => h[2]));
  const center: LatLng = points[0] ?? (heat[0] ? [heat[0][0], heat[0][1]] : [39.5, -98.35]);

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="grayscale-tiles"
      />
      {heat.map(([lat, lon, w], i) => (
        <CircleMarker
          key={i}
          center={[lat, lon]}
          radius={10}
          pathOptions={{ stroke: false, fillColor: "#d97706", fillOpacity: 0.06 + 0.5 * (w / maxW) ** 1.5 }}
          interactive={false}
        />
      ))}
      {hoods.map(({ h, rank }) => (
        <Marker key={h.id} position={[h.lat!, h.lon!]} icon={hoodIcon(rank, h.name)} interactive={false} />
      ))}
      {pins.map(({ v, n }) => (
        <Marker
          key={v.id}
          position={[v.lat!, v.lon!]}
          icon={numIcon(n, v.id === selectedVenueId)}
          zIndexOffset={v.id === selectedVenueId ? 1000 : 0}
          eventHandlers={{ click: () => onSelectVenue?.(v.id) }}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            #{n} {v.name}
          </Tooltip>
          <Popup>
            <b>
              #{n} {v.name}
            </b>
            {v.address && (
              <>
                <br />
                {v.address}
              </>
            )}
            {v.evidence.affinity != null && (
              <>
                <br />
                Qloo affinity {v.evidence.affinity.toFixed(2)}
              </>
            )}
          </Popup>
        </Marker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
