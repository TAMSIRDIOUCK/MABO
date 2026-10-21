import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS } from '../lib/constants';
import { toLatLng, type LatLng, type Order, type OrderStatus } from '../lib/Geo';
import {
  MapPin, Navigation, Phone, User, Package, Loader2, CheckCircle2, Clock,
  Bike, Hand, PackageCheck, Bell, Lock, ExternalLink, AlertTriangle, RefreshCw, History, X,
} from 'lucide-react';
import { LogoFull } from './Logo';
import { TrackingMap } from './Mapview';

function formatPrice(price: unknown): string {
  if (typeof price === 'number' && Number.isFinite(price)) {
    return price.toLocaleString('fr-FR');
  }
  return '—';
}

export function DriverView() {
  const { profile, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myPastOrders, setMyPastOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedPastOrder, setSelectedPastOrder] = useState<Order | null>(null); // Pour la modale
  const [notice, setNotice] = useState('');
  const [pos, setPos] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState('');
  const lastSent = useRef(0);

  const hasActive = myOrders.length > 0;
  const driverId = profile?.id;

  useEffect(() => {
    if (!driverId) return;
    loadOrders();
    const channel = supabase
      .channel('driver-orders5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders5' }, () => loadOrders())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  async function loadOrders() {
    if (!driverId) {
      setLoading(false);
      return;
    }

    // 1. Livraisons en cours
    const { data: mine } = await supabase
      .from('orders5')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'picked_up'])
      .order('created_at', { ascending: false });

    const mineList = (mine as Order[]) || [];
    setMyOrders(mineList);

    // 2. Historique (toutes les livraisons terminées)
    const { data: past } = await supabase
      .from('orders5')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(50); // On remonte plus loin dans l'historique

    setMyPastOrders((past as Order[]) || []);

    // 3. Commandes disponibles (si aucune en cours)
    if (mineList.length === 0) {
      const { data: pending } = await supabase
        .from('orders5')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setOrders((pending as Order[]) || []);
    } else {
      setOrders([]);
    }
    setLoading(false);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  }

  useEffect(() => {
    if (!hasActive || !driverId) {
      setPos(null);
      return;
    }
    if (!('geolocation' in navigator)) {
      setGeoError('La géolocalisation n’est pas disponible.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      async (p) => {
        const ll: LatLng = [p.coords.latitude, p.coords.longitude];
        setPos(ll);
        setGeoError('');
        const now = Date.now();
        if (now - lastSent.current < 3000) return;
        lastSent.current = now;
        await supabase.from('driver_locations5').upsert({
          driver_id: driverId,
          lat: ll[0],
          lng: ll[1],
          updated_at: new Date().toISOString(),
        });
      },
      (e) => setGeoError(e.code === 1 ? 'Activez la localisation.' : 'Position indisponible.'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasActive, driverId]);

  async function acceptOrder(order: Order) {
    setNotice('');
    const { data, error } = await supabase.rpc('accept_order', { p_order_id: order.id });
    if (error) {
      setNotice(error.message.includes('active_delivery')
        ? 'Terminez votre livraison en cours avant d’en accepter une autre.'
        : `Erreur : ${error.message}`);
    } else if (data === false) {
      setNotice('Cette commande vient d’être acceptée par un autre livreur.');
    }
    await loadOrders();
  }

  async function updateStatus(order: Order, newStatus: OrderStatus) {
    const updates: Partial<Order> = { status: newStatus };
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('orders5')
      .update(updates)
      .eq('id', order.id)
      .eq('driver_id', driverId);
      
    if (error) console.error('❌ updateStatus →', error.code, error.message);
    
    if (newStatus === 'delivered') {
      setShowHistory(true);
      setTimeout(loadOrders, 500); 
    } else {
      await loadOrders();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#FC3F1D] sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto px-5 py-3.5 flex items-center justify-between">
          <LogoFull size={36} onRed />
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors">
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <button onClick={signOut} className="bg-white/20 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto w-full flex-1 px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bike size={20} className="text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900">Salut, {profile?.full_name?.split(' ')[0]}</h2>
            </div>
            <p className="text-gray-500 text-sm">Livreur MABO</p>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2.5 rounded-xl transition-colors ${showHistory ? 'bg-black text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            title="Historique"
          >
            <History size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="mab-card p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${hasActive ? 'bg-blue-100' : 'bg-[#FC3F1D]/10'}`}>
              {hasActive ? <Bike size={22} className="text-blue-600" /> : <Bell size={22} className="text-[#FC3F1D]" />}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{hasActive ? '1' : orders.length}</p>
              <p className="text-[11px] text-gray-500 font-medium">{hasActive ? 'En cours' : 'Disponibles'}</p>
            </div>
          </div>
          <div className="mab-card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{myPastOrders.length}</p>
              <p className="text-[11px] text-gray-500 font-medium">Livrées</p>
            </div>
          </div>
        </div>

        {notice && (
          <div className="mab-animate-shake bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-3 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            {notice}
          </div>
        )}

        {hasActive && geoError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-3">{geoError}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            
            {/* --- VUE HISTORIQUE --- */}
            {showHistory ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <History size={18} /> Historique de mes livraisons
                </h3>
                <p className="text-xs text-gray-500 mb-3 -mt-2">Cliquez sur une livraison pour voir les détails.</p>
                
                {myPastOrders.map((order) => (
                  <div 
                    key={order.id} 
                    onClick={() => setSelectedPastOrder(order)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <PastOrderCard order={order} />
                  </div>
                ))}
                
                {myPastOrders.length === 0 && (
                  <div className="text-center py-16">
                    <History size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">Aucun historique</p>
                  </div>
                )}
              </>
            ) : (
              
              /* --- VUE ACCUEIL --- */
              <>
                {hasActive && myOrders.map((order) => (
                  <ActiveDeliveryCard key={order.id} order={order} pos={pos} onUpdate={updateStatus} />
                ))}

                {!hasActive && (
                  <>
                    {orders.length > 0 && <h3 className="text-lg font-bold text-gray-900 mb-3">Nouvelles commandes</h3>}
                    {orders.map((order) => (
                      <AvailableOrderCard key={order.id} order={order} onAccept={() => acceptOrder(order)} />
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <Bell size={28} className="text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">Aucune commande disponible</p>
                        <p className="text-gray-400 text-sm mt-1">Les nouvelles commandes apparaîtront ici</p>
                      </div>
                    )}
                  </>
                )}

                {hasActive && (
                  <div className="bg-gray-100 rounded-xl p-4 text-center mt-4">
                    <Lock size={20} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Vous avez une livraison en cours.</p>
                    <p className="text-xs text-gray-500 mt-1">Terminez-la pour voir de nouvelles commandes.</p>
                  </div>
                )}
              </>
            )}

          </div>
        )}
      </div>

      {/* --- MODALE DE DÉTAIL DE L'HISTORIQUE --- */}
      {selectedPastOrder && (
        <PastOrderModal 
          order={selectedPastOrder} 
          onClose={() => setSelectedPastOrder(null)} 
        />
      )}
    </div>
  );
}

/* ---------------------------- SOUS-COMPOSANTS ---------------------------- */

function AvailableOrderCard({ order, onAccept }: { order: Order; onAccept: () => Promise<void> }) {
  const [accepting, setAccepting] = useState(false);
  const minutesAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div className="mab-card p-4 mab-animate-slide-up border-2 border-[#FC3F1D]/25">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FC3F1D] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FC3F1D]" />
          </span>
          <span className="text-xs font-bold text-[#FC3F1D] uppercase tracking-wide">Nouvelle commande</span>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={12} /> {minutesAgo} min
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FC3F1D]/10 flex items-center justify-center flex-shrink-0">
            <Navigation size={16} className="text-[#FC3F1D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Récupération</p>
            <p className="text-sm text-gray-900 font-medium">{order.pickup_address}</p>
          </div>
        </div>
        <div className="ml-4 border-l-2 border-dashed border-gray-200 h-3" />
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-gray-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Livraison</p>
            <p className="text-sm text-gray-900 font-medium">{order.delivery_address}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <User size={13} className="text-gray-400" />
          <span>{order.recipient_name}</span>
        </div>
        {order.distance_km != null && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Navigation size={13} className="text-gray-400" />
            <span>Trajet : {order.distance_km} km</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium">Prix de la livraison</p>
          <p className="text-2xl font-bold text-black">
            {formatPrice(order.price)} <span className="text-sm">FCFA</span>
          </p>
        </div>
        <button
          onClick={async () => {
            setAccepting(true);
            try {
              await onAccept();
            } finally {
              setAccepting(false);
            }
          }}
          disabled={accepting}
          className="mab-btn-primary flex items-center gap-2"
        >
          {accepting ? <Loader2 size={18} className="animate-spin" /> : <><Hand size={18} /> Accepter</>}
        </button>
      </div>
    </div>
  );
}

function ActiveDeliveryCard({
  order,
  pos,
  onUpdate,
}: {
  order: Order;
  pos: LatLng | null;
  onUpdate: (order: Order, status: OrderStatus) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);

  const toPickup = order.status === 'accepted';
  const nextAction = toPickup
    ? { label: 'Colis récupéré', status: 'picked_up' as OrderStatus, icon: PackageCheck }
    : { label: 'Marquer comme livré', status: 'delivered' as OrderStatus, icon: CheckCircle2 };
  const NextIcon = nextAction.icon;

  const target = toPickup
    ? toLatLng(order.pickup_lat, order.pickup_lng)
    : toLatLng(order.delivery_lat, order.delivery_lng);
  const gpsUrl = target
    ? `https://www.google.com/maps/dir/?api=1&destination=${target[0]},${target[1]}&travelmode=driving`
    : null;

  return (
    <div className="mab-card p-3 mab-animate-fade-in border-2 border-blue-500/20">
      <div className="flex items-start justify-between px-1 pt-1 mb-3">
        <div className={`mab-badge ${STATUS_COLORS[order.status]}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[order.status]}`} />
          Livraison en cours
        </div>
        {gpsUrl && (
          <a href={gpsUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#FC3F1D] flex items-center gap-1">
            <ExternalLink size={13} /> GPS
          </a>
        )}
      </div>

      <TrackingMap order={order} driver={pos} className="h-72" />

      <div className="space-y-2 my-3 px-1">
        <div className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-[#FC3F1D] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">A</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 font-medium">{order.pickup_address}</p>
            <a href={`tel:${order.sender_phone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5">
              <Phone size={12} /> {order.sender_phone}
            </a>
          </div>
        </div>
        <div className="ml-3 border-l-2 border-dashed border-gray-200 h-2" />
        <div className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-black text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">B</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 font-medium">{order.delivery_address}</p>
            <p className="text-xs text-gray-500 mt-0.5">{order.recipient_name}</p>
            <a href={`tel:${order.recipient_phone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5">
              <Phone size={12} /> {order.recipient_phone}
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 pb-1 mt-4">
        <div>
          <p className="text-xs text-gray-400 font-medium">Gain</p>
          <p className="text-2xl font-bold text-black">
            {formatPrice(order.price)} <span className="text-sm">FCFA</span>
          </p>
        </div>
        <button
          onClick={async () => {
            setUpdating(true);
            try {
              await onUpdate(order, nextAction.status);
            } finally {
              setUpdating(false);
            }
          }}
          disabled={updating}
          className="mab-btn-primary flex items-center gap-2"
        >
          {updating ? <Loader2 size={18} className="animate-spin" /> : <><NextIcon size={18} /> {nextAction.label}</>}
        </button>
      </div>
    </div>
  );
}

// Carte compacte pour la liste de l'historique
function PastOrderCard({ order }: { order: Order }) {
  return (
    <div className="mab-card p-4 mab-animate-fade-in opacity-90 mb-3">
      <div className="flex items-start justify-between mb-3">
        <div className={`mab-badge ${STATUS_COLORS[order.status]}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[order.status]}`} />
          {STATUS_LABELS[order.status]}
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm text-gray-900 font-medium truncate flex items-center gap-2">
          <Navigation size={14} className="text-[#FC3F1D]" /> {order.pickup_address}
        </p>
        <p className="text-sm text-gray-900 font-medium truncate flex items-center gap-2">
          <MapPin size={14} className="text-gray-800" /> {order.delivery_address}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500 flex items-center gap-1"><User size={12} /> {order.recipient_name}</span>
        <span className="text-base font-bold text-black">{formatPrice(order.price)} F</span>
      </div>
    </div>
  );
}

// Modale de détail complète pour l'historique
function PastOrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-4 sm:p-0 mab-animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto mab-animate-slide-up relative">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Détail de la livraison</h3>
            <p className="text-xs text-gray-500">
              {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex justify-center">
            <div className={`mab-badge ${STATUS_COLORS[order.status]}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[order.status]}`} />
              {STATUS_LABELS[order.status]}
            </div>
          </div>

          <div className="space-y-4 bg-gray-50 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-[#FC3F1D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Récupération</p>
                <p className="text-sm text-gray-900 font-medium">{order.pickup_address}</p>
                <a href={`tel:${order.sender_phone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
                  <Phone size={12} /> {order.sender_phone}
                </a>
              </div>
            </div>
            <div className="ml-3.5 border-l-2 border-dashed border-gray-200 h-4" />
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Livraison</p>
                <p className="text-sm text-gray-900 font-medium">{order.delivery_address}</p>
                <p className="text-xs text-gray-500 mt-1">{order.recipient_name}</p>
                <a href={`tel:${order.recipient_phone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
                  <Phone size={12} /> {order.recipient_phone}
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {order.distance_km != null && (
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-[11px] text-gray-400 font-medium uppercase mb-0.5">Distance</p>
                <p className="text-sm font-bold text-gray-900">{order.distance_km} km</p>
              </div>
            )}
            {order.description && (
              <div className="bg-gray-50 p-3 rounded-xl col-span-2">
                <p className="text-[11px] text-gray-400 font-medium uppercase mb-0.5">Colis</p>
                <p className="text-sm text-gray-900">{order.description}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-[#FC3F1D]/5 border border-[#FC3F1D]/20 p-4 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 font-medium">Gain de la course</p>
              <p className="text-2xl font-bold text-black">
                {formatPrice(order.price)} <span className="text-sm">FCFA</span>
              </p>
            </div>
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
}