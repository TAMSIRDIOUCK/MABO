import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  role: 'client' | 'driver';
  created_at: string;
};

export type OrderStatus = 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  client_id: string;
  driver_id: string | null;
  pickup_address: string;
  delivery_address: string;
  sender_phone: string;
  recipient_phone: string;
  recipient_name: string;
  status: OrderStatus;
  price: number;
  description: string | null;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
};
