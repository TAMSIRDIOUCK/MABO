import { useEffect, useRef, useState } from 'react';
import type { Order as BaseOrder } from './supabase';

export type { OrderStatus } from './supabase';

/** Order de la base + champs GPS ajoutés par migration.sql */
export type Order = BaseOrder & {
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  distance_km: number | null;
};

export type LatLng = [number, number];
export type Place = { title: string; subtitle: string; label: string; lat: number; lng: number };
export type RouteResult = { coords: LatLng[]; distanceKm: number; approx: boolean };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimation moto en ville : ~25 km/h */
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / 25) * 60));
}

export function toLatLng(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null;
}

/* ------------------------- Recherche d'adresses ------------------------- */

type NominatimResult = { name?: string; display_name: string; lat: string; lon: string };

function toPlace(r: NominatimResult): Place {
  const parts = r.display_name.split(',').map((s) => s.trim());
  const title = r.name || parts[0];
  const rest = parts.slice(1).filter((p) => p !== 'Sénégal' && !/^\d+$/.test(p));
  return {
    title,
    subtitle: rest.slice(0, 3).join(', '),
    label: [title, ...rest.slice(0, 2)].join(', '),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  };
}

const searchCache = new Map<string, Place[]>();

/** Autocomplétion de villes / quartiers / rues du Sénégal (OpenStreetMap Nominatim). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  const key = q.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=7' +
    '&countrycodes=sn&accept-language=fr&viewbox=-17.75,15.0,-16.9,14.5' +
    `&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimResult[];

  const seen = new Set<string>();
  const places = data.map(toPlace).filter((p) => {
    if (seen.has(p.label)) return false;
    seen.add(p.label);
    return true;
  });
  searchCache.set(key, places);
  return places;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fr&zoom=17&lat=${lat}&lon=${lng}`
    );
    const r = (await res.json()) as NominatimResult;
    if (r?.display_name) return { ...toPlace({ ...r, lat: String(lat), lon: String(lng) }) };
  } catch {
    /* ignore */
  }
  return { title: 'Ma position', subtitle: '', label: 'Ma position', lat, lng };
}

/* ------------------------------- Itinéraires ------------------------------ */

/** Itinéraire routier (OSRM). Repli : ligne droite x1.3 si le service est indisponible. */
export async function getRoute(points: LatLng[]): Promise<RouteResult> {
  try {
    const path = points.map((p) => `${p[1]},${p[0]}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`
    );
    const json = await res.json();
    const r = json?.routes?.[0];
    if (!r) throw new Error('no route');
    return {
      coords: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as LatLng),
      distanceKm: r.distance / 1000,
      approx: false,
    };
  } catch {
    let km = 0;
    for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
    return { coords: points, distanceKm: km * 1.3, approx: true };
  }
}

/**
 * Calcule un itinéraire. Pour un point de départ mobile (livreur), l'itinéraire
 * n'est recalculé que si le livreur a bougé de plus de `refetchMeters`.
 */
export function useRoute(points: LatLng[] | null, refetchMeters = 120) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const lastTail = useRef('');
  const lastFirst = useRef<LatLng | null>(null);
  const reqId = useRef(0);

  const tailKey = points ? points.slice(1).map((p) => p.join(',')).join('|') : '';
  const f0 = points?.[0]?.[0];
  const f1 = points?.[0]?.[1];

  useEffect(() => {
    if (!points || points.length < 2) {
      reqId.current++;
      lastTail.current = '';
      lastFirst.current = null;
      setRoute(null);
      setLoading(false);
      return;
    }
    const movedM = lastFirst.current ? haversineKm(lastFirst.current, points[0]) * 1000 : Infinity;
    if (tailKey === lastTail.current && movedM < refetchMeters) return;

    lastTail.current = tailKey;
    lastFirst.current = points[0];
    const id = ++reqId.current;
    setLoading(true);
    getRoute(points).then((r) => {
      if (id === reqId.current) {
        setRoute(r);
        setLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailKey, f0, f1]);

  return { route, loading };
}