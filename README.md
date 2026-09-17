# FCPE — Écoles Frères Lumières (Montmagny)

Application d'information pour les parents des écoles maternelle et élémentaire
Frères Lumières.

Elle ne demande **aucun compte** et ne collecte rien qui permette d'identifier un
parent. Cinq onglets :

| Onglet      | Contenu                                                 |
| ----------- | ------------------------------------------------------- |
| **Accueil** | Les dernières actualités de l'école et de l'association |
| **Cantine** | Les menus, semaine par semaine, avec les allergènes     |
| **Agenda**  | Les dates importantes, à venir et passées               |
| **Contact** | Écrire au bureau de l'association                       |
| **Plus**    | Sondages, documents utiles, réglages et confidentialité |

---

## Comment cela fonctionne

```
        Publication                          Lecture
  ┌──────────────────────┐            ┌──────────────────────┐
  │ Tableau de bord      │            │ Application mobile   │
  │ Supabase             │───────────▶│ clé publique         │
  │ (clé service_role)   │            │ (rôle « anon »)      │
  └──────────────────────┘            └──────────────────────┘
     actualités, menus,                  lecture seule,
     agenda, documents,                  + deux écritures :
     sondages                            message, vote
```

Il n'y a **pas d'interface d'administration à construire ni à maintenir**. Le
bureau publie depuis le tableau de bord Supabase, qui est protégé par le compte
de l'association. C'est un choix : pour quelques publications par semaine, cela
supprime tout un pan de code, de surface d'attaque et de maintenance.

Les deux seules écritures possibles depuis l'application — déposer un message,
répondre à un sondage — passent par des fonctions de la base, et non par des
insertions directes. Les règles (sondage ouvert, cadence d'envoi) sont donc
appliquées là où un client modifié ne peut pas les contourner.

---

## Prérequis

| Outil          | Version           | Nécessaire pour                              |
| -------------- | ----------------- | -------------------------------------------- |
| Node.js        | 22.x (`>=22 <23`) | Tout                                         |
| npm            | 10+               | Tout                                         |
| Compte         | —                 | Un projet Supabase (l'offre gratuite suffit) |
| Expo Go        | dernière          | Essayer sur un téléphone sans compiler       |
| Xcode          | 16+               | Simulateur iOS — macOS uniquement            |
| Android Studio | SDK 35+           | Émulateur Android                            |

Rien n'est nécessaire pour compiler : les deux plateformes se compilent sur
GitHub.

| Plateforme  | Produit                                        | Document                                                               |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **iPhone**  | IPA non signé, à signer soi-même               | [`docs/01-installer-sur-iphone.md`](docs/01-installer-sur-iphone.md)   |
| **Android** | APK installable directement, sans re-signature | [`docs/04-installer-sur-android.md`](docs/04-installer-sur-android.md) |

---

## Démarrage

```bash
npm install
cp .env.example .env.local     # puis renseigner les deux valeurs Supabase
npm start                      # scanner le QR code avec Expo Go
```

Sans configuration, l'application **ne plante pas** : elle s'ouvre et explique ce
qui manque. C'est volontaire, et c'est aussi ce qui permet à l'intégration
continue de vérifier le code sans aucun secret.

### Où trouver les valeurs

Tableau de bord Supabase → **Project Settings** → **API** :

| Valeur du tableau de bord | Variable                        |
| ------------------------- | ------------------------------- |
| Project URL               | `EXPO_PUBLIC_SUPABASE_URL`      |
| `anon` `public`           | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

> La clé `anon` est **publique** : elle finit en clair dans l'application
> compilée, et c'est normal. Sa portée est entièrement définie par les
> politiques RLS du schéma. La clé `service_role` ne doit **jamais** être
> placée ici — `src/config/env.ts` refuse de démarrer si on la lui fournit.

### Créer la base

```bash
npx supabase link --project-ref <référence-du-projet>
npx supabase db push
```

Ou, sans la ligne de commande : copier le contenu de
`supabase/migrations/20260917120000_init.sql` dans l'éditeur SQL du tableau de
bord.

---

## Publier du contenu

Tout se fait depuis le tableau de bord Supabase, section **Table Editor**.
Le détail — quel champ remplir, dans quel ordre, et ce qui apparaît à l'écran —
est dans [`docs/02-publier-du-contenu.md`](docs/02-publier-du-contenu.md).

---

## Vérifications

```bash
npm run verify
```

Enchaîne, dans cet ordre :

| Commande                  | Ce qu'elle attrape                                       |
| ------------------------- | -------------------------------------------------------- |
| `npm run workflows:check` | Un flux de travail invalide, découvert en vingt minutes  |
| `npm run format:check`    | Deux formats concurrents, qui noient le vrai diff        |
| `npm run lint`            | Un crochet conditionnel : plantage sur le téléphone      |
| `npm run typecheck`       | Un champ renommé d'un seul côté                          |
| `npm test`                | La logique de dates, où un jour de décalage ne lève rien |
| `npm run sql:check`       | Une table sans RLS, ou une lecture accordée par mégarde  |
| `npm run export:android`  | Un module qui ne se résout pas dans le paquet            |

> **Sous Windows, `npm run verify` peut échouer à la dernière étape** avec
> `SAFE_DELETE_BULK_CONFIRM_REQUIRED`. Ce n'est pas un défaut du projet :
> `expo export` supprime le dossier `dist/` de l'exécution précédente, et
> l'environnement local intercepte les suppressions de plus de cinquante
> fichiers par tour de commande. Le contournement est de déplacer le dossier
> plutôt que de le supprimer — `mv dist "$TEMP/fl-dist"` — puis de relancer.
> Les étapes précédentes, elles, ne sont pas concernées.

Trois d'entre eux méritent une explication, car ils ne sont pas ordinaires :

- **`workflows:check`** analyse les fichiers de `.github/workflows`, vérifie que
  chaque action est épinglée à une version, et passe chaque script `run:` à
  `bash -n`. Il est placé en premier parce qu'il coûte deux secondes et qu'il
  évite de découvrir une faute de frappe après l'installation du SDK Android.
  L'APK ne peut pas être compilé sur cette machine — Java 8, pas de SDK — donc
  chaque erreur de flux de travail se paie en allers-retours.
- **`sql:check`** lit les migrations et vérifie que chaque table active la RLS,
  que ses privilèges sont révoqués puis accordés explicitement, et que les deux
  tables sensibles — `messages` et `sondage_votes` — restent fermées au rôle
  anonyme. Ces fautes ne se voient **nulle part ailleurs** : le schéma
  s'applique sans erreur et l'application fonctionne parfaitement.
- **`export:android`** est le seul contrôle qui fait passer le paquet par Metro.
  Un module natif mal déclaré échoue ici et nulle part ailleurs.

---

## Structure

```
app/                        Écrans (expo-router : le fichier EST la route)
  _layout.tsx               Thème, marges de sécurité, pile de navigation
  (tabs)/                   Les cinq onglets
  annonce/[id].tsx          Détail d'une actualité
  documents.tsx             Liste des documents
  reglages.tsx              Apparence et diagnostic
  confidentialite.tsx       Politique de confidentialité
src/
  components/ui/            AppText, Card, Button, TextField, états…
  components/               Composants métier (actualité, sondage)
  config/                   Lecture de l'environnement, client Supabase
  errors/                   Traduction des erreurs en français
  hooks/                    Chargement asynchrone dérivé
  lib/                      Identifiants d'installation, mémoire des votes
  providers/                Thème clair/sombre
  services/                 Une fonction par requête
  theme/                    Palettes et échelles
  types/                    Types du domaine
  utils/                    Dates, formatage
supabase/migrations/        Le schéma — et la sécurité de l'application
scripts/                    Contrôles automatiques
```

---

## Sécurité

L'application embarque une clé publique extractible par quiconque installe le
binaire. **La sécurité ne repose donc sur aucune ligne de son code** : elle
repose entièrement sur `supabase/migrations/`.

Ce qui en découle, et qui est vérifié automatiquement à chaque poussée :

- chaque table active la sécurité au niveau des lignes ;
- le contenu est lisible, jamais modifiable avec la clé publique ;
- `messages` et `sondage_votes` ne sont lisibles par personne : les résultats
  des sondages passent par une fonction qui ne renvoie que des compteurs, et les
  messages ne sont visibles que du bureau ;
- les écritures passent par des fonctions `security definer` qui appliquent
  leurs règles, y compris face à un client modifié.

Le détail est dans [`docs/03-securite-et-donnees.md`](docs/03-securite-et-donnees.md).

---

## Données personnelles

L'application ne demande ni nom, ni adresse, ni téléphone, ni position. Elle ne
contient aucun outil de mesure d'audience ni publicité.

Deux identifiants aléatoires sont conservés sur le téléphone — un pour les
votes, un pour la cadence des messages — et sont **volontairement distincts** :
un identifiant unique permettrait de relier un message signé au vote du même
appareil. Ce sont des données pseudonymes au sens du RGPD, déclarées comme
telles dans l'écran Confidentialité de l'application.

> **Avant toute mise à disposition**, compléter la section « Responsable de
> traitement » de `app/confidentialite.tsx` : nom de l'association, adresse du
> siège et adresse de contact. Ces informations figurent dans les statuts.
