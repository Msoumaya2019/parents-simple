# Publier du contenu

Tout se fait depuis le **tableau de bord Supabase**, section **Table Editor**.
Il n'y a pas d'interface d'administration à apprendre : chaque table correspond
à une rubrique de l'application.

> **Une autre façon de publier existe désormais.** Le dépôt contient une page
> d'administration, dans `admin/`, qui donne des formulaires pour les annonces,
> les menus de cantine, l'agenda et les documents — avec l'envoi des images et
> des fichiers. Elle s'installe une fois, et son mode d'emploi est dans
> [`05-administration.md`](05-administration.md). Ce document-ci reste exact, et
> reste utile : c'est la voie directe, sans rien à déployer, et la seule qui
> donne accès aux messages des parents.

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
> jour immédiatement, mais les téléphones ne le savent pas tout seuls : les
> onglets ne se rechargent pas quand on les quitte et qu'on y revient. Pour voir
> le changement, **tirez vers le bas sur l'écran concerné** — celui de la cantine
> pour un menu, celui de l'agenda pour une date. Sans ce geste, il faut fermer et
> rouvrir l'application.

---

## En un coup d'œil

| Ce que vous voulez publier             | Où le faire                                     | Section                               |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| Un article, une information            | Table `annonces`                                | Actualités                            |
| Une photo sur un article               | Storage, compartiment `annonces`                | L'illustration                        |
| Un document à télécharger              | Storage `documents`, **puis** table `documents` | Documents                             |
| La photo de l'école, en tête d'accueil | `assets/banniere-ecole.jpg`, puis recompiler    | README, « Personnaliser la bannière » |
| Un menu de cantine                     | Table `cantine_menus`                           | Menus de cantine                      |
| Une date à retenir                     | Table `agenda_events`                           | Agenda                                |
| Un sondage                             | Tables `sondages` et `sondage_choix`            | Sondages                              |
| Lire les messages reçus                | Table `messages`                                | Lire les messages                     |

Deux règles valent pour tout ce qui suit :

- **la table `annonces` et la table `documents` ne sont pas la même chose.** Une
  actualité s'affiche dans le fil de l'accueil ; un document s'ouvre depuis
  l'onglet Plus, et son fichier vit dans un compartiment de stockage ;
- **un fichier déposé dans un compartiment ne s'affiche nulle part tout seul.**
  C'est la ligne de table qui le rend visible, et c'est elle qui porte le nom du
  fichier.

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
> document répondra « Ce document n'est plus disponible » — dans l'application,
> et non par une erreur brute du navigateur. Pour que les liens fonctionnent,
> déposer les fichiers dans le compartiment `documents` sous le nom exact donné
> par `storage_path`.

---

## Actualités — table `annonces`

Onglet **Accueil**. Chaque ligne devient une carte du fil.

| Colonne      | À remplir                                                                            |
| ------------ | ------------------------------------------------------------------------------------ |
| `titre`      | Le titre, 160 caractères au maximum                                                  |
| `corps`      | Le texte complet, 8 000 caractères au maximum. Les retours à la ligne sont conservés |
| `categorie`  | La rubrique : `actualite`, `cantine`, `agenda`, `a_venir` ou `association`           |
| `image_url`  | Facultatif — l'illustration de la carte (voir plus bas)                              |
| `epinglee`   | `true` pour garder l'actualité en tête du fil                                        |
| `publiee_le` | Laisser vide : la date du jour est posée automatiquement                             |

**Les deux limites de caractères sont refusées par la base, pas tronquées.**
Dépasser 160 caractères de titre, ou 8 000 de corps, fait échouer
l'enregistrement avec un message qui parle de contrainte et non de longueur. Le
tableau de bord affiche alors `new row for relation "annonces" violates check
constraint "annonces_titre_valide"` — c'est le signe qu'un des deux champs est
trop long. Pour un texte qui dépasse, couper en deux actualités vaut mieux
qu'un article que personne ne finit de lire.

**La première actualité reçoit une carte plus grande.** Le fil est trié par la
base — les épinglées d'abord, puis des plus récentes aux plus anciennes — et
c'est cette première ligne qui est mise en avant, avec son image à côté du
texte. Il n'y a pas de réglage à poser : épingler une actualité la fait passer
en avant, et publier une actualité sans en épingler aucune met la plus récente
en avant.

**Quand épingler ?** Pour une information qui concerne tout le monde
aujourd'hui — fermeture d'école, grève de cantine, changement d'horaires. Une
actualité épinglée reste en tête du fil quel que soit son âge, et porte la
mention « Important ». En abuser vide le procédé de son sens : ne pas dépasser
une ou deux à la fois.

### La catégorie

Elle s'affiche en pastille au-dessus du titre, avec sa couleur et son icône.
Elle ne change pas l'ordre du fil : c'est une indication pour le parent qui
balaie l'écran du regard, pas un classement.

| Valeur        | Affiché     | Pour quoi                             |
| ------------- | ----------- | ------------------------------------- |
| `actualite`   | Actualité   | La valeur par défaut                  |
| `cantine`     | Cantine     | Menus, changements de service         |
| `agenda`      | Agenda      | Dates, réunions, sorties              |
| `a_venir`     | À venir     | Ce qui approche sans être encore daté |
| `association` | Association | La vie de l'association de parents    |

Une actualité **épinglée** affiche « Important » à la place de sa catégorie.
Deux pastilles côte à côte se liraient mal, et « Important » est alors
l'information la plus utile des deux.

### L'illustration

`image_url` accepte deux formes :

- **un nom de fichier** déposé dans le compartiment `annonces` — le cas normal,
  décrit ci-dessous ;
- **une adresse complète** commençant par `http`, si l'image est déjà hébergée
  ailleurs.

Pour déposer une image : Tableau de bord → **Storage** → compartiment `annonces`
→ **Upload file**. Formats acceptés : JPEG, PNG, WebP, AVIF. Taille maximale :
5 Mo.

Reste à dire à l'actualité quelle image utiliser, et les deux formes ci-dessus
ne se valent pas :

- **coller l'adresse complète** de l'image. C'est la façon la plus sûre : rien
  ne peut être mal recopié, et l'adresse se vérifie d'un coup d'œil — elle
  commence par `https://` et contient `/storage/v1/object/public/annonces/`
  suivi du nom du fichier. On l'obtient depuis Storage, par le bouton qui copie
  l'adresse publique du fichier ;
- **écrire le nom du fichier seul**, par exemple `photo-classe.jpg`. Plus court,
  mais il doit correspondre **exactement** — majuscules et extension comprises.
  Si le fichier a été rangé dans un dossier, c'est le chemin entier qu'il faut
  écrire : `2026-2027/photo-classe.jpg`.

Un nom qui ne correspond à rien ne casse pas la carte : la vignette affiche
alors l'icône de la catégorie, exactement comme s'il n'y avait pas d'image.
C'est le symptôme à reconnaître — **une photo qui n'apparaît pas est presque
toujours un nom mal recopié, pas un fichier manquant.**

Le compartiment est **public en lecture**, comme celui des documents : une photo
où un enfant serait reconnaissable et nommé n'y a pas sa place. Une vue de
l'école, une illustration ou une assiette de cantine ne posent pas de question ;
une liste de noms en pose une.

**Sans image, rien n'est cassé.** Une vignette pastel portant l'icône de la
catégorie prend la place de la photo. C'est l'état de toutes les actualités tant
qu'aucune image n'a été déposée, et l'application reste parfaitement lisible —
il n'y a rien à faire pour cela.

Deux conseils de cadrage :

- **l'image est recadrée au centre** pour remplir sa vignette. Un sujet collé à
  un bord — un visage en bas à droite — peut disparaître. Cadrer large ;
- **une image en paysage vaut mieux qu'en portrait.** La vignette du fil est
  carrée, celle de la carte mise en avant est un rectangle plus large. Une photo
  de paysage s'en sort dans les deux cas.

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

Trois points d'attention :

- **la date est un jour civil, sans heure.** Saisir `2026-09-22` et non
  `2026-09-22T12:00:00` : un instant serait réinterprété selon le fuseau du
  téléphone, et le menu pourrait apparaître la veille chez certains parents ;
- **une seule ligne par jour.** La base refuse un second menu pour la même
  date, ce qui évite deux affichages contradictoires ;
- **au moins un des trois plats doit être rempli.** `entree`, `plat` et `dessert`
  sont facultatifs _séparément_, mais une ligne qui laisse les trois vides est
  refusée. C'est voulu : elle afficherait « Cantine » sans rien dire, et il vaut
  mieux ne pas créer de ligne du tout. Pour signaler une journée particulière —
  « repas froid, sortie scolaire » —, remplir au moins un plat, ou n'écrire la
  précision que le jour où elle sert.

Renseigner les menus la semaine précédente est le rythme le plus confortable
pour les familles. Un jour sans ligne affiche « Pas de cantine ce jour-là » —
il n'y a donc rien à saisir pour les mercredis, samedis et dimanches.

L'application ouvre sur la semaine du **lendemain** : le dimanche soir, un parent
voit déjà la semaine qui commence le lundi. Le repère à retenir est donc le
week-end — les menus de la semaine à venir doivent être saisis avant.

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

**L'heure de fin ne peut pas précéder celle de début.** La base refuse la ligne,
avec `agenda_ordre_valide`. L'erreur vient presque toujours de la date : un
début le 22 à 18 h 30 et une fin le 21 à 20 h est refusé. En cas de doute sur
l'heure de fin, laisser `fin_le` vide — l'événement s'affiche alors sans horaire
de fin, ce qui vaut mieux qu'une horloge fausse.

Un événement apparaît dans « À venir » tant que son **jour** n'est pas passé : la
réunion de 18 h reste donc dans « À venir » quand un parent ouvre l'application à
19 h, marquée « En ce moment ». Il bascule dans « Passés » le lendemain, où il
reste consultable.

Un événement marqué `journee_entiere` et sans heure de fin reste dans « À venir »
jusqu'à la fin de son jour — c'est ce que la case affirme. S'il porte malgré tout
une heure de fin, c'est elle qui tranche.

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
> compartiment, extension comprise — et inclure le dossier s'il y en a un :
> `2026-2027/reglement.pdf`. C'est la seule erreur possible ici, et elle se
> manifeste par un téléchargement qui échoue, l'application affichant alors
> « Ce document n'est plus disponible ».
>
> Le titre est limité à 160 caractères, comme celui d'une actualité.

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

> **Ce que cet accès demande, et pourquoi il faut le savoir.** Ouvrir le Table
> Editor suppose un **compte Supabase ayant accès au projet** — ce n'est pas le
> compte du bureau utilisé pour la page d'administration. La différence de
> portée est considérable : qui peut ouvrir le Table Editor peut aussi modifier
> le schéma, lire toutes les autres tables et changer les politiques. La lecture
> des messages passe donc aujourd'hui par un accès plus large que le strict
> nécessaire. C'est le prix de la simplicité — aucune politique supplémentaire à
> maintenir — et il se paie en nombre de personnes à qui l'on donne les clés du
> projet.

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
