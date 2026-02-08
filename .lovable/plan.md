

# 🏥 Medsquare — Plan de Refonte Complète

## Vision
Un site premium, humain et professionnel servant de **vitrine pour les patients** et d'**outil de gestion pour les praticiens** (6-15 praticiens, 4-8 salles). Première version en **français uniquement**, **sans paiement en ligne** pour l'instant. Les deux faces (vitrine + back-office) seront développées en parallèle dans une version allégée.

---

## 🌐 PARTIE 1 — Site Vitrine Public

### Page d'Accueil
- **Hero section** plein écran avec image du centre, slogan inspirant et boutons d'action (Découvrir nos praticiens / Nous contacter)
- Section "Pourquoi Medsquare" — 3-4 points forts illustrés (icônes + texte court)
- Aperçu des praticiens — carrousel ou grille avec photos et spécialités
- Aperçu des espaces — images des locaux avec description courte
- Témoignages / avis patients (section placeholder pour l'instant)
- Bande de contact rapide (téléphone, email, adresse)

### Page "Le Centre"
- Présentation de la philosophie et des valeurs de Medsquare
- Galerie photos des espaces (ambiance chaleureuse et professionnelle)
- Histoire / mission du centre
- Localisation avec carte interactive intégrée

### Page "Nos Praticiens"
- Grille de praticiens avec photo, nom, spécialité
- Clic sur un praticien → page de profil détaillé : photo grande, biographie, spécialités, parcours, horaires de consultation, lien de contact

### Page "Nos Espaces"
- Présentation visuelle des salles disponibles (photos, capacité, équipements)
- Tarifs indicatifs affichés
- Bouton "Contactez-nous pour réserver" (pas de réservation en ligne dans cette phase)

### Page Contact & FAQ
- Formulaire de contact simple (nom, email, message, sujet)
- Coordonnées complètes (téléphone, email, adresse)
- Carte Google Maps intégrée
- Section FAQ avec questions/réponses en accordéon

---

## 🔐 PARTIE 2 — Espace Praticiens (Back-office)

### Authentification
- Page de connexion sécurisée (email + mot de passe)
- Système de rôles : praticien / administrateur
- Récupération de mot de passe par email

### Tableau de bord praticien
- Vue d'ensemble personnalisée : prochaines réservations, notifications, accès rapides
- Message de bienvenue avec le nom du praticien

### Mon Profil
- Édition du profil public : photo, biographie, spécialités, horaires
- Les modifications sont visibles sur le site vitrine après sauvegarde
- Aperçu de "comment mon profil apparaît sur le site"

### Agenda & Réservations des Salles
- Calendrier visuel interactif montrant les disponibilités des salles
- Vue par jour / semaine / mois
- Code couleur par salle et par praticien
- Demande de réservation d'une salle (créneau + salle souhaitée)
- Historique de ses propres réservations
- Statut des réservations (confirmée, en attente, annulée)

### Documents
- Consultation et téléchargement de documents (contrats, factures)
- Les documents sont mis à disposition par l'administrateur
- Format PDF

### Espace Administrateur (rôle admin uniquement)
- Gestion des praticiens : ajouter, modifier, désactiver un praticien
- Gestion des salles : ajouter, modifier les salles et leurs disponibilités
- Validation / refus des demandes de réservation
- Upload de documents pour les praticiens
- Vue globale de toutes les réservations

---

## 🎨 DESIGN & EXPÉRIENCE

- **Palette douce et professionnelle** : tons neutres (blanc cassé, beige, gris clair) avec une couleur d'accent élégante (bleu profond ou vert sauge)
- **Typographie premium** : titres élégants, texte lisible et aéré
- **Photos authentiques** : mise en valeur des portraits et des espaces (placeholders professionnels en attendant le contenu final)
- **Animations subtiles** : transitions douces au scroll, hover effects élégants
- **100% responsive** : expérience optimale sur mobile, tablette et desktop
- **Navigation claire** : menu fixe en haut, navigation intuitive

---

## 🗂 STRUCTURE DES DONNÉES (Backend)

- **Praticiens** : nom, photo, bio, spécialités, horaires, email, statut actif/inactif
- **Salles** : nom, description, photos, capacité, équipements, tarif indicatif
- **Réservations** : praticien, salle, date/heure début et fin, statut
- **Documents** : fichier PDF, praticien associé, type de document, date
- **Utilisateurs** : email, mot de passe, rôle (praticien/admin)

---

## 📋 PHASES DE LIVRAISON

### Phase 1 (MVP) — Ce qui sera construit maintenant
- ✅ Toutes les pages vitrine (Accueil, Centre, Praticiens, Espaces, Contact)
- ✅ Authentification praticiens/admin
- ✅ Gestion de profil praticien
- ✅ Calendrier des salles + système de réservation
- ✅ Tableau de bord praticien et admin
- ✅ Design responsive premium

### Phase 2 (Évolutions futures)
- 💳 Paiement en ligne (Stripe) pour les réservations
- 🌍 Multilingue FR/NL/EN
- 📧 Notifications email automatiques (confirmations, rappels)
- 📊 Génération et export de factures PDF
- 📝 Blog / Actualités
- 📈 Statistiques et rapports pour l'admin

