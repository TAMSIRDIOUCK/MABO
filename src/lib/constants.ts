import type { OrderStatus } from './supabase';

export const BRAND_RED = '#FC3F1D';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Recherche de livreur',
  accepted: 'Livreur en route',
  picked_up: 'Colis récupéré',
  delivered: 'Livré',
  cancelled: 'Annulée',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  accepted: 'bg-blue-100 text-blue-700 border-blue-200',
  picked_up: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export const STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-500',
  accepted: 'bg-blue-500',
  picked_up: 'bg-purple-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

// Tarifs MABO par distance (FCFA)
export const PRICE_TIERS = [
  { max: 2, range: '1 – 2 km', name: 'Courte distance', price: 1000 },
  { max: 5, range: '2 – 5 km', name: 'Moyenne distance', price: 1500 },
  { max: 10, range: '5 – 10 km', name: 'Longue distance', price: 2000 },
  { max: 20, range: '10 – 20 km', name: 'Très longue distance', price: 3000 },
  { max: Infinity, range: '+ de 20 km', name: 'Distance extrême', price: 5000 },
] as const;

export function priceTier(distanceKm: number) {
  return PRICE_TIERS.find((t) => distanceKm <= t.max) ?? PRICE_TIERS[PRICE_TIERS.length - 1];
}

export function priceForDistance(distanceKm: number): number {
  return priceTier(distanceKm).price;
}