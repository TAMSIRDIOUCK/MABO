import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import { etaMinutes, toLatLng, useRoute, type LatLng, type Order } from '../lib/Geo';

const RED = '#FC3F1D';

const circleIcon = (bg: string, content: string, size = 34, border = '#fff') =>
  L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid ${border};
      box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:800;font-size:${Math.round(size * 0.42)}px;">${content}</div>`,
  });

const ICONS = {
  pickup: () => circleIcon(RED, 'A'),
  delivery: () => circleIcon('#111', 'B'),
  driver: () => circleIcon('#fff', '🏍️', 42, RED),
};

export type MapLine = { points: LatLng[]; color: string; dashed?: boolean };

type MapViewProps = {
  pickup?: LatLng | null;
  delivery?: LatLng | null;
  driver?: LatLng | null;
  lines: MapLine[];
  fitKey: string;
  className?: string;
};

export function MapView({ pickup, delivery, driver, lines, fitKey, className = '' }: MapViewProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const linesRef = useRef<L.LayerGroup | null>(null);
  const markers = useRef<{ pickup?: L.Marker; delivery?: L.Marker; driver?: L.Marker }>({});
  const anim = useRef(0);
  const lastFit = useRef('');

  // Initialisation
  useEffect(() => {
    if (!elRef.current) return;
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true }).setView(
      [14.7167, -17.4677],
      12
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    linesRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(anim.current);
      map.remove();
      mapRef.current = null;
      linesRef.current = null;
      markers.current = {};
      lastFit.current = '';
    };
  }, []);

  // Marqueurs A / B
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (['pickup', 'delivery'] as const).forEach((k) => {
      const pos = k === 'pickup' ? pickup : delivery;
      const existing = markers.current[k];
      if (!pos) {
        existing?.remove();
        markers.current[k] = undefined;
      } else if (existing) {
        existing.setLatLng(pos);
      } else {
        markers.current[k] = L.marker(pos, { icon: ICONS[k](), zIndexOffset: 100 }).addTo(map);
      }
    });
  }, [pickup?.[0], pickup?.[1], delivery?.[0], delivery?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marqueur du livreur (déplacement fluide)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markers.current.driver;
    if (!driver) {
      existing?.remove();
      markers.current.driver = undefined;
      return;
    }
    if (!existing) {
      markers.current.driver = L.marker(driver, { icon: ICONS.driver(), zIndexOffset: 1000 }).addTo(map);
      return;
    }
    cancelAnimationFrame(anim.current);
    const from = existing.getLatLng();
    const start = performance.now();
    const dur = 1500;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      existing.setLatLng([from.lat + (driver[0] - from.lat) * k, from.lng + (driver[1] - from.lng) * k]);
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, [driver?.[0], driver?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracés + cadrage
  useEffect(() => {
    const map = mapRef.current;
    const group = linesRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const bounds = L.latLngBounds([]);

    lines.forEach((l) => {
      if (l.points.length < 2) return;
      L.polyline(l.points, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(group);
      L.polyline(l.points, {
        color: l.color,
        weight: 5,
        opacity: 0.95,
        dashArray: l.dashed ? '2 10' : undefined,
        lineCap: 'round',
      }).addTo(group);
      l.points.forEach((p) => bounds.extend(p));
    });
    [pickup, delivery, driver].forEach((p) => p && bounds.extend(p));

    if (lastFit.current !== fitKey && bounds.isValid()) {
      lastFit.current = fitKey;
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [lines, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={elRef} className={`w-full h-full ${className}`} />;
}

/**
 * Carte de suivi d'une commande :
 *  - avant la récupération : livreur → point A (rouge), puis A → B (pointillés noirs)
 *  - après la récupération : livreur → point B (rouge)
 */
export function TrackingMap({
  order,
  driver,
  className = 'h-64',
}: {
  order: Order;
  driver: LatLng | null;
  className?: string;
}) {
  const pickup = toLatLng(order.pickup_lat, order.pickup_lng);
  const delivery = toLatLng(order.delivery_lat, order.delivery_lng);
  const toPickup = order.status === 'accepted';

  const legA = useRoute(pickup && delivery && driver ? (toPickup ? [driver, pickup] : [driver, delivery]) : null);
  const legB = useRoute(pickup && delivery && (toPickup || !driver) ? [pickup, delivery] : null);

  const lines = useMemo<MapLine[]>(() => {
    const out: MapLine[] = [];
    if (legB.route) out.push({ points: legB.route.coords, color: '#111', dashed: true });
    if (legA.route) out.push({ points: legA.route.coords, color: RED });
    return out;
  }, [legA.route, legB.route]);

  const fitKey = `${order.id}:${order.status}:${legA.route ? 1 : 0}:${legB.route ? 1 : 0}`;
  const remainingKm = legA.route?.distanceKm;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-gray-100 ${className}`}>
      <MapView pickup={pickup} delivery={delivery} driver={driver} lines={lines} fitKey={fitKey} />
      <div
        className="absolute top-2 left-2 right-2 flex justify-between pointer-events-none"
        style={{ zIndex: 1000 }}
      >
        <span className="bg-white/95 rounded-full px-3 py-1 text-xs font-semibold shadow">
          {toPickup ? 'Vers le point de récupération (A)' : 'Vers la livraison (B)'}
        </span>
        {remainingKm !== undefined ? (
          <span className="bg-[#FC3F1D] text-white rounded-full px-3 py-1 text-xs font-bold shadow">
            {remainingKm.toFixed(1)} km · ~{etaMinutes(remainingKm)} min
          </span>
        ) : driver ? (
          <span className="bg-white/95 rounded-full px-2 py-1 shadow">
            <Loader2 size={14} className="animate-spin text-gray-400" />
          </span>
        ) : null}
      </div>
    </div>
  );
}