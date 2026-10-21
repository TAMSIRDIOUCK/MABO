import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS, PRICE_TIERS, priceTier, priceForDistance,
} from '../lib/constants';
import { useRoute, toLatLng, type LatLng, type Order, type Place } from '../lib/Geo';
import {
  MapPin, Package, Phone, User, Send, Loader2, X, Navigation, ArrowRight,
  PackageCheck, TrendingUp, ListChecks, Eye, Bike,
} from 'lucide-react';
import { LogoFull } from './Logo';
import { PlaceInput } from './Placeinput';
import { MapView, TrackingMap, type MapLine } from './Mapview';

type DriverInfo = { full_name: string; phone: string };
export function ClientView() {
  const { profile, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [driverLocs, setDriverLocs] = useState<Record<string, LatLng>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverInfo>>({});

  useEffect(() => {
    loadOrders();
    const channel = supabase
      .channel('orders5-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders5', filter: `client_id=eq.${profile?.id}` },
        () => loadOrders()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadOrders() {
    const { data } = await supabase
      .from('orders5')
      .select('*')
      .eq('client_id', profile?.id)
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }

  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const pastOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
  const hasTracked = activeOrders.some((o) => o.driver_id);

  // Position du livreur en temps réel
  useEffect(() => {
    async function fetchLocs() {
      const { data } = await supabase.from('driver_locations5').select('driver_id,lat,lng');
      if (data) {
        const m: Record<string, LatLng> = {};
        data.forEach((r: { driver_id: string; lat: number; lng: number }) => (m[r.driver_id] = [r.lat, r.lng]));
        setDriverLocs(m);
      }
    }
    if (!hasTracked) return;
    fetchLocs();
    const channel = supabase
      .channel('driver-locations5')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations5' },
        (payload) => {
          const row = payload.new as { driver_id?: string; lat?: number; lng?: number };
          if (row?.driver_id && typeof row.lat === 'number' && typeof row.lng === 'number') {
            setDriverLocs((prev) => ({ ...prev, [row.driver_id!]: [row.lat!, row.lng!] }));
          }
        }
      )
      .subscribe();
    const poll = setInterval(fetchLocs, 8000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [hasTracked]);

  // Infos du livreur (nom / téléphone)
  useEffect(() => {
    const ids = Array.from(
      new Set(activeOrders.map((o) => o.driver_id).filter((id): id is string => !!id && !drivers[id]))
    );
    if (ids.length === 0) return;
    supabase
      .from('profiles5')
      .select('id,full_name,phone')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return;
        setDrivers((prev) => {
          const next = { ...prev };
          data.forEach((d: { id: string; full_name: string; phone: string }) => (next[d.id] = d));
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function cancelOrder(order: Order) {
    await supabase.from('orders5').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending');
    loadOrders();
  }

  const list = activeTab === 'new' ? activeOrders : pastOrders;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#FC3F1D] sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto px-5 py-3.5 flex items-center justify-between">
          <LogoFull size={36} onRed />
          <button
            onClick={signOut}
            className="bg-white/20 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto w-full flex-1 px-5 py-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Bonjour, {profile?.full_name?.split(' ')[0]}</h2>
          <p className="text-gray-500 text-sm">Envoyez vos colis en toute simplicité</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="mab-card p-3.5 text-center">
            <ListChecks size={20} className="mx-auto text-[#FC3F1D] mb-1" />
            <p className="text-2xl font-bold text-gray-900">{activeOrders.length}</p>
            <p className="text-[11px] text-gray-500 font-medium">En cours</p>
          </div>
          <div className="mab-card p-3.5 text-center">
            <PackageCheck size={20} className="mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900">{pastOrders.filter((o) => o.status === 'delivered').length}</p>
            <p className="text-[11px] text-gray-500 font-medium">Livrés</p>
          </div>
          <div className="mab-card p-3.5 text-center">
            <TrendingUp size={20} className="mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            <p className="text-[11px] text-gray-500 font-medium">Total</p>
          </div>
        </div>

        <button onClick={() => setShowForm(true)} className="w-full mab-btn-primary flex items-center justify-center gap-2 mb-6">
          <Send size={20} />
          Nouvelle commande
        </button>

        <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
          {(['new', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t ? 'bg-white text-black shadow-sm' : 'text-gray-500'
              }`}
            >
              {t === 'new' ? `En cours (${activeOrders.length})` : `Historique (${pastOrders.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'new'
              ? activeOrders.map((order) =>
                  order.status === 'pending' ? (
                    <SearchingCard key={order.id} order={order} onCancel={() => cancelOrder(order)} />
                  ) : (
                    <TrackingCard
                      key={order.id}
                      order={order}
                      driverPos={order.driver_id ? driverLocs[order.driver_id] ?? null : null}
                      driver={order.driver_id ? drivers[order.driver_id] : undefined}
                    />
                  )
                )
              : pastOrders.map((order) => <OrderCard key={order.id} order={order} />)}

            {list.length === 0 && (
              <div className="text-center py-12">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">
                  {activeTab === 'new' ? 'Aucune commande en cours' : 'Aucun historique'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <NewOrderForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            setActiveTab('new');
            loadOrders();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------- Recherche de livreur ------------------------- */

function SearchingCard({ order, onCancel }: { order: Order; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div className="mab-card p-5 mab-animate-fade-in border-2 border-[#FC3F1D]/20">
      <div className="flex flex-col items-center text-center">
        <div className="relative w-24 h-24 flex items-center justify-center mb-3">
          <span className="absolute inset-0 rounded-full bg-[#FC3F1D]/15 animate-ping" />
          <span className="absolute inset-3 rounded-full bg-[#FC3F1D]/20 animate-pulse" />
          <div className="relative w-14 h-14 rounded-full bg-[#FC3F1D] flex items-center justify-center shadow-lg">
            <Eye size={28} className="text-white" />
          </div>
        </div>
        <h3 className="text-base font-bold text-gray-900">Recherche d'un livreur disponible…</h3>
        <p className="text-3xl font-extrabold text-[#FC3F1D] tabular-nums mt-1">{mm}:{ss}</p>
        <p className="text-xs text-gray-500 mt-1 max-w-[16rem]">
          {secs < 180
            ? 'Nous contactons les livreurs proches de votre point de récupération.'
            : 'Aucun livreur disponible pour le moment, nous continuons de chercher.'}
        </p>
        <div className="mab-scan-bar w-full mt-4" />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
        <p className="text-sm text-gray-900 font-medium flex items-start gap-2">
          <Navigation size={15} className="text-[#FC3F1D] mt-0.5 flex-shrink-0" />
          <span className="truncate">{order.pickup_address}</span>
        </p>
        <p className="text-sm text-gray-900 font-medium flex items-start gap-2">
          <MapPin size={15} className="text-gray-900 mt-0.5 flex-shrink-0" />
          <span className="truncate">{order.delivery_address}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-black">{order.price.toLocaleString('fr-FR')} FCFA</p>
          {order.distance_km != null && <p className="text-xs text-gray-400">{order.distance_km} km</p>}
        </div>
        <button onClick={onCancel} className="text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl">
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Suivi sur la carte --------------------------- */

function TrackingCard({ order, driverPos, driver }: { order: Order; driverPos: LatLng | null; driver?: DriverInfo }) {
  return (
    <div className="mab-card p-3 mab-animate-fade-in">
      <div className="flex items-center justify-between px-1 pt-1 pb-3">
        <div className={`mab-badge ${STATUS_COLORS[order.status]}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[order.status]}`} />
          {order.status === 'accepted' ? 'Le livreur arrive chez vous' : STATUS_LABELS[order.status]}
        </div>
        <span className="text-lg font-bold text-black">{order.price.toLocaleString('fr-FR')} F</span>
      </div>

      <TrackingMap order={order} driver={driverPos} className="h-72" />
      {!driverPos && (
        <p className="text-xs text-gray-400 text-center mt-2">En attente de la position du livreur…</p>
      )}

      <div className="flex items-center gap-3 mt-3 px-1">
        <div className="w-11 h-11 rounded-full bg-[#FC3F1D]/10 flex items-center justify-center">
          <Bike size={22} className="text-[#FC3F1D]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{driver?.full_name ?? 'Votre livreur'}</p>
          <p className="text-xs text-gray-500">
            {order.status === 'accepted' ? 'En route vers le point de récupération' : 'En route vers la livraison'}
          </p>
        </div>
        {driver?.phone && (
          <a href={`tel:${driver.phone}`} className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center shadow">
            <Phone size={20} className="text-white" />
          </a>
        )}
      </div>

      <div className="mt-3 mx-1 pt-3 border-t border-gray-100 space-y-1.5">
        <p className="text-sm text-gray-900 font-medium flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#FC3F1D] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">A</span>
          <span className="truncate">{order.pickup_address}</span>
        </p>
        <p className="text-sm text-gray-900 font-medium flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">B</span>
          <span className="truncate">{order.delivery_address}</span>
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- Historique ------------------------------- */

function OrderCard({ order }: { order: Order }) {
  return (
    <div className="mab-card p-4 mab-animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`mab-badge ${STATUS_COLORS[order.status]}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[order.status]}`} />
          {STATUS_LABELS[order.status]}
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FC3F1D]/10 flex items-center justify-center flex-shrink-0">
            <Navigation size={16} className="text-[#FC3F1D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Récupération</p>
            <p className="text-sm text-gray-900 font-medium truncate">{order.pickup_address}</p>
          </div>
        </div>
        <div className="ml-4 border-l-2 border-dashed border-gray-200 h-3" />
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-gray-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Livraison</p>
            <p className="text-sm text-gray-900 font-medium truncate">{order.delivery_address}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Phone size={13} /> {order.recipient_phone}</span>
          <span className="flex items-center gap-1"><User size={13} /> {order.recipient_name}</span>
        </div>
        <span className="text-lg font-bold text-black">{order.price.toLocaleString('fr-FR')} F</span>
      </div>
    </div>
  );
}

/* ------------------------------ Nouvelle commande -------------------------- */

function NewOrderForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [pickupText, setPickupText] = useState('');
  const [deliveryText, setDeliveryText] = useState('');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [delivery, setDelivery] = useState<Place | null>(null);
  const [senderPhone, setSenderPhone] = useState(profile?.phone || '');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pA = pickup ? toLatLng(pickup.lat, pickup.lng) : null;
  const pB = delivery ? toLatLng(delivery.lat, delivery.lng) : null;
  const { route, loading: routing } = useRoute(pA && pB ? [pA, pB] : null);

  const distanceKm = route ? Math.round(route.distanceKm * 10) / 10 : null;
  const price = distanceKm != null ? priceForDistance(distanceKm) : null;
  const tier = distanceKm != null ? priceTier(distanceKm) : null;
  const lines: MapLine[] = route ? [{ points: route.coords, color: '#FC3F1D' }] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!pickup || !delivery || price == null || distanceKm == null) {
      setError('Choisissez les adresses de récupération et de livraison dans la liste.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        client_id: profile?.id,
        pickup_address: pickup.label,
        delivery_address: delivery.label,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        delivery_lat: delivery.lat,
        delivery_lng: delivery.lng,
        distance_km: distanceKm,
        sender_phone: senderPhone,
        recipient_phone: recipientPhone,
        recipient_name: recipientName,
        description: description || null,
        price,
      };

      const { error: insertError } = await supabase.from('orders5').insert(payload);
      if (insertError) {
        setError(`${insertError.code || 'ERR'} · ${insertError.message}`);
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center mab-animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto mab-animate-slide-up">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between z-[1100]">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Nouvelle commande</h3>
            <p className="text-xs text-gray-500">Tapez un quartier ou une ville et choisissez dans la liste</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2 relative" style={{ zIndex: 30 }}>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#FC3F1D] text-white text-[10px] font-bold flex items-center justify-center">A</span>
              Adresse de récupération
            </label>
            <PlaceInput
              value={pickupText}
              onValueChange={setPickupText}
              place={pickup}
              onPlaceChange={setPickup}
              placeholder="Ex: Médina, Parcelles, Thiès…"
              allowLocate
            />
          </div>

          <div className="space-y-2 relative" style={{ zIndex: 20 }}>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">B</span>
              Adresse de livraison
            </label>
            <PlaceInput
              value={deliveryText}
              onValueChange={setDeliveryText}
              place={delivery}
              onPlaceChange={setDelivery}
              placeholder="Ex: Almadies, Pikine, Rufisque…"
            />
          </div>

          {pA && pB && (
            <div className="space-y-3">
              <div className="h-44 rounded-2xl overflow-hidden border border-gray-100 relative" style={{ zIndex: 1 }}>
                <MapView pickup={pA} delivery={pB} lines={lines} fitKey={`${pA}|${pB}|${route ? 1 : 0}`} />
              </div>
              <div className="bg-[#FC3F1D]/5 border border-[#FC3F1D]/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">
                    {routing || !tier ? 'Calcul du trajet…' : `${tier.name} · ${distanceKm} km`}
                  </p>
                  <p className="text-2xl font-bold text-black">
                    {price != null ? price.toLocaleString('fr-FR') : '—'} <span className="text-sm">FCFA</span>
                  </p>
                </div>
                {routing ? <Loader2 size={22} className="animate-spin text-[#FC3F1D]" /> : <ArrowRight size={24} className="text-[#FC3F1D]" />}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {PRICE_TIERS.map((t) => (
                  <div
                    key={t.range}
                    className={`rounded-lg px-1 py-2 text-center border ${
                      tier?.range === t.range ? 'border-[#FC3F1D] bg-[#FC3F1D]/10' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <p className="text-[9px] text-gray-500 leading-tight">{t.range}</p>
                    <p className="text-[11px] font-bold text-gray-900">{t.price.toLocaleString('fr-FR')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" /> Votre numéro
              </label>
              <input className="mab-input" type="tel" placeholder="77 123 45 67" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" /> N° destinataire
              </label>
              <input className="mab-input" type="tel" placeholder="77 987 65 43" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User size={16} className="text-gray-400" /> Nom du destinataire
            </label>
            <input className="mab-input" placeholder="Ex: Mamadou Diop" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package size={16} className="text-gray-400" /> Description du colis (optionnel)
            </label>
            <input className="mab-input" placeholder="Ex: Petit colis, documents..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && (
            <div className="mab-animate-shake bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 break-words">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || routing || price == null} className="mab-btn-primary w-full flex items-center justify-center gap-2">
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Send size={20} />
                Valider la commande{price != null ? ` · ${price.toLocaleString('fr-FR')} F` : ''}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}