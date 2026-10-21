/*
# MAB - Livraison au Sénégal - Schéma de base de données

## Description
Application de livraison de colis pour le Sénégal, inspirée de Yango.
Les clients créent des commandes avec adresse de récupération, adresse de livraison,
et numéros de téléphone. Les livreurs à proximité reçoivent des notifications
et le premier qui accepte gère la livraison.

## Tables créées

### profiles
- id (uuid, PK, lié à auth.users)
- full_name (text) - nom complet
- phone (text) - numéro de téléphone
- role (text: 'client' ou 'driver') - type d'utilisateur
- created_at (timestamp)

### orders
- id (uuid, PK)
- client_id (uuid, FK vers auth.users) - client qui crée la commande
- driver_id (uuid, FK vers auth.users, nullable) - livreur qui accepte
- pickup_address (text) - adresse de récupération du colis
- delivery_address (text) - adresse de livraison
- sender_phone (text) - numéro de téléphone de l'expéditeur
- recipient_phone (text) - numéro du destinataire
- recipient_name (text) - nom du destinataire
- status (text: 'pending', 'accepted', 'picked_up', 'delivered', 'cancelled')
- price (numeric) - prix de la livraison
- description (text, nullable) - description du colis
- created_at (timestamp)
- accepted_at (timestamp, nullable)
- delivered_at (timestamp, nullable)

## Sécurité
- RLS activée sur toutes les tables
- Policies owner-scoped pour clients sur orders
- Policies pour drivers: peuvent voir les commandes pending et celles qu'ils gèrent
- Profiles: chaque utilisateur ne voit que son propre profil
*/

-- Table des profils
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'driver')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies pour profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Table des commandes
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup_address text NOT NULL,
  delivery_address text NOT NULL,
  sender_phone text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled')),
  price numeric NOT NULL DEFAULT 2000,
  description text,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  delivered_at timestamptz
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Les clients peuvent voir leurs propres commandes
-- Les livreurs peuvent voir les commandes pending (pour les accepter) et celles qu'ils gèrent
DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = client_id
    OR auth.uid() = driver_id
    OR (status = 'pending' AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'driver'
    ))
  );

-- Seuls les clients peuvent créer des commandes
DROP POLICY IF EXISTS "insert_orders" ON orders;
CREATE POLICY "insert_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'client'
    )
  );

-- Les clients peuvent annuler leurs commandes (si pending)
-- Les livreurs peuvent accepter et mettre à jour le statut
DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders FOR UPDATE
  TO authenticated USING (
    auth.uid() = client_id
    OR auth.uid() = driver_id
    OR (status = 'pending' AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'driver'
    ))
  )
  WITH CHECK (
    auth.uid() = client_id
    OR auth.uid() = driver_id
    OR (auth.uid() = driver_id AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'driver'
    ))
  );

-- Les clients peuvent supprimer leurs propres commandes
DROP POLICY IF EXISTS "delete_orders" ON orders;
CREATE POLICY "delete_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = client_id);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);