# Administrer l'application depuis une page web

Le bureau publie les annonces, les menus de cantine, l'agenda et les documents —
et lit les messages que des parents lui ont adressés — depuis une page web,
plutôt que depuis le tableau de bord Supabase. Cette page est dans `admin/`.

Elle ne coûte rien, ne demande aucun serveur, et **n'a aucun pouvoir propre** :
tout ce qu'une personne peut y faire est décidé par les politiques de
`supabase/migrations/`, jamais par le code de la page. Réécrire la page ne
changerait donc rien à ce qui est permis — c'est ce qui rend acceptable qu'elle
soit publiquement accessible.

---

## 1. Avant tout : appliquer les migrations

> **État au 20 septembre 2026 : c'est fait.** Les quatre migrations sont
> appliquées, et les deux contrôles qui interrogent la base réelle sont verts —
> `securite:api` **28/28**, `verifier:requetes` **11/11**. Il n'y a donc rien à
> faire dans cette section ; elle reste pour le jour où le schéma sera remis en
> place, ou pour comprendre ce que la migration apporte.

La page ne peut rien écrire tant que la première migration n'est pas appliquée,
et son onglet **Messages** ne peut rien lire tant que la seconde ne l'est pas.

1. Ouvrir le tableau de bord Supabase du projet, puis **SQL Editor**.
2. Coller le contenu entier de
   `supabase/migrations/20260918001000_membres_bureau.sql`, puis exécuter.
3. Coller ensuite le contenu entier de
   `supabase/migrations/20260919140000_messages_bureau.sql`, puis exécuter.

L'ordre compte : la seconde migration appelle `public.est_membre_bureau()`, que
la première crée. L'inverse échoue à la première politique.

Ou, en ligne de commande, par le **même point d'entrée** que l'éditeur SQL — donc
sans projet lié, et sans `db push` qui comparerait au dépôt distant :

```bash
npx supabase login   # une seule fois : dépose un jeton dans ~/.supabase/
node scripts/appliquer-migration.mjs supabase/migrations/20260918001000_membres_bureau.sql
node scripts/appliquer-migration.mjs supabase/migrations/20260919140000_messages_bureau.sql
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

> **Un 27/28 ne dit pas toujours la même chose.** Tant que la table manque, la
> ligne en échec est `membres_bureau : lecture refusée`. Une fois la migration
> appliquée, elle doit disparaître. Si une **autre** ligne reste rouge, le défaut
> est dans le contrôle, pas dans la base — mesuré : `est_membre_bureau` répondait
> **401** là où le contrôle attendait 404, parce que PostgREST met au cache toute
> fonction accordée à au moins un rôle et refuse ensuite l'appelant. Le 404 n'est
> rendu que pour une fonction que **personne** ne peut exécuter. C'est corrigé, et
> `tests/accord-fonctions-exposees.test.mjs` tient l'accord entre les deux listes
> du contrôle et les `revoke` / `grant` des migrations.

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

### Ou sans compte supplémentaire, sur GitHub Pages — déjà en place

**Rien à faire : c'est publié automatiquement.**

```
https://msoumaya2019.github.io/parents-simple/
```

Le flux `.github/workflows/admin-pages.yml` construit `admin/` à chaque poussée
qui touche le dossier, vérifie la page produite, puis la publie. Les deux
variables lui viennent des secrets `SUPABASE_URL` et `SUPABASE_ANON_KEY`, déjà
présents pour l'intégration continue : aucun secret nouveau, et aucun compte à
ouvrir. Pour republier à la main, onglet **Actions** → _Mise à disposition de
l'administration_ → **Run workflow**.

Un site de projet GitHub Pages est servi dans un **sous-dossier** — ici
`/parents-simple/` — et non à la racine du domaine. C'est précisément le cas que
`base: './'` rend possible, et celui qui aurait échoué avant qu'on s'aperçoive
que la clé `base` avait disparu de `vite.config.ts` : la page aurait demandé
`https://msoumaya2019.github.io/assets/…`, qui n'existe pas.

> La publication ne fait que rendre la page **joignable**. Elle ne peut rien
> écrire tant que la migration n'est pas appliquée, et rien de plus ensuite que
> ce que les politiques de la base autorisent : la page n'a aucun pouvoir propre.

Pour publier ailleurs — un domaine de l'association, par exemple — la page est un
ensemble de fichiers statiques qui se dépose n'importe où :

```
npm run admin:install
npm --prefix admin run build
```

Puis déposer `admin/dist/`.

### Le contrôle qui tient cette promesse

```
npm run admin:page
```

Il lit `admin/dist/index.html` — le fichier qui part chez l'hébergeur — et refuse
toute ressource référencée depuis la racine du domaine, ainsi qu'une page qui
aurait perdu son script ou sa feuille de style. `npm run admin:verify` l'enchaîne
après la construction, et échoue si la page n'a pas été construite plutôt que de
parcourir une liste vide.

Il existe parce que la promesse ci-dessus a été **fausse** pendant un temps : le
commentaire de `vite.config.ts` décrivait `base: './'`, mais la clé n'existait
plus. Vite prenait donc sa valeur par défaut, `/`, et la page n'aurait fonctionné
qu'à la racine d'un domaine — sans que rien ne le signale. Une intention écrite
n'est pas un réglage, et rien dans le langage ne relie les deux.

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
bornée ajoutée à une migration, ou une table appelée par la page et non déclarée,
le fait échouer tant qu'elle n'a pas été prise en compte délibérément. Il ne
demande aucun secret, ne touche pas la base, et tourne dans l'intégration
continue avant la construction de l'administration.

**Une seule table est exemptée de bornes : `messages`**, et l'exemption est
écrite avec son motif, en toutes lettres, dans `scripts/check-admin.mjs`. La page
y lit et coche « traité » ; elle n'écrit ni le sujet ni le corps, qui sont
déposés par `envoyer_message()`. Les deux bornes de cette table sont tenues par
l'écran de contact, et le contrôle **exige** que `scripts/check-sql.mjs` les
nomme — une exemption que personne ne rattrape serait le trou par lequel le
défaut rentre.

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

- **Supprimer un message.** L'onglet **Messages** les lit et les marque
  « traités ». La suppression reste un geste du tableau de bord, table
  `messages` : elle est irréversible, et un bouton voisin d'une case à cocher se
  clique de travers. C'est aussi ce qui tient la promesse de la page de
  confidentialité — les messages traités sont supprimés, mais par une personne
  qui l'a décidé.
- **Répondre à un message.** La page affiche l'adresse que le parent a laissée,
  et un lien qui ouvre le logiciel de messagerie. Le bureau répond depuis sa
  propre boîte ; rien n'est envoyé depuis l'application. Un message **sans
  adresse** ne peut pas recevoir de réponse, et l'écran le dit au lieu de laisser
  croire l'inverse.
- **Les sondages.** Les tables sont ouvertes en écriture au bureau, mais aucun
  écran ne les gère : créer un sondage et ses réponses demande un formulaire
  imbriqué, qui n'a pas été écrit.
- **La liste des membres.** Elle se consulte dans le tableau de bord. Elle n'est
  lisible par personne via l'API, pas même par ses propres membres.

### Ce que l'onglet Messages a demandé, et qu'il faut savoir

Cet onglet **n'existait pas** au départ, et son absence était cohérente : la
table `messages` ne portait aucune politique, donc personne ne pouvait la lire
par l'API, et le seul chemin était le tableau de bord. Mais ce chemin coûte un
**compte ayant accès au projet** — qui peut aussi modifier le schéma, lire
toutes les autres tables et changer les politiques. Lire un message de parent
demandait donc bien plus que le nécessaire.

Une seconde migration, `20260919140000_messages_bureau.sql`, ouvre une voie
étroite : le bureau lit avec son compte du bureau. Elle doit être **appliquée à
la main**, comme la première, et l'onglet échoue tant que ce n'est pas fait —
avec un message qui le dit, plutôt qu'un message de Postgres parlant de relation
inexistante.
Ce que la migration ne fait pas, et c'est délibéré : ni `insert` (c'est
`envoyer_message()`, appelée par le téléphone du parent), ni `delete`. Et la clé
publique ne lit toujours rien — la table reste dans la liste des tables fermées
que `npm run securite:api` sonde.

### Un point à trancher, pas à laisser dériver

`supabase/exemple-contenu.sql` reste utilisable et **rejouable** : il met à jour
les lignes par identifiant au lieu de les dupliquer. C'est pratique pour
remettre un jeu d'essai. Mais dès que le bureau publie par la page, ce fichier
devient une **seconde façon d'écrire les mêmes tables**. Il faut choisir : le
garder comme jeu d'essai assumé, ou le retirer. Ce qui serait fâcheux est de
laisser les deux vivre sans le dire.
