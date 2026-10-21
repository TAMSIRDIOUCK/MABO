import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { searchPlaces, reverseGeocode, type Place } from '@/lib/Geo';

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  place: Place | null;
  onPlaceChange: (p: Place | null) => void;
  placeholder: string;
  allowLocate?: boolean;
};

/**
 * Champ d'adresse intelligent : dès la 2e lettre, propose les villes / quartiers /
 * rues correspondants. Une adresse n'est valide que si elle est choisie dans la liste
 * (on récupère ainsi ses coordonnées GPS pour la carte et le calcul du prix).
 */
export function PlaceInput({ value, onValueChange, place, onPlaceChange, placeholder, allowLocate }: Props) {
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (place || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await searchPlaces(q, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setResults(r);
          setOpen(true);
        }
      } catch {
        /* requête annulée */
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, place]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function select(p: Place) {
    onValueChange(p.label);
    onPlaceChange(p);
    setOpen(false);
  }

  function locate() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        select(p);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const showEmpty = open && !searching && !place && value.trim().length >= 2 && results.length === 0;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="mab-input"
          style={{ paddingLeft: '2.75rem', paddingRight: allowLocate ? '2.75rem' : undefined }}
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={(e) => {
            onValueChange(e.target.value);
            if (place) onPlaceChange(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {searching || locating ? (
            <Loader2 size={18} className="animate-spin text-gray-400" />
          ) : allowLocate ? (
            <button type="button" onClick={locate} title="Utiliser ma position" className="text-[#FC3F1D]">
              <LocateFixed size={20} />
            </button>
          ) : null}
        </div>
      </div>

      {place && <p className="text-[11px] text-green-600 font-medium mt-1 ml-1">✓ Adresse confirmée</p>}
      {!place && value.trim().length >= 2 && !searching && (
        <p className="text-[11px] text-gray-400 mt-1 ml-1">Choisissez une adresse dans la liste</p>
      )}

      {open && !place && (results.length > 0 || showEmpty) && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button
              key={`${p.lat},${p.lng},${p.label}`}
              type="button"
              onClick={() => select(p)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={15} className="text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                {p.subtitle && <p className="text-xs text-gray-500 truncate">{p.subtitle}</p>}
              </div>
            </button>
          ))}
          {showEmpty && <p className="px-4 py-3 text-sm text-gray-400">Aucun résultat — essayez un autre nom</p>}
        </div>
      )}
    </div>
  );
}