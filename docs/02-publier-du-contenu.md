# Publier du contenu

Tout se fait depuis le **tableau de bord Supabase**, section **Table Editor**.
Il n'y a pas d'interface d'administration à apprendre : chaque table correspond
à une rubrique de l'application.

> **L'adresse du tableau de bord** — le projet s'appelle `parents-simple-cli` :
> <https://supabase.com/dashboard/project/toksjxrrgvgovbolcjvr>
> L'éditeur SQL directement :
> <https://supabase.com/dashboard/project/toksjxrrgvgovbolcjvr/sql/new>

> **À ne pas confondre** avec `https://toksjxrrgvgovbolcjvr.supabase.co`, qui est
> l'adresse de l'**API** — celle que porte l'application pour lire les données.
> L'ouvrir dans un navigateur répond `{"error":"requested path is invalid"}` :
> c'est normal, la racine de l'API n'expose aucune page à consulter. Ce message
> prouve même l'inverse de ce qu'il a l'air de dire — le projet répond.

> Après chaque ajout ou modification, appuyer sur **Save**. La table est mise à
> jour immédiatement, et les téléphones la voient au prochain chargement de
> l'écran concerné — il suffit de tirer vers le bas sur l'écran Accueil.

---

## Pour essayer l'application avant de saisir le vrai contenu

Une base neuve est vide, et une application vide affiche cinq onglets vides :
impossible de distinguer « tout fonctionne, il n'y a rien à montrer » de
« quelque chose est cassé ».

[`supabase/exemple-contenu.sql`](../supabase/exemple-contenu.sql) remplit chaque
table de quelques lignes réalistes. À coller dans **SQL Editor** → **New query**,
puis **Run**. Il peut être relancé sans créer de doublon, et le bloc de nettoyage
à la fin — en commentaire — retire exactement ce qu'il a ajouté.

Il crée notamment **un sondage ouvert**, ce qui permet d'éprouver le seul chemin
que les contrôles automatiques ne couvrent pas : voter. Un `voter` cassé ne se
manifesterait nulle part ailleurs.

Ce n'est **pas** une migration : il n'est pas dans `supabase/migrations/`, et
`npm run sql:check` ne le lit pas. Il ne s'applique jamais tout seul.

> Les deux documents qu'il insère décrivent des fichiers PDF qui n'existent pas
> encore dans l'espace de stockage : la liste s'affichera, mais ouvrir un
> document échouera — avec un message, pas un écran vide. Pour que les liens
> fonctionnent, déposer les fichiers dans le compartiment `documents` sous le nom
> exact donné par `storage_path`.

---

## Actualités — table `annonces`

Onglet **Accueil**.

| Colonne      | À remplir                                                |
| ------------ | -------------------------------------------------------- |
| `titre`      | Le titre, 160 caractères au maximum                      |
| `corps`      | Le texte complet. Les retours à la ligne sont conservés  |
| `epinglee`   | `true` pour garder l'actualité en tête du fil            |
| `publiee_le` | Laisser vide : la date du jour est posée automatiquement |

**Quand épingler ?** Pour une information qui concerne tout le monde
aujourd'hui — fermeture d'école, grève de cantine, changement d'horaires. Une
actualité épinglée reste en tête du fil quel que soit son âge, et porte la
mention « Important ». En abuser vide le procédé de son sens : ne pas dépasser
une ou deux à la fois.

---

## Menus de cantine — table `cantine_menus`

Onglet **Cantine**. **Une ligne par jour de service.**

| Colonne        | À remplir                                                  |
| -------------- | ---------------------------------------------------------- |
| `service_date` | Le jour, au format `AAAA-MM-JJ` — par exemple `2026-09-22` |
| `entree`       | Facultatif                                                 |
| `plat`         | Facultatif                                                 |
| `dessert`      | Facultatif                                                 |
| `allergenes`   | Liste, à saisir entre accolades : `{"gluten","lait"}`      |
| `notes`        | Facultatif — par exemple « repas froid, sortie scolaire »  |

Deux points d'attention :

- **la date est un jour civil, sans heure.** Saisir `2026-09-22` et non
  `2026-09-22T12:00:00` : un instant serait réinterprété selon le fuseau du
  téléphone, et le menu pourrait apparaître la veille chez certains parents ;
- **une seule ligne par jour.** La base refuse un second menu pour la même
  date, ce qui évite deux affichages contradictoires.

Renseigner les menus la semaine précédente est le rythme le plus confortable
pour les familles. Un jour sans ligne affiche « Pas de cantine ce jour-là » —
il n'y a donc rien à saisir pour les mercredis, samedis et dimanches.

---

## Agenda — table `agenda_events`

Onglet **Agenda**.

| Colonne           | À remplir                                                  |
| ----------------- | ---------------------------------------------------------- |
| `titre`           | 160 caractères au maximum                                  |
| `debut_le`        | Date **et** heure, par exemple `2026-09-22T18:30:00+02:00` |
| `fin_le`          | Facultatif. Laisser vide si l'heure de fin est inconnue    |
| `lieu`            | Facultatif — « Salle polyvalente », « Cour de l'école »    |
| `description`     | Facultatif — ordre du jour, informations pratiques         |
| `journee_entiere` | `true` pour un événement sans heure — vacances, jour férié |

**Le fuseau horaire compte.** Écrire `2026-09-22T18:30:00+02:00` plutôt que
`2026-09-22T18:30:00` : sans indication de fuseau, la base interprète l'heure
comme UTC, et la réunion de 18 h 30 s'afficherait à 20 h 30.

Un événement apparaît dans « À venir » tant que son début n'est pas passé. Il
bascule ensuite dans « Passés », où il reste consultable.

---

## Documents — table `documents` et espace de stockage

Onglet **Plus** → **Documents importants**.

Un document se publie en **deux étapes**, dans cet ordre.

### 1. Déposer le fichier

Tableau de bord → **Storage** → compartiment `documents` → **Upload file**.

Le compartiment est **public en lecture** : un parent doit pouvoir ouvrir un PDF
sans compte. Cela suppose que **aucun document nominatif n'y soit déposé** — pas
de facture, pas de bulletin, pas de liste d'élèves avec des noms. Ces documents
se transmettent par un autre canal.

Formats acceptés : PDF, JPEG, PNG, WebP. Taille maximale : 20 Mo.

### 2. Décrire le document

Table Editor → table `documents` → **Insert row** :

| Colonne         | À remplir                                                       |
| --------------- | --------------------------------------------------------------- |
| `titre`         | Tel qu'il apparaîtra dans la liste                              |
| `description`   | Facultatif — une phrase qui dit à quoi le document sert         |
| `categorie`     | `administratif`, `scolarite`, `cantine`, `activites` ou `autre` |
| `storage_path`  | Le nom du fichier déposé à l'étape 1, **tel quel**              |
| `taille_octets` | Facultatif — affiché pour prévenir d'un gros téléchargement     |

> `storage_path` doit correspondre exactement au nom du fichier dans le
> compartiment, extension comprise. C'est la seule erreur possible ici, et elle
> se manifeste par un téléchargement qui échoue.

---

## Sondages — tables `sondages` et `sondage_choix`

Onglet **Plus**.

### 1. Créer le sondage

Table `sondages` → **Insert row** :

| Colonne      | À remplir                                                                      |
| ------------ | ------------------------------------------------------------------------------ |
| `question`   | La question posée, 300 caractères au maximum                                   |
| `precisions` | Facultatif — une phrase de contexte                                            |
| `ouvert`     | `true` (valeur par défaut)                                                     |
| `cloture_le` | Facultatif. Sans valeur, le sondage reste ouvert jusqu'à sa fermeture manuelle |

### 2. Ajouter les réponses

Table `sondage_choix` → **Insert row**, une ligne par réponse :

| Colonne      | À remplir                                         |
| ------------ | ------------------------------------------------- |
| `sondage_id` | Copier l'`id` du sondage créé à l'étape 1         |
| `libelle`    | Le texte de la réponse, 200 caractères au maximum |
| `position`   | L'ordre d'affichage : `0`, `1`, `2`…              |

L'ordre d'affichage suit `position`. Sans elle, les réponses pourraient changer
de place entre deux ouvertures de l'écran.

### 3. Suivre les résultats

Table `sondage_votes` : **la table est volontairement inaccessible depuis
l'application**, mais vous pouvez la consulter depuis le tableau de bord, qui
utilise la clé `service_role`.

Pour un décompte lisible, exécuter dans l'éditeur SQL :

```sql
select c.libelle, count(v.id) as voix
  from public.sondage_choix c
  left join public.sondage_votes v on v.choix_id = c.id
 where c.sondage_id = '<identifiant-du-sondage>'
 group by c.libelle, c.position
 order by c.position;
```

### Ce qu'un sondage ne peut pas faire

Un parent peut voter une seconde fois en désinstallant puis réinstallant
l'application : l'identifiant qui limite le double vote est conservé sur
l'appareil, et disparaît avec lui.

C'est une limite assumée. L'alternative serait d'exiger un compte, ce qui a été
écarté. Pour un sondage d'école, décourager le double vote accidentel suffit ;
le résultat n'a pas de portée au point qu'il faille se protéger d'un adversaire.

---

## Lire les messages — table `messages`

Onglet **Contact**. Les messages arrivent dans la table `messages`, **que
personne ne peut lire depuis l'application** — c'est ce qui garantit qu'un
parent ne peut pas lire ce qu'un autre a écrit.

Table Editor → table `messages`, trier sur `created_at` décroissant.

| Colonne     | Signification                                                             |
| ----------- | ------------------------------------------------------------------------- |
| `sujet`     | L'objet du message                                                        |
| `corps`     | Le texte                                                                  |
| `categorie` | La rubrique choisie par le parent                                         |
| `reponse_a` | L'adresse à laquelle répondre, **ou vide** si le parent n'en a pas laissé |
| `traite`    | À cocher une fois le message traité                                       |

Deux remarques pratiques :

- un message **sans `reponse_a` ne peut pas recevoir de réponse**. C'est un
  choix laissé au parent, rappelé dans le formulaire ;
- un parent peut envoyer **trois messages par quart d'heure**. Au-delà, la base
  refuse et l'application l'explique. Ce plafond est là pour arrêter une
  inondation automatique, pas pour limiter un usage normal.

Penser à vider régulièrement les messages traités : ce sont les seules données
personnelles que l'application conserve.
