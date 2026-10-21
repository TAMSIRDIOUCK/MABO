/*
# Renommer la table profiles en profiles5

## Description
Renomme la table `profiles` en `profiles5` selon la demande de l'utilisateur.
Toutes les politiques RLS et index existants sont conservés.

## Changements
- Renomme la table `profiles` en `profiles5`
- Les politiques RLS existantes restent attachées à la table (Postgres conserve les policies lors d'un RENAME)
- Les index existants restent attachés à la table
- La contrainte de clé étrangère vers auth.users(id) est conservée
*/

ALTER TABLE profiles RENAME TO profiles5;