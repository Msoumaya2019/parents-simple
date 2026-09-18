# Administrer l'application depuis une page web

Le bureau publie les annonces, les menus de cantine, l'agenda et les documents
depuis une page web, plutôt que depuis le tableau de bord Supabase. Cette page
est dans `admin/`.

Elle ne coûte rien, ne demande aucun serveur, et **n'a aucun pouvoir propre** :
tout ce qu'une personne peut y faire est décidé par les politiques de
`supabase/migrations/`, jamais par le code de la page. Réécrire la page ne
changerait donc rien à ce qui est permis — c'est ce qui rend acceptable qu'elle
soit publiquement accessible.

---

## 1. Avant tout : appliquer la migration

La page ne peut rien écrire tant que la migration n'est pas appliquée.

1. Ouvrir le tableau de bord Supabase du projet, puis **SQL Editor**.
2. Coller le contenu entier de
   `supabase/migrations/20260918001000_membres_bureau.sql`.
3. Exécuter.

Ou, en ligne de commande, par le **même point d'entrée** que l'éditeur SQL — donc
sans projet lié, et sans `db push` qui comparerait au dépôt distant :

```bash
npx supabase login   # une seule fois : dépose un jeton dans ~/.supabase/
node scripts/appliquer-migration.mjs supabase/migrations/20260918001000_membres_bureau.sql
```

Les chemins se lisent **depuis la racine du dépôt**. L'outil n'écrit aucun jeton :
il le lit de `SUPABASE_ACCESS_TOKEN` ou du fichier déposé par `npx supabase login`,
n'affiche que sa longueur, et refuse de partir si sa forme n'est pas `sbp_…`. Il lit
la référence du projet dans `.env.local`, jamais en dur.

Dans les deux cas, ce qui prouve que la migration est appliquée n'est pas le
`200` de l'éditeur — qui répond aussi pour un lot vide — mais les deux contrôles
qui interrogent la base réelle : `npm run securite:api` puis
`npm run verifier:requetes`.

La migration est **rejouable** : `create table if not exists`, et un
`drop policy if exists` devant chaque `create policy`. Si une exécution échoue
au milieu — l'éditeur s'arrête à la première erreur —, il suffit donc de la
relancer entièrement, sans chercher où reprendre. C'est délibéré : appliquée à
la main, sans historique de migration, elle serait sinon dans un état que rien
ne permettrait de rattraper.

Ce que cette migration ajoute, et pourquoi :

- une table `membres_bureau`, la **liste nominative** des personnes autorisées ;
- une fonction `est_membre_bureau()`, appelée par toutes les politiques
  d'écriture **et** par la page elle-même — l'écran et la base ne peuvent donc
  pas être en désaccord ;
- les droits et les politiques d'écriture pour le seul rôle `authenticated`.

### Le point qu'il ne faut pas manquer

Accorder l'écriture au rôle `authenticated` ne suffit pas, et ce serait même une
faille : Supabase autorise par défaut l'inscription publique. N'importe qui
pourrait créer un compte, devenir `authenticated`, et publier sur l'application
de l'école.

C'est la **liste** qui fait autorité. Une personne connectée qui n'y figure pas
n'écrit rien, quoi qu'affiche son écran.

### Vérifier que la migration est bien passée

```
npm run securite:api
```

Attendu : **28/28**. Avant la migration, ce contrôle dit 27/28 et nomme
`membres_bureau : lecture refusée` — parce que la table répond `404`, donc
qu'elle n'existe pas. C'est le seul contrôle qui distingue « fermé » de
« absent », et c'est pour cela qu'il faut le lancer après chaque migration.

> **Tant que la migration n'est pas appliquée, les compilations s'arrêtent.**
> Ce contrôle tourne dans les trois flux de travail, dont les deux qui
> produisent l'IPA et l'APK, **avant** de compiler. Une compilation lancée avant
> d'appliquer la migration échoue donc sur cette étape, en une minute, avec
> `Could not find the table 'public.membres_bureau'`.
>
> C'est voulu, et c'est cohérent : un contrôle qui ne peut rien affirmer doit
> échouer plutôt que passer. La table absente ne prouve pas qu'elle est fermée.
> Les binaires déjà produits, eux, ne sont pas concernés — ils ont été compilés
> avant.

---

## 2. Fermer l'inscription publique

Tableau de bord → **Authentication** → **Sign In / Providers** → désactiver
**« Allow new users to sign up »**.

C'est le second verrou, et il est indépendant du premier. La liste des membres
suffit déjà à empêcher toute écriture ; fermer l'inscription supprime en plus la
possibilité de créer un compte. On garde les deux : si quelqu'un rallume
l'inscription un jour, la liste tient toujours.

---

## 3. Créer les comptes du bureau

Il n'y a **pas d'écran d'inscription** dans la page, et c'est délibéré : une
page d'administration qui laisserait créer un compte serait une page qui laisse
entrer n'importe qui.

Pour chaque personne du bureau :

1. Tableau de bord → **Authentication** → **Users** → **Add user**.
2. Renseigner l'adresse et un mot de passe.
3. Cocher **« Auto Confirm User »** — sans quoi le compte ne peut pas se
   connecter, et le message d'erreur parle de courriel non confirmé.
4. Puis, dans le **SQL Editor**, l'inscrire dans la liste :

```sql
select public.ajouter_membre_bureau('tresorier@exemple.fr');
```

La fonction répond `ajouté`, ou `déjà membre` si la personne y était. Elle
refuse avec un message explicite si aucun compte ne porte cette adresse — le cas
courant étant d'avoir sauté l'étape 3.

**Retirer quelqu'un** — un départ, une erreur :

```sql
delete from public.membres_bureau where courriel = 'tresorier@exemple.fr';
```

L'accès est retiré immédiatement. Le compte Supabase, lui, subsiste ; le
supprimer depuis **Authentication → Users** est un geste séparé, à faire si la
personne quitte définitivement l'école.

### Ce qu'une personne du bureau ne peut pas faire

S'ajouter une collègue. `ajouter_membre_bureau` n'est accordée à aucun rôle
d'application : seul le tableau de bord peut l'appeler. C'est volontaire — la
liste des personnes qui peuvent publier sur l'application de l'école ne se
modifie pas depuis la page.

---

## 4. Déployer la page

### Sur Vercel

1. Importer le dépôt GitHub dans Vercel.
2. **Root Directory** : `admin`. C'est le réglage à ne pas oublier — sans lui,
   Vercel cherche une application à la racine et ne trouve que l'application
   mobile.
3. Vercel détecte Vite seul. Laisser la commande de construction
   (`npm run build`) et le dossier de sortie (`dist`).
4. Renseigner deux variables d'environnement :

   | Nom                             | Valeur                                         |
   | ------------------------------- | ---------------------------------------------- |
   | `VITE_SUPABASE_URL`             | `https://toksjxrrgvgovbolcjvr.supabase.co`     |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | la clé **publishable** (ou « anon ») du projet |

   La clé se trouve dans **Settings → API Keys**. C'est la même valeur que
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans l'application mobile.

5. Déployer.

> **Ne jamais mettre la clé secrète ici.** Ni `sb_secret_…`, ni un JWT portant
> `role: service_role`, ni un jeton `sbp_…`. La page refuse de démarrer si on
> lui en fournit une, et affiche une phrase qui le dit — mais le refus est un
> filet, pas une raison de les copier.
>
> Le plan gratuit de Vercel est réservé à un usage **non commercial**. C'est le
> cas ici : la page ne vend rien et n'affiche aucune publicité. Le jour où
> l'association encaisserait quelque chose par ce biais, il faudrait en changer.

### Ou sans compte supplémentaire, sur GitHub Pages

La page est un ensemble de fichiers statiques : elle se dépose n'importe où.
`base: './'` dans `vite.config.ts` fait que les chemins sont relatifs, donc le
dossier fonctionne aussi bien à la racine d'un domaine que dans un sous-dossier.

```
npm run admin:install
npm --prefix admin run build
```

Puis publier `admin/dist/`. Le dépôt étant public, GitHub Pages suffit et évite
d'ouvrir un compte de plus.

### Essayer en local

```
npm run admin:install
```

Créer `admin/.env.local` avec les deux mêmes variables, puis :

```
npm run admin:dev
```

Ce fichier est ignoré par git.

> **Pourquoi `admin:install` passe par un `cd`.** Le script fait
> `cd admin && npm install`, et non `npm --prefix admin install`. Les deux formes
> n'ont pas le même effet, et l'écart a été mesuré : la seconde **réécrit**
> `admin/package.json`. Elle y remettait une dépendance morte — `file:..`, vers la
> racine du dépôt, qu'aucun `import` n'appelle — à chaque exécution. Le
> `git status` l'aurait montrée modifiée après chaque `npm run verify`, sans que
> personne ne l'ait ajoutée. `admin:check` refuse désormais cette dépendance, mais
> la cause est traitée : c'est la forme du script qui la faisait revenir.
>
> Le flux d'intégration continue, lui, emploie `npm --prefix admin ci` sans
> inconvénient : **`npm ci` ne réécrit jamais un manifeste**, ni `package.json`, ni
> un verrou. C'est la différence entre `install` et `ci`, et elle compte ici.

---

## 5. Le risque à connaître : la mise en pause

Le plan gratuit de Supabase **met le projet en pause après sept jours de faible
activité**. Et la pause ne coupe pas seulement la page d'administration : elle
coupe aussi la **lecture**. Pendant une pause, les parents voient des écrans
vides.

Ce n'est donc pas un problème de bureau, c'est un problème d'application.

- **Ce qui suffit à l'éviter** : quelques requêtes par jour. Une école en
  activité en produit bien plus.
- **Le vrai moment à risque** : les vacances d'été, où plus personne ne consulte
  rien pendant plusieurs semaines.
- **L'avertissement** : Supabase envoie un courriel environ une semaine avant la
  pause. C'est le signal à ne pas laisser passer — ouvrir le tableau de bord
  suffit à écarter la pause.
- **La reprise** est **manuelle** : tableau de bord → **Resume project**. Les
  données sont conservées, et la fenêtre pour reprendre est d'un an.
- **Pour ne plus y penser** : le plan payant supprime la mise en pause. C'est la
  seule façon de ne dépendre d'aucune vigilance.

---

## 6. Éprouver que rien n'a été ouvert

```
npm run securite:api
```

Ce contrôle interroge la base avec **la clé publique**, celle qui est extraite
d'un APK par n'importe qui, et vérifie que :

- le contenu publié reste lisible ;
- `messages`, `sondage_votes` et `membres_bureau` restent illisibles ;
- **aucune** écriture directe n'est possible, ni dans les tables ni dans les deux
  compartiments de stockage ;
- `est_membre_bureau` et `ajouter_membre_bureau` ne sont pas exposées.

**Ce qu'il ne peut pas voir, et qui compte désormais.** Il se sert de la clé
publique, donc il n'est jamais une personne connectée : une politique d'écriture
visant `authenticated` lui est **invisible**. Or c'est par là que passe le risque
depuis que cette page existe — Supabase ouvre l'inscription publique par défaut,
si bien que `authenticated` s'obtient en s'inscrivant, et le rôle ne dit pas qui
est la personne. La condition d'appartenance portée par chaque politique
d'écriture est donc tenue par `npm run sql:check`, qui lit les politiques une par
une. Les deux contrôles sont complémentaires, et aucun ne remplace l'autre : un
vert de celui-ci ne dit rien de celles-là.

C'est le contrôle à relancer après toute modification des politiques, et il
tourne dans les trois flux d'intégration continue.

---

## 7. Tenir la page et le schéma d'accord

```
npm run admin:check
```

Cette page nomme en clair des choses que la base décide : les tables qu'elle
appelle, les colonnes de ses `select`, les bornes de ses champs, les valeurs de
ses listes déroulantes, les compartiments où elle dépose des fichiers. Rien ne
les relie automatiquement, et le plus coûteux de ces écarts ne se voit nulle
part : le client Supabase déduit le type d'une ligne de la **table**, jamais de
la chaîne passée à `select`. Une colonne mal orthographiée traverse donc `tsc`,
`eslint` et la construction, et n'échoue qu'à l'exécution — devant le bureau, au
moment précis où il croit avoir publié.

Le contrôle **ferme** ces ensembles au lieu de les survoler : une contrainte
bornée ajoutée à une migration, ou une cinquième table appelée par la page, le
fait échouer tant qu'elle n'a pas été prise en compte délibérément. Il ne demande
aucun secret, ne touche pas la base, et tourne dans l'intégration continue avant
la construction de l'administration.

### Ce qu'il ne tient pas

La liste des formats de fichier acceptés vit à **trois** endroits : les deux
listes d'extensions de `admin/src/lib/contenu.ts`, l'attribut `accept` des champs
de fichier dans les écrans, et `allowed_mime_types` dans la migration. Ce
désaccord-là n'est pas muet — la page refuse le fichier avec une phrase en
français, ou le stockage le refuse avec un message que l'écran affiche — et il
n'est donc pas contrôlé. Une modification de la migration doit être reportée à la
main dans les deux autres endroits.

---

## 8. Ce que la page ne fait pas

- **Les messages des parents.** Ils se lisent dans le tableau de bord, table
  `messages`. Les ouvrir à la page serait possible, mais ce sont des données de
  parents, pas du contenu publié — la décision n'a pas été prise.
- **Les sondages.** Les tables sont ouvertes en écriture au bureau, mais aucun
  écran ne les gère : créer un sondage et ses réponses demande un formulaire
  imbriqué, qui n'a pas été écrit.
- **La liste des membres.** Elle se consulte dans le tableau de bord. Elle n'est
  lisible par personne via l'API, pas même par ses propres membres.

### Un point à trancher, pas à laisser dériver

`supabase/exemple-contenu.sql` reste utilisable et **rejouable** : il met à jour
les lignes par identifiant au lieu de les dupliquer. C'est pratique pour
remettre un jeu d'essai. Mais dès que le bureau publie par la page, ce fichier
devient une **seconde façon d'écrire les mêmes tables**. Il faut choisir : le
garder comme jeu d'essai assumé, ou le retirer. Ce qui serait fâcheux est de
laisser les deux vivre sans le dire.
