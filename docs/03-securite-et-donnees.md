# Sécurité et données personnelles

Ce document explique **pourquoi** le schéma est écrit comme il l'est. Il
s'adresse à quiconque modifiera la base ou le code plus tard.

---

## Le point de départ

Une application mobile distribuée embarque une clé publique. Cette clé est
**extractible par n'importe qui** : il suffit d'ouvrir l'APK ou l'IPA, ou
d'observer une requête réseau. Il ne s'agit pas d'une négligence, mais d'une
contrainte : une clé qui doit être lue par l'application pour fonctionner ne
peut pas rester secrète.

**Conséquence directe : la sécurité ne repose sur aucune ligne du code de
l'application.** Elle repose entièrement sur `supabase/migrations/`.

Toute la logique de sécurité tient donc dans un seul fichier, et c'est
délibéré : un endroit à relire, un endroit à vérifier automatiquement.

---

## Les trois niveaux d'accès

| Rôle            | Qui                                   | Ce qu'il peut faire                                |
| --------------- | ------------------------------------- | -------------------------------------------------- |
| `anon`          | Un parent, depuis son téléphone       | Lire le contenu, déposer un message, voter         |
| `authenticated` | Une personne **nommée dans la liste** | Publier, et lire les messages reçus — rien d'autre |
| `service_role`  | Le bureau, via le tableau de bord     | Tout — contourne la RLS                            |

`authenticated` ne reçoit des privilèges que depuis la migration des membres du
bureau, et **le rôle seul n'ouvre rien** : chaque politique d'écriture qui le vise
est conditionnée à `public.est_membre_bureau()`. C'est indispensable, parce que
Supabase autorise l'inscription publique par défaut — n'importe qui peut obtenir
un jeton `authenticated` en créant un compte. Le rôle dit qu'on a un compte, pas
qui l'on est.

Deux contrôles tiennent cette condition : `npm run sql:check` lit chaque politique
d'écriture visant `authenticated` et exige la condition dans `using` **et** dans
`with check` ; `npm run securite:api` éprouve, avec la clé publique, qu'aucune
écriture ne passe.

---

## Ce qui protège chaque table

### Les tables de contenu

`annonces`, `cantine_menus`, `agenda_events`, `documents`, `sondages`,
`sondage_choix` sont **lisibles** avec la clé publique, et **jamais modifiables**.

Aucune politique d'écriture n'est déclarée pour le rôle `anon`. Ce n'est pas un
oubli : c'est ce qui empêche quiconque a installé l'application de publier une
fausse information au nom de l'école. Le bureau publie soit avec la clé
`service_role` depuis le tableau de bord, soit depuis la page d'administration,
avec sa propre session.

> Si quelqu'un ajoute un jour un `for insert to anon` « pour simplifier », il
> ouvre la publication à tout porteur de la clé publique — c'est-à-dire à tout le
> monde. **Mesuré : `npm run sql:check` le refuse**, comme il refuse une politique
> sans clause `to`, puisque l'absence de clause vaut PUBLIC — et `anon` en fait
> partie.

### `sondage_votes` : aucune politique, et c'est le cœur du sujet

Cette table ne reçoit **aucune politique**. La RLS étant active et aucune
politique ne s'appliquant, tout accès direct est refusé — en lecture comme en
écriture.

L'intérêt n'est pas seulement d'interdire l'écriture. C'est aussi d'interdire la
**lecture** : `sondage_votes` contient les identifiants d'installation des
votants. Les exposer permettrait de savoir quel téléphone a voté quoi, et de
croiser cette information avec d'autres.

La seule opération légitime passe par `sondage_resultats()`, qui s'exécute avec
les droits du propriétaire et ne renvoie que des compteurs.

### `messages` : une porte étroite, ouverte au bureau seul

Cette table a longtemps porté **aucune politique elle aussi**, et sa lecture
était donc réservée au tableau de bord Supabase. C'était cohérent, mais le prix
était plus élevé qu'il n'y paraissait : ouvrir le Table Editor suppose un compte
ayant accès au **projet** — qui peut aussi modifier le schéma, lire toutes les
autres tables et changer les politiques. Lire un message de parent demandait
donc les clés du projet.

`supabase/migrations/20260919140000_messages_bureau.sql` ouvre une voie
étroite, et elle mérite d'être décrite précisément :

| Ce qui change                                 | Ce qui ne change pas                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `grant select, update` à `authenticated`      | `anon` ne reçoit **aucun** privilège                            |
| Deux politiques, `for select` et `for update` | Ni `insert` (c'est `envoyer_message()`), ni `delete`            |
| Le bureau lit depuis la page d'administration | Les messages des parents restent illisibles par la clé publique |

**Il n'y a pas de `for all`, et c'est délibéré.** Le bureau lit et marque comme
traité ; il n'insère pas et ne supprime pas. Un `for all` aurait exprimé un
droit qu'on ne veut pas donner, et la ligne aurait fini par être prise pour une
autorisation.

**Il n'y a pas de `delete`, et c'est une décision de fond.** La page de
confidentialité promet que les messages traités sont supprimés. La promesse est
tenue, mais par une personne, depuis le tableau de bord, et non par une case à
cocher qui pourrait être cliquée de travers.

Refuser le bouton ne suffisait pourtant pas : cocher « traité » **ferme le
traitement**, et c'est à ce moment que la promesse attache la suppression. L'aide
de l'écran et le message de confirmation disent donc qu'il reste à la faire, et
où. `tests/messages-traitement-et-suppression.test.ts` tient cette phrase — en
lisant le fichier **commentaires retirés**, sans quoi le commentaire d'en-tête,
qui nomme le tableau de bord, garderait le contrôle vert sur un écran muet.

`messages` **reste dans la liste des tables fermées** de `npm run securite:api`,
et les deux sondes — lecture et insertion avec la clé publique — continuent de
l'y vérifier. Ce qui a changé, c'est la **cause** de la fermeture : elle tenait à
l'absence de politique, elle tient désormais au seul `revoke all … from anon`.
La distinction compte, parce qu'un lecteur qui croirait l'ancienne raison
ajouterait la politique manquante « pour réparer » et ouvrirait les messages des
parents.

---

## Les trois fonctions exposées

Toutes sont `security definer`, avec `set search_path = ''`.

### `sondage_resultats(uuid[])`

Renvoie le décompte des voix par réponse, pour un ou plusieurs sondages.
**Aucun identifiant de votant n'en sort jamais.** C'est la raison d'être de
cette fonction : l'application a besoin des totaux, pas de savoir qui a voté.

Elle prend un tableau d'identifiants pour que l'onglet Plus se remplisse d'un
seul coup, plutôt qu'en autant de requêtes que de sondages.

### `voter(uuid, uuid, uuid)`

Refuse un sondage fermé ou dont la date de clôture est passée. Ignore un second
vote du même appareil plutôt que d'échouer : `on conflict do nothing` rend la
fonction idempotente, ce qui protège aussi le cas d'une connexion qui vacille et
dont la requête est rejouée.

Elle rend `true` quand le vote est enregistré, `false` quand elle en ignorait un
autre. **L'application doit lire ce booléen** : sans lui, elle afficherait comme
enregistré un choix que la base n'a pas pris. Voir « Le vote ne se rejoue pas »
dans le README.

Le choix appartient-il bien au sondage ? La fonction ne le vérifie pas
elle-même : c'est un déclencheur `verifier_vote_coherent`, posé sur la table,
qui le fait — et il le fait donc pour toute écriture, y compris celles qui ne
passeraient pas par la fonction.

### `envoyer_message(...)`

Applique la cadence : **trois messages par quart d'heure et par appareil**.

La règle vit dans la base, et non dans l'application : c'est le seul endroit
qu'un client modifié ne peut pas contourner.

---

## Pourquoi `security definer` avec `search_path = ''`

`security definer` fait exécuter la fonction avec les droits de son
propriétaire, ce qui est indispensable puisqu'elle écrit dans des tables
auxquelles `anon` n'a aucun privilège.

Mais ce mode ouvre un piège classique : si l'appelant peut placer un schéma plus
haut dans le `search_path`, il peut y définir une fausse table portant le même
nom, et faire écrire la fonction ailleurs. `set search_path = ''` ferme ce
détour, et impose de qualifier explicitement chaque nom — `public.messages` et
non `messages`.

---

## Ce que les contrôles automatiques vérifient

Deux contrôles, à deux niveaux. Aucun ne remplace l'autre.

### 1. La migration, relue — `npm run sql:check`

`npm run sql:check` lit les migrations et refuse la poussée si :

- une table n'active pas la RLS ;
- les privilèges par défaut d'une table ne sont pas révoqués pour `anon` ;
- une politique vise une table inexistante ;
- `sondage_votes` reçoit une politique, ou un droit de lecture ;
- `messages` reçoit un privilège **quelconque** pour `anon`, ou une politique
  qui ne vise pas `authenticated`, ou une politique dont la clause `using` ne
  porte pas `public.est_membre_bureau()` — la condition est lue **dans la
  clause**, par appariement des parenthèses, pour qu'un `using (true)` suivi
  d'un `with check` gardé ne passe pas ;
- une table de contenu n'est pas lisible, ou n'a pas de politique ;
- une fonction exposée n'est pas `security definer`, ou ne fixe pas son
  `search_path` ;
- une politique d'écriture vise `anon`, ou **omet sa clause `to`** — qui vaut
  PUBLIC, et `anon` en fait partie ;
- une politique d'écriture vise `authenticated` sans conditionner l'accès à
  `public.est_membre_bureau()`, **dans `using` et dans `with check`** ;
- une borne de longueur de l'écran de contact n'est confrontée à aucune
  contrainte — l'ensemble des constantes `LONGUEUR_*` de cet écran est **fermé**,
  et la liste des bornes tenues est déduite des lectures réellement effectuées,
  jamais recopiée.

La règle de la **condition d'appartenance** mérite une phrase de plus, parce
qu'elle porte désormais sur **deux** familles de tables : les tables de contenu
écrites par le bureau, et `messages`, dont la politique de lecture n'existe que
pour lui. Elle existe parce que `npm run securite:api` interroge la base avec la
clé **anon** : une politique visant `authenticated` lui est invisible, si bien
qu'une application que tout inscrit pourrait modifier — ou dont tout inscrit
pourrait lire les messages — lui aurait donné un vert. Les deux clauses sont
exigées séparément parce que `with check` ne s'applique **ni à `delete`, ni au
choix des lignes visibles** : un `using (true)` accompagné d'un `with check`
gardé laisserait tout inscrit supprimer n'importe quelle annonce. Cette forme-là
a été écrite, et le contrôle ne la voyait pas — c'est la falsification qui l'a
montré, pas la relecture.

Ces fautes ont une particularité : **elles ne se voient nulle part ailleurs**.
Le schéma s'applique sans erreur, l'application fonctionne, et le défaut reste
invisible jusqu'à ce que quelqu'un l'exploite.

Le contrôle a été éprouvé, mutation par mutation : retirer une ligne
`enable row level security` ; accorder par mégarde un `grant select` sur
`messages` ; accorder un privilège à `anon` ; viser `anon` au lieu de
`authenticated` ; écrire `using (true)` en gardant `with check` ; **nier** la
condition au lieu de l'exiger ; ouvrir `with check` sous un `using` gardé ;
retirer une borne de sa liste ; ajouter à l'écran de contact une constante
`LONGUEUR_*` que rien ne confronte — chaque fois il échoue, avec le message
correspondant. Une variante a aussi été éprouvée pour le contrôle lui-même :
neutraliser la règle — le contrôle ne reconnaît plus le rôle — fait échouer son
garde-fou d'extraction, au lieu de la laisser passer au vert sans rien regarder.

### 2. La base, interrogée — `npm run securite:api`

Un fichier de migration peut décrire une base qui n'existe pas : il suffit qu'il
n'ait jamais été appliqué. Et une politique ajoutée à la main depuis le tableau
de bord n'apparaît dans aucun fichier. Le premier contrôle ne peut donc rien
dire de l'état réel.

`npm run securite:api` interroge la base **avec la même clé publique que celle
embarquée dans l'application**, et vérifie ce qu'un inconnu qui l'extrait d'un
APK peut réellement faire :

| Vérification                                                        | Attendu                        |
| ------------------------------------------------------------------- | ------------------------------ |
| Les six tables de contenu                                           | lisibles (HTTP 200)            |
| `messages`, `sondage_votes`                                         | **refusées** (HTTP 401 ou 403) |
| Insertion, modification, suppression                                | refusées partout               |
| `sondage_resultats`                                                 | répond                         |
| `voter` avec un sondage inexistant                                  | refuse                         |
| `envoyer_message` avec un sujet vide                                | refuse, sans rien insérer      |
| `set_updated_at`, `verifier_vote_coherent`, `ajouter_membre_bureau` | absentes du cache (HTTP 404)   |
| `est_membre_bureau`                                                 | **refusée** (HTTP 401 ou 403)  |
| La clé utilisée                                                     | est la clé publique            |

> Ce contrôle ne dit rien de ce que le **bureau** peut faire : il n'est jamais
> une personne connectée. Depuis que `messages` porte des politiques visant
> `authenticated`, cette limite compte davantage — la garantie qu'un inscrit
> quelconque ne lit pas les messages des parents ne repose plus sur
> `securite:api`, mais sur la règle de `sql:check` qui exige la condition
> d'appartenance dans chaque politique. Les deux contrôles sont nécessaires, et
> aucun ne remplace l'autre.

Quatre points de conception :

- **Une table fermée doit répondre « interdit », pas « liste vide ».** Un 200
  avec `[]` signifierait que le privilège de lecture a été accordé et que la RLS
  retient les lignes — parce qu'aucune politique ne s'applique, ou, pour
  `messages`, parce que les politiques visent `authenticated` et que la clé
  publique ne l'est pas. Dans les deux cas, la table serait à un `create policy`
  près d'être ouverte. Le contrôle exige donc un 401 ou un 403.
- **Aucune requête ne modifie la base.** Les appels aux fonctions sont choisis
  pour échouer avant toute insertion : un sondage inexistant pour `voter`, un
  sujet vide pour `envoyer_message`. Le contrôle ne dépose jamais un message
  d'essai dans la boîte du bureau.
- **Une clé non reconnue fait échouer le contrôle, elle ne le laisse pas
  passer.** C'est la règle la moins visible et la plus importante : tout ce qui
  suit ne vaut que si la clé utilisée est bien la clé publique. Une forme
  inconnue ne permet pas d'affirmer quoi que ce soit sur les droits qu'elle
  porte — et un contrôle qui ne peut rien affirmer doit échouer. Le préfixe
  accepté est `sb_publishable_` **exactement**, jamais `sb_` : `sb_secret_…`
  porte le même début, et l'accepter reviendrait à déclarer « cette clé n'est
  pas une clé de service » sur la clé de service elle-même.
- **Une fonction d'administration se refuse de deux façons, et il faut savoir
  laquelle.** `est_membre_bureau` est accordée au seul rôle `authenticated` —
  les politiques d'écriture l'appellent, et une politique s'évalue avec les
  droits de qui interroge. Elle est donc **présente au cache de schéma** de
  PostgREST, qui est bâti sur l'ensemble des rôles : la clé publique la trouve et
  se la voit refuser, HTTP 401. Les trois autres ne sont accordées à aucun rôle,
  ne sont donc pas au cache, et répondent 404. Ce contrôle attendait 404 pour les
  quatre, en écrivant que PostgREST « ne trouve pas » une fonction non accordée :
  c'était faux, et le contrôle était **vert pour rien** — le 404 arrivait parce
  que la fonction n'existait pas encore. Le 401 est une meilleure preuve : il
  n'est pas ambigu, il établit à la fois que la fonction existe et que la clé
  publique ne peut pas l'appeler.

Le contrôle a lui aussi été éprouvé, contre un serveur simulant PostgREST : base
correcte → vert ; `messages` lisible, écritures autorisées, fonction exposée
manquante, sujet vide accepté, clé `service_role` fournie → échec dans les cinq
cas, avec le message attendu.

Ce montage n'est **pas conservé dans le dépôt** : il ne se rejoue pas tout seul,
et il n'a pas été refait depuis. Ce qui est tenu en permanence est ailleurs, et ne
demande ni base ni serveur — `tests/accord-fonctions-exposees.test.mjs` éprouve le
verdict rendu pour chaque statut, et confronte les deux listes du contrôle aux
`revoke` et `grant` des migrations ainsi qu'aux fonctions que l'application et
l'administration appellent réellement.

Le contrôle de forme de la clé a été éprouvé séparément, sur cinq formes.
`sb_publishable_…` et un JWT au rôle `anon` franchissent cette étape ; `sb_secret_…`,
`sbp_…` et un JWT au rôle `service_role` la font échouer. Avant correction,
`sb_secret_…` la franchissait — en annonçant « la clé n'est pas une clé de
service » et « rôle non vérifiable », c'est-à-dire en passant tout en avouant
n'avoir rien pu vérifier.

Le flux Android l'exécute avant de compiler : on ne produit pas un APK pour une
base ouverte.

---

## Données personnelles

### Ce qui est conservé sur le téléphone

| Donnée                 | Rôle                            | Portée                     |
| ---------------------- | ------------------------------- | -------------------------- |
| Identifiant de vote    | Éviter le double vote           | Envoyé avec chaque vote    |
| Identifiant d'appareil | Limiter la cadence des messages | Envoyé avec chaque message |
| Préférence de thème    | Confort d'affichage             | Jamais transmise           |
| Votes retenus          | Afficher « votre réponse »      | Jamais transmis            |

Les deux identifiants sont **volontairement distincts**. Un identifiant unique
permettrait de relier un message signé « je suis la maman de Léa en CP » au vote
déposé sur le même appareil. Deux informations anodines séparément, dont le
croisement reconstitue une opinion attribuable à une famille. C'est le principe
de minimisation appliqué au seul endroit où cette application stocke quelque
chose.

Ils ne sont dérivés d'aucun élément du matériel ni du système : ce sont des UUID
tirés au hasard à la première ouverture.

### Ce qui n'est jamais collecté

Nom, adresse, téléphone, position, contacts, photos, fichiers. Aucun outil de
mesure d'audience, aucune publicité, aucun tiers.

### Le seul champ facultatif qui identifie

Le formulaire de contact propose une adresse de réponse. Elle est facultative, et
l'écran le dit : sans elle, le bureau ne peut pas répondre. Lorsqu'elle est
renseignée, c'est la seule donnée qui rattache un message à une personne — elle
part avec le message, et ne sert qu'à répondre.

La base impose alors une forme plausible, et le formulaire applique **la même
règle**, recopiée du schéma dans `src/lib/adresse-reponse.ts` et tenue par
`tests/adresse-reponse.test.ts`. Le banc relit le motif dans la migration et
compare les verdicts **dans les deux sens** : une recopie plus large rendrait le
message inenvoyable, une recopie plus étroite refuserait des adresses valides —
deux défauts de sens opposés, et le second est le moins visible.

Le champ vide n'est pas une tolérance mais le cas normal : la contrainte autorise
`null`, et c'est ce que l'application envoie.

### Durées de conservation

- **Messages** : le temps du traitement. Le bureau les marque « traités » depuis
  la page d'administration, puis les supprime depuis le tableau de bord — ce sont
  les seules données personnelles conservées. La suppression n'est **pas** offerte
  dans la page : elle est irréversible, et une case à cocher voisine se clique de
  travers.
- **Votes** : conservés sous forme de totaux. Les identifiants cessent d'être
  utiles dès la clôture du sondage.
- **Contenu publié** : tant qu'il reste utile aux familles.

### Droits des personnes

Désinstaller l'application efface immédiatement les données locales. Pour un
message envoyé au bureau, la demande se fait auprès de l'association — d'où
l'importance de remplir l'objet `RESPONSABLE`, en tête de
`app/confidentialite.tsx`, **avant toute mise à disposition** — la page affiche
un avertissement bien visible tant que les trois valeurs manquent.

La règle qui choisit entre l'avertissement et les coordonnées ne vit pas dans
l'écran mais dans `src/lib/responsable.ts`, et
`tests/responsable-traitement.test.ts` la tient : un banc ne peut pas charger
l'écran, qui importe React Native. Ce banc couvre aussi la forme de l'écran,
parce que deux défauts y sont invisibles — une condition niée, qui inverse les
deux affichages sans changer leur ordre, et une valeur faite d'espaces, qui
compte comme absente.

---

## Points de vigilance pour la suite

1. **Ne jamais placer la clé `service_role` dans l'application.**
   `src/config/env.ts` refuse de démarrer si on la lui fournit — un garde-fou,
   pas une autorisation de le faire.

2. **Toute colonne ajoutée à une table lisible est lisible par tout le monde.**
   Les tables de contenu n'ont aucune politique restrictive : une colonne
   `note_interne` ajoutée à `annonces` partirait sur tous les téléphones.

3. **Un document nominatif n'a rien à faire dans le compartiment `documents`.**
   Il est public en lecture, sans compte.

4. **Le plafond de trois messages par quart d'heure se contourne** en changeant
   d'identifiant. Il arrête une inondation automatique, pas un adversaire. La
   protection réelle contre un message malveillant isolé est humaine : le bureau
   lit ce qui arrive, et peut le supprimer.

5. **`npm run sql:check` ne détecte pas un `grant` d'écriture accordé à `anon`
   sans politique correspondante.** Mesuré, et sans danger aujourd'hui : la RLS
   est active et aucune politique ne vise `anon`, donc le privilège ne donne accès
   à rien. Mais une ligne accordée « au cas où » deviendrait exploitable le jour
   où une politique apparaîtrait — et c'est le genre de ligne qu'on ne relit pas.
   Toute modification de `supabase/migrations/` mérite donc une relecture humaine.

   **Ce qui n'est plus un angle mort** : une politique d'écriture ajoutée par
   erreur sur une table de contenu est refusée, qu'elle vise `anon`, qu'elle
   omette sa clause `to`, ou qu'elle vise `authenticated` sans la condition
   d'appartenance. Les trois formes ont été éprouvées, et la troisième était le
   trou le plus dangereux des trois : `npm run securite:api` ne pouvait pas la
   voir, puisqu'elle ne concerne pas la clé publique.

6. **`messages` n'est plus fermée par l'absence de politique, mais par le seul
   `revoke`.** Depuis `20260919140000_messages_bureau.sql`, la table porte deux
   politiques visant `authenticated`. Ce qui refuse la clé publique est donc le
   `revoke all … from anon`, et non plus une politique manquante. La distinction
   est celle qui piège : croire l'ancienne raison ferait ajouter la politique
   « oubliée » et ouvrirait les messages des parents. Deux contrôles la rendent
   visible si l'erreur est commise — `sql:check` exige, pour cette table, que
   **chaque** politique vise `authenticated` et porte la condition d'appartenance
   dans sa clause `using` ; `securite:api` sonde la lecture **et** l'insertion
   avec la clé publique.

7. **`npm audit` signale quatorze vulnérabilités modérées qui ne concernent pas
   l'application livrée.** Deux avis distincts, tous deux dans la chaîne
   d'outillage d'Expo : `decode-uri-component` (déni de service par décodage
   exponentiel d'une entrée mal formée, atteint via `expo-router` →
   `query-string`) et `uuid` (absence de contrôle de bornes en v3/v5/v6, via
   `expo-splash-screen`).

   Cela a été **vérifié dans le paquet réel**, et non supposé : le paquet Hermes
   exporté ne contient aucune occurrence des chaînes `decode-uri-component`,
   `query-string` ni `strict-uri-encode`, alors qu'il contient bien `supabase`
   (77 occurrences), `expo-router` (12) et `AsyncStorage` (7). Le code vulnérable
   n'est donc pas embarqué — il n'existe que sur la machine de compilation.

   **Ne pas lancer `npm audit fix --force`** : npm propose de rétrograder
   `expo-router` de la version 57 à la 5.1.11, ce qui casserait le projet. La
   correction ne peut venir que d'une mise à jour d'Expo.
