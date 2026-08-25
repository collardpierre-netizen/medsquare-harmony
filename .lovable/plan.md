# Plan : Tarification multi-paliers par activité

## Objectif
Permettre d'encoder plusieurs prix par activité (à l'unité, carnets dégressifs, abonnements mensuel / trimestriel / semestriel / annuel / bi-annuel) et d'afficher ces tarifs publiquement.

## Choix techniques

### 1. Modèle de données
- Nouvelle table `activity_prices` liée à `activities` :
  - `activity_id` uuid NOT NULL
  - `label` text (ex. "Séance unique", "Carnet 10 séances", "Abonnement annuel")
  - `price` numeric NOT NULL
  - `billing_frequency` enum : `unit`, `pack_5`, `pack_10`, `monthly`, `quarterly`, `biannual`, `annual`, `biennial`
  - `sort_order` integer
  - `is_active` boolean
- Conserver `activities.is_free` et `activities.price` pour compatibilité immédiate (uniquement si aucun prix multi-paliers n'est défini).

### 2. Écran dédié d'encodage
- Nouvelle page `/dashboard/admin/activity-prices` accessible aux admins et aux praticiens pour leurs propres activités.
- Tableau listant les activités avec un bouton "Gérer les tarifs".
- Dialogue CRUD pour ajouter / modifier / supprimer / réordonner les paliers.
- Option "Gratuit" qui désactive les tarifs.

### 3. Affichage public
- Page `/activites` : carte d'activité affiche le tarif de base ou "Dès X €" si plusieurs paliers existent.
- Page `/activite/:id` : section "Tarifs" listant tous les paliers actifs avec badge de fréquence.
- Dialogue d'inscription : si l'activité est payante, afficher un sélecteur de palier (optionnel selon le flux de réservation).

### 4. Dashboard activités
- Remplacer le champ prix unique par un lien vers l'écran dédié.
- Indicateur visuel sur la carte activité si plusieurs tarifs sont configurés.

## Fichiers concernés
- Migration : création de `activity_prices` avec GRANT + RLS + policies.
- `src/pages/dashboard/AdminActivityPrices.tsx` (nouveau).
- `src/pages/dashboard/Activities.tsx` (lien vers tarifs).
- `src/pages/ActiviteDetail.tsx` (section tarifs).
- `src/components/activities/ActivityCard.tsx` (tarif de base).
- `src/integrations/supabase/types.ts` (généré automatiquement).

## Non inclus
- Paiement en ligne (hors MVP).
- Gestion des remises personnalisées par participant.
