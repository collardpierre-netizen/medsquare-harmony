# Séances récurrentes : rattacher une salle

## Problème confirmé
Les séances générées automatiquement pour les activités récurrentes sont créées sans salle (`room_id` vide) : la génération automatique hebdomadaire et la génération manuelle ne connaissent pas la salle, car la récurrence d'une activité ne stocke que `{jour, début, fin}`.

Conséquences :
- ces séances n'apparaissent pas dans le planning des réservations (le planning filtre par salle) ;
- leur créneau reste affiché comme libre et aucun conflit n'est signalé : un praticien peut réserver la salle pendant un cours.

Les séances créées manuellement, elles, ont bien une salle — d'où l'incohérence actuelle.

## Ce qui serait fait
1. **Récurrence avec salle** — dans le formulaire d'activité (Activités), chaque créneau récurrent reçoit un champ « Salle » (obligatoire pour les nouvelles récurrences, facultatif pour les anciennes).
2. **Génération** — la génération automatique (tâche hebdomadaire) et la génération manuelle reprennent la salle du créneau récurrent lors de la création de la séance.
3. **Rattrapage** — pour les activités récurrentes existantes, un écran/action admin permet d'affecter une salle par créneau, puis de compléter les séances futures déjà créées sans salle.
4. **Cohérence planning** — vérification que les séances ainsi rattachées s'affichent dans le planning et déclenchent bien l'alerte « Conflit détecté » à la création d'une réservation.

## Détails techniques
- `activities.recurrence` : ajout d'une clé `room_id` dans chaque objet de créneau (rétro-compatible, absent = ancien format).
- Mise à jour des fonctions base de données `generate_recurring_sessions` et `generate_recurring_sessions_cron` pour insérer `room_id` depuis le créneau.
- Mise à jour de `src/pages/dashboard/Activities.tsx` (édition des créneaux récurrents).
- Aucune modification du filtre par salle dans `src/pages/dashboard/Bookings.tsx` : il devient correct dès que les séances portent une salle.

## Point ouvert
Faut-il empêcher la génération d'une séance récurrente si la salle est déjà occupée à ce créneau (séance ignorée + signalement), ou la créer malgré tout en affichant le conflit dans le planning ?
