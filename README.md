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

Le **bureau** publie les annonces, les menus, l'agenda et les documents depuis
une page web, dans `admin/`. Elle ne demande aucun serveur, et son installation
est décrite dans [`docs/05-administration.md`](docs/05-administration.md).

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

Le tableau de bord : <https://supabase.com/dashboard/project/toksjxrrgvgovbolcjvr>
(projet `parents-simple-cli`). Puis **Settings** → **API Keys** :

| Valeur du tableau de bord | Variable                        |
| ------------------------- | ------------------------------- |
| Project URL               | `EXPO_PUBLIC_SUPABASE_URL`      |
| publishable key           | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

> **Deux formes de clé publique coexistent, et elles ne se ressemblent pas.**
> La clé _publishable_ (`sb_publishable_…`) est une **chaîne courte** : ce n'est
> pas un JWT. C'est la forme que le tableau de bord met aujourd'hui en avant.
> L'ancienne clé `anon` — un JWT, donc une longue chaîne commençant par `eyJ` —
> fonctionne encore, et créer les nouvelles clés ne révoque pas les anciennes.
> Mais Supabase déprécie `anon` et `service_role` pour la fin de 2026.
>
> La documentation officielle le dit sans détour : _« si un outil, un tutoriel
> ou un assistant vous dit de copier une longue clé commençant par `eyJ`, c'est
> qu'il a été écrit pour les clés historiques »_. Les deux formes portent le
> même rôle, `anon`, tant qu'aucun utilisateur n'est connecté — et cette
> application n'en connecte aucun.

> La clé publique est **faite pour être exposée** : elle finit en clair dans
> l'application compilée, et c'est normal. Sa portée est entièrement définie par
> les politiques RLS du schéma. La clé secrète — _secret key_ (`sb_secret_…`)
> ou, dans l'ancienne forme, `service_role` — ne doit **jamais** être placée ici.
> Elle contourne la RLS : `src/config/env.ts` refuse de démarrer si on la lui
> fournit, sous ses deux formes.

### Créer la base

```bash
npx supabase link --project-ref <référence-du-projet>
npx supabase db push
```

Ou, sans la ligne de commande : coller **chaque fichier** de
`supabase/migrations/`, **dans l'ordre de leur nom**, dans l'éditeur SQL du
tableau de bord, et exécuter chacun avant de passer au suivant.

Troisième voie, sans projet lié : l'outil du dépôt, qui appelle le **même point
d'entrée** que l'éditeur SQL, en **un seul lot** — pas d'historique de migration,
donc rien qui risque de rejouer un fichier antérieur.

```bash
npx supabase login   # une seule fois : dépose un jeton dans ~/.supabase/
node scripts/appliquer-migration.mjs supabase/migrations/<fichier>.sql
```

Les chemins se lisent **depuis la racine du dépôt**. L'outil refuse de partir sans
jeton, ou avec un jeton dont la forme n'est pas `sbp_…`, et n'affiche jamais le
jeton lui-même.

> **Il ne suffit pas de coller le premier.** `20260917120000_init.sql` crée les
> tables ; les fichiers suivants ajoutent des colonnes que l'application lit —
> la catégorie et l'image d'une actualité, par exemple. Une base arrêtée au
> premier fichier répond, mais l'onglet Accueil reste vide : la requête demande
> des colonnes qui n'existent pas, et PostgREST refuse la lecture entière plutôt
> que de rendre les colonnes connues.

Tous les fichiers sont écrits pour pouvoir être rejoués : les relancer sur une
base à jour ne produit ni erreur ni doublon.

> **La compilation aussi s'arrête.** Une compilation lancée avant d'avoir
> appliqué la migration échoue **en une minute**, sur l'étape « Éprouver la base
> avant de compiler », avec `column annonces.categorie does not exist` et
> `404 Bucket not found`. Ce n'est pas une panne de compilation : c'est le
> garde-fou qui refuse de produire un binaire dont les requêtes ne correspondent
> pas à la base déployée. Sans lui, l'application s'installerait et afficherait
> un écran d'erreur à la place des actualités. Appliquez la migration, puis
> relancez — la compilation reprend normalement.

---

## Publier du contenu

Tout se fait depuis le tableau de bord Supabase, section **Table Editor**.
Le détail — quel champ remplir, dans quel ordre, et ce qui apparaît à l'écran —
est dans [`docs/02-publier-du-contenu.md`](docs/02-publier-du-contenu.md).

Pour essayer l'application avant de saisir le vrai contenu,
[`supabase/exemple-contenu.sql`](supabase/exemple-contenu.sql) remplit chaque
table de quelques lignes réalistes — dont un sondage ouvert, ce qui permet
d'éprouver le seul chemin que les contrôles automatiques ne couvrent pas : voter.

---

## Personnaliser la bannière de l'accueil

La bannière de l'écran Accueil est **dessinée par l'application** : un dégradé de
ciel, un soleil et quelques feuilles, aux couleurs du thème. Elle ne contient
aucune photographie, et c'est volontaire — le dépôt est public, et une photo
d'école qui y serait déposée le resterait dans l'historique Git, même retirée
ensuite.

Pour y mettre une photo de l'école, déposer le fichier sous
`assets/banniere-ecole.jpg`, puis remplacer la constante en tête de
[`src/components/BanniereAccueil.tsx`](src/components/BanniereAccueil.tsx) :

```ts
const PHOTO_BANNIERE: ImageSourcePropType | null = require('../../assets/banniere-ecole.jpg');
```

Trois précautions, par ordre d'importance :

- **choisir une photo sans visage identifiable au premier plan.** Le titre et le
  sous-titre sont posés par-dessus, et le dégradé qui les protège assombrit le
  haut de l'image ;
- **cadrer en paysage et large** : l'image est recadrée au centre pour couvrir
  toute la largeur de la bannière, et un sujet collé à un bord peut disparaître ;
- **regarder le résultat dans les deux apparences.** Le dégradé de protection
  suit le mode sombre ; une photo très claire peut y devenir trop lumineuse, et
  le texte perdre son contraste.

Le `require` doit rester **littéral**. Un chemin construit à l'exécution n'est
pas résolu à la compilation : l'image manquerait, sans erreur ni message.

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
| `npm run sql:check`       | Une table sans RLS, ou une écriture ouverte à tous       |
| `npm run admin:check`     | Une colonne, une borne ou une énumération nommée de      |
|                           | travers dans la page d'administration                    |
| `npm run export:android`  | Un module qui ne se résout pas dans le paquet            |
| `npm run admin:verify`    | Une page d'administration qui ne compile plus, ou qui ne |
|                           | se déploie pas hors de la racine d'un domaine            |

> **Sous Windows, `npm run verify` peut échouer à l'avant-dernière étape** avec
> `SAFE_DELETE_BULK_CONFIRM_REQUIRED`. Ce n'est pas un défaut du projet :
> `expo export` supprime le dossier `dist/` de l'exécution précédente, et
> l'environnement local intercepte les suppressions de plus de cinquante
> éléments par tour de commande. `dist/` peut dépasser ce seuil **à lui seul** :
> mesuré le 18 septembre 2026, le garde-fou en a compté 67, alors que le dossier
> portait 48 fichiers et 5 sous-dossiers. Le compte ne porte donc pas sur les
> seuls fichiers, et l'écart n'est pas expliqué. Le contournement est de
> déplacer **les deux** dossiers produits plutôt que de les supprimer —
> `mv dist "$TEMP/fl-dist"` et `mv admin/dist "$TEMP/fl-admin-dist"` — puis de
> relancer. Les étapes précédentes, elles, ne sont pas concernées.

Quatre d'entre eux méritent une explication, car ils ne sont pas ordinaires :

- **`workflows:check`** analyse les fichiers de `.github/workflows`, vérifie que
  chaque action est épinglée à une version, et passe chaque script `run:` à
  `bash -n`. Il est placé en premier parce qu'il coûte deux secondes et qu'il
  évite de découvrir une faute de frappe après l'installation du SDK Android.
  L'APK ne peut pas être compilé sur cette machine — Java 8, pas de SDK — donc
  chaque erreur de flux de travail se paie en allers-retours.

  Il tient aussi la **liste des flux attendus**, fermée comme celle de
  `admin:check` : un fichier absent le fait échouer, et un fichier ajouté aussi
  tant qu'il n'est pas déclaré. C'est nécessaire parce qu'il découvre ses sujets
  par `readdir` — il mesure donc ce qui **reste**, jamais ce qui **manque**.
  Mesuré : `ci.yml` écarté du dossier, il annonçait « 67 vérifications sur
  2 flux de travail » et « Tous les flux de travail sont valides », code de
  sortie 0, alors qu'un tiers de son sujet avait disparu — dont le flux qui
  lance tous les autres.

- **`sql:check`** lit les migrations et vérifie que chaque table active la RLS,
  que ses privilèges sont révoqués puis accordés explicitement, que les trois
  tables sensibles — `messages`, `sondage_votes` et `membres_bureau` — restent
  fermées, et qu'**aucune politique d'écriture ne vise le rôle anonyme**. Il
  refuse aussi une politique sans clause `to`, qui vaut PUBLIC et ouvrirait donc
  la table à tout le monde sans que rien ne le laisse voir à la lecture.

  Il exige enfin que **chaque politique d'écriture visant `authenticated`** porte
  la condition `public.est_membre_bureau()`, dans `using` **et** dans
  `with check`. C'est la règle qui compte depuis que le bureau publie depuis une
  page web : Supabase ouvre l'inscription publique par défaut, donc
  `authenticated` s'obtient en s'inscrivant, et le rôle ne dit pas qui est la
  personne. `securite:api` ne peut pas la voir — il interroge la base avec la clé
  publique — si bien que ce contrôle-ci est le seul à tenir la condition
  d'appartenance. Les deux clauses sont exigées séparément parce que `with check`
  ne s'applique ni à `delete` ni au choix des lignes visibles : un `using (true)`
  gardé seulement par son `with check` laisserait tout inscrit supprimer n'importe
  quelle annonce.

  Ces fautes ne se voient **nulle part ailleurs** : le schéma s'applique sans
  erreur et l'application fonctionne parfaitement.

- **`admin:check`** confronte la page d'administration au schéma : chaque table
  qu'elle appelle, chaque colonne de ses `select`, chaque borne de ses champs,
  chaque valeur de ses listes déroulantes, chaque compartiment de stockage. Le
  plus coûteux de ces écarts est celui des colonnes, et il mérite d'être écrit :
  le client Supabase déduit le type d'une ligne de la **table**, jamais de la
  chaîne passée à `select`. Une colonne mal orthographiée traverse donc `tsc`,
  `eslint` et la construction, et n'échoue qu'à l'exécution — devant le bureau,
  au moment où il croit avoir publié. Ce contrôle **ferme** aussi les ensembles :
  une contrainte bornée ajoutée à une migration, ou une cinquième table appelée
  par la page, fait échouer le contrôle tant qu'elle n'a pas été prise en compte
  délibérément.
- **`export:android`** est le seul contrôle qui fait passer le paquet par Metro.
  Un module natif mal déclaré échoue ici et nulle part ailleurs.

**`admin:verify`** est placé en dernier parce qu'il installe ses propres
dépendances, et que c'est donc la seule étape qui dépende du réseau. Un flux
s'arrête à la première étape en échec : en dernier, il ne cache pas le verdict
de l'export, qui est local et toujours utile. L'administration a son propre
`package.json` et son propre empaqueteur — ni `typecheck` ni `export:android` ne
la regardent, et sans cette étape elle pourrait pourrir sans que rien ne le dise.
`admin:check`, lui, est placé **avant** `export:android` : il lit des sources et
non un paquet, donc il ne demande aucune installation et coûte une seconde.

Depuis qu'il enchaîne `admin:page`, `admin:verify` regarde aussi l'**artefact** :
`admin/dist/index.html` ne doit référencer aucune ressource depuis la racine du
domaine. Le commentaire de `vite.config.ts` promettait des chemins relatifs depuis
longtemps ; la clé `base`, elle, avait disparu, et la page n'aurait fonctionné
qu'à la racine d'un domaine. C'est le seul contrôle du projet qui lise un fichier
**construit** — et il échoue si la page n'a pas été construite, plutôt que de
parcourir une liste vide.

### Éprouver la sécurité sur la base réelle

```bash
npm run securite:api
```

`sql:check` lit la migration et vérifie qu'elle **dit** les bonnes choses. Ce
contrôle-ci interroge la base **réelle**, avec la même clé publique que celle
embarquée dans l'application, et vérifie ce qu'un inconnu peut réellement en
faire. La distinction compte : une politique ajoutée à la main depuis le tableau
de bord n'apparaît dans aucun fichier, et une migration jamais appliquée décrit
une base qui n'existe pas.

28 vérifications, dont **aucune ne modifie la base** — les appels aux fonctions
sont choisis pour échouer avant toute insertion.

Depuis l'ouverture de l'écriture au bureau, il éprouve aussi ce qui compte le
plus : que cette ouverture **n'ait rien laissé passer du côté de la clé
publique**. Il tente donc une écriture dans les deux compartiments de stockage
et vérifie qu'elle est refusée, et il exige que `membres_bureau` réponde
« interdit » — un `404` signifiant que la table n'existe pas, donc que la
migration n'est pas appliquée. C'est le seul contrôle qui distingue « fermé » de
« absent » : sans lui, une base non migrée passerait pour une base protégée.

> **Le refus du stockage ne ressemble pas aux autres.** L'API REST refuse par un
> `401` ou un `403` ; le service de stockage répond **`400`** et met le refus
> dans le corps — `{"statusCode":"403","error":"Unauthorized"}`. Exiger `403` en
> ferait échouer le contrôle à tort, et accepter `400` sans lire le corps le
> rendrait muet, puisqu'un `400` est aussi ce que produit un type de fichier
> refusé. La fonction qui tranche est éprouvée par
> `tests/refus-de-droit.test.mjs`, y compris dans les deux sens.

### Confronter l'application à la base réelle

```bash
npm run verifier:requetes
```

Le contrôle précédent vérifie ce qu'un inconnu ne peut **pas** faire. Celui-ci
vérifie ce que l'application **fait**. Les deux moitiés comptent autant l'une que
l'autre, et les défaillances ne se ressemblent pas : une table ouverte se voit
dans le premier, tandis qu'une colonne renommée dans le schéma ne se voit que
dans le second.

Ce qui rend ce défaut-là coûteux, c'est **où** il apparaît. Une colonne mal
orthographiée, un filtre sur un type incompatible, un nom de table mal
orthographié donnent un `400` que le code transforme en message d'erreur — ou,
si l'erreur est avalée, en onglet vide. Aucun test unitaire ne le voit, puisque
les tests simulent la base. Sans ce contrôle, on l'apprend sur le téléphone d'un
parent, après installation.

Les requêtes sont **extraites** de `src/services/*.ts` plutôt que recopiées :
un service ajouté demain entre dans l'analyse sans qu'on ait à y penser. Un
garde-fou vérifie que l'analyse ne perd pas silencieusement un fichier.

Il vérifie aussi le compartiment de stockage : son absence rendrait tous les
liens de documents morts, et aucune table ne le signalerait. Le **nom** du
compartiment est lui aussi extrait du code, pas recopié — renommer le
compartiment dans le service fait donc échouer le contrôle, au lieu de le
laisser vert en train de sonder un compartiment disparu.

> **Ce qui reste non vérifié.** Les chemins de **succès** de `voter` et
> `envoyer_message` ne sont éprouvés nulle part : `securite:api` ne teste que
> leurs refus. Les éprouver demande un sondage ouvert et un message réellement
> déposé, donc des écritures. Tant que ce complément n'existe pas, un `voter`
> cassé ne serait découvert qu'au premier sondage — mais il le serait **avec un
> message**, pas en silence : `SondageCard` attrape l'erreur et l'affiche sous la
> question, et l'écran Contact fait de même. Le risque est d'apprendre le défaut
> tard, pas qu'il passe inaperçu.
>
> `supabase/exemple-contenu.sql` crée justement un sondage ouvert, pour que ce
> chemin puisse être éprouvé à la main en attendant.

Les deux contrôles exigent une configuration et ne font donc pas partie de
`npm run verify`, qui doit tourner sans aucun secret. **Trois flux de travail les
exécutent** : `ci.yml` à chaque poussée vers `main`, et les deux flux de mise
à disposition **avant de compiler**. On ne produit ni un APK ni un IPA pour une
base ouverte, ni pour une base que l'application ne sait pas interroger. Le
quatrième, `admin-pages.yml`, publie la page d'administration : il n'éprouve pas
la base, et n'a donc besoin d'aucun secret.

> **Conséquence à connaître** : `securite:api` échoue tant que la migration
> `20260918001000_membres_bureau.sql` n'est pas appliquée — la table
> `membres_bureau` répond alors `404`, et un contrôle qui ne peut rien affirmer
> doit échouer plutôt que passer. Une compilation lancée avant d'avoir appliqué
> cette migration s'arrête donc sur cette étape. C'est voulu : la base et le
> dépôt ne doivent pas diverger. La procédure est dans
> [`docs/05-administration.md`](docs/05-administration.md).

---

## Structure

```
app/                        Écrans (expo-router : le fichier EST la route)
  _layout.tsx               Thème, marges de sécurité, pile de navigation
  (tabs)/                   Les cinq onglets
  annonce/[id].tsx          Détail d'une actualité
  documents.tsx             Liste des documents
  reglages.tsx              Apparence et diagnostic (sonde la base pour de vrai)
  confidentialite.tsx       Politique de confidentialité
src/
  components/ui/            AppText, Card, Button, TextField, états…
  components/               Composants métier (bannière, actualité, sondage)
  components/BarreOnglets   La barre d'onglets, écrite à la main
  config/                   Lecture de l'environnement, client Supabase
  errors/                   Traduction des erreurs en français
  hooks/                    Chargement asynchrone dérivé, rafraîchissement par glissement
  lib/                      Règles pures : identifiants, votes locaux, chargement, responsable,
                            adresse, diagnostic
  providers/                Thème clair/sombre
  services/                 Une fonction par requête
  theme/                    Palettes et échelles
  types/                    Types du domaine
  utils/                    Dates, formatage
supabase/migrations/        Le schéma — et la sécurité de l'application
admin/                      Page d'administration du bureau (statique, sans serveur)
  src/lib/                  Configuration, client, requêtes, bornes de saisie
  src/ecrans/               Connexion, annonces, cantine, agenda, documents
  src/components/           Champs et avis partagés
scripts/                    Contrôles automatiques et outils ponctuels
```

L'administration est une application distincte, avec son propre
`package.json` : elle est construite par Vite, pas par Metro. Les deux ne se
mélangent pas — `tsconfig.json` et `eslint.config.mjs` l'excluent explicitement
de l'outillage de l'application mobile, et elle a son propre contrôle dans
l'intégration continue.

### Le diagnostic de l'écran Réglages

Quand l'application n'affiche rien, la question est de savoir si c'est l'école
qui n'a rien publié ou l'application qui n'atteint pas sa base. La ligne
« Base de données » ne dit que ce qu'elle sait — l'adresse est renseignée — et
c'est la ligne « Connexion » qui tranche, en s'appuyant sur une requête réelle
(`src/services/diagnostic.ts`). La règle d'affichage vit dans
`src/lib/diagnostic.ts`, tenue par `tests/diagnostic.test.ts`.

Une coche verte pour une simple configuration serait un mensonge utile à
personne : sur un téléphone sans réseau, elle laisserait croire que l'école n'a
rien publié.

### La séparation de l'agenda

L'onglet Agenda a deux listes, « À venir » et « Passés ». Un événement commencé
n'est pas un événement passé : une sortie scolaire de la journée, et une réunion
de 18 h quand le parent ouvre l'application à 19 h, doivent rester dans
« À venir » — là où il les cherche.

Les deux listes étaient pourtant bornées par l'instant courant, si bien que tout
ce qui avait commencé basculait dans « Passés » : atténué, et sans la pastille
« En ce moment », qui se lit dans la carte et donc dans la liste.

Deux règles le tiennent maintenant :

- la **borne** est le premier instant du jour (`debutDuJour`), et les deux listes
  la partagent — `gte` d'un côté, `lt` de l'autre, ce qui interdit aussi bien le
  trou que le recouvrement ;
- le **repère de fin** d'un événement « journée entière » sans heure de fin est
  la fin de son jour, et non son début : sans cela, « toute la journée » ne veut
  rien dire, et la sortie scolaire s'affichait atténuée le jour même.

`tests/agenda-separation.test.ts` relit le filtre tel qu'il est écrit dans
`src/services/agenda.ts`, vérifie qu'il partitionne les instants, et exige
l'accord entre le marquage et la liste où il s'affiche.

### La semaine de la cantine

L'écran de la cantine ouvre sur une semaine, et sur une seule : un parent y
répond à « qu'est-ce qu'il mange demain ? », une question qui se pose la veille.

La semaine ouverte est celle du **lendemain**, et non celle d'aujourd'hui. La
différence ne se voit qu'un jour sur sept — le dimanche, où la semaine qui se
termine n'a plus un seul jour d'école devant elle. Ce jour-là, l'écran ouvrait
sur sept cartes dont six déjà atténuées, et la semaine que le parent venait
préparer se trouvait derrière la flèche « suivante », sans que rien ne le dise.

Prendre la semaine du lendemain rend la promesse vraie par construction : la
semaine qui contient demain contient demain, quel que soit le jour. Les six
autres jours, le lendemain est déjà dans la semaine, donc rien ne bouge.
`semaineDeCantine` porte la règle, tenue par `tests/cantine-semaine.test.ts`.

### Le vote ne se rejoue pas

La base n'enregistre qu'un vote par appareil et par sondage : `voter()` fait
`on conflict (sondage_id, votant_id) do nothing`, et rend `false` quand la ligne
existait déjà. Ce n'est pas un échec — la fonction est idempotente, ce qui
protège aussi une requête rejouée sur une connexion qui vacille — mais c'est une
information, et l'écran ne la lisait pas.

Un parent qui avait voté A et touchait B voyait donc B mis en avant, avec la
phrase « Votre réponse est enregistrée. », alors que la base gardait A. Le
décompte affiché, lui, venait bien de la base, et ne comptait pas ce vote : un
seul appui suffisait à atteindre ce parcours.

Deux réparations, qui vont dans le même sens :

- `voteARetenir` porte la règle : c'est la réponse de la base, jamais le choix
  touché, qui décide de ce que l'appareil retient. Un refus laisse une trace
  distincte — `CHOIX_INCONNU` — parce que l'application ne peut pas savoir quel
  choix la base détient : la table des votes est fermée en lecture ;
- les choix deviennent inactifs dès qu'un vote est connu, ce qui rend la
  promesse vraie par construction plutôt que de la corriger après coup.

Quand seul le vote est connu, et non le choix, les résultats s'affichent quand
même et la mention le dit : « Un vote a déjà été enregistré depuis cet
appareil. » Ce cas ne vient pas d'une réinstallation — l'identifiant de votant
disparaît en même temps que la mémoire locale, et la base accepte le vote suivant
— mais de la perte de la seule mémoire locale, ou de l'échec de son écriture.

`tests/vote-retenu.test.ts` tient les deux bouts : la règle, exécutée, et la
forme des appels dans `plus.tsx` et `SondageCard.tsx`, relue sur les sources
privées de leurs commentaires — sans quoi une phrase de commentaire suffirait à
satisfaire le contrôle.

### Les index et les requêtes

La section « Index » de la migration promet que chaque index correspond à une
requête réellement écrite. La promesse était inexacte, et rien ne la tenait.

Inexacte, parce que trois des sept index servent des requêtes écrites **dans la
migration elle-même** — `sondage_resultats()` et `envoyer_message()` lisent des
tables que la clé publique ne peut pas atteindre. Un lecteur qui aurait cherché
leurs usages dans `src/services/` en aurait conclu qu'ils étaient inutiles.

Non tenue, parce qu'un `.order` modifié d'un côté seulement — ou un sens inversé
dans l'index — laissait la requête sans index sans que rien ne le signale.
L'application continue de fonctionner, simplement plus lentement, et personne ne
relit un index.

`tests/index-et-requetes.test.ts` relit les index déclarés — colonnes **et**
sens — et exige qu'une requête les emploie : un tri de `src/services/` dont les
colonnes et les sens coïncident exactement, sinon un filtre, sinon une fonction de
la migration. La liste des index attendus y est **fermée** : en ajouter un fait
échouer le banc tant qu'il n'y est pas inscrit, avec la requête qui l'emploie.

Le banc ne prouve pas que PostgreSQL emploie l'index — le planificateur décide, et
seul un `explain analyze` sur la base réelle le dirait. Il tient l'accord entre ce
qui est déclaré et ce qui est écrit, qui en est la condition nécessaire.

Un index reste redondant, et c'est écrit dans la migration :
`sondage_votes_sondage_idx` porte `sondage_id`, qui est le préfixe de l'index
unique `sondage_votes_unique (sondage_id, votant_id)`. Il est laissé en place
parce que la migration est appliquée et n'est pas rejouable.

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

> **Avant toute mise à disposition**, remplir l'objet `RESPONSABLE` en tête de
> `app/confidentialite.tsx` : nom de l'association, adresse du siège et adresse
> de contact. Ces informations figurent dans les statuts. La page bascule
> d'elle-même de l'avertissement vers les coordonnées dès que les trois valeurs
> sont renseignées.

Le champ « adresse e-mail pour la réponse » du formulaire de contact est
facultatif. Mais lorsqu'il est renseigné, la base impose une forme plausible, et
le formulaire applique **la même règle** — recopiée du schéma, et tenue par
`tests/adresse-reponse.test.ts`. La recopier plus strictement serait un défaut
symétrique, et moins visible : un parent verrait « adresse invalide » sur une
adresse valide.
