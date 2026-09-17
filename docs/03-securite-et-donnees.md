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

| Rôle            | Qui                               | Ce qu'il peut faire                           |
| --------------- | --------------------------------- | --------------------------------------------- |
| `anon`          | Un parent, depuis son téléphone   | Lire le contenu, déposer un message, voter    |
| `authenticated` | **Personne**                      | Rien : cette application n'a pas de connexion |
| `service_role`  | Le bureau, via le tableau de bord | Tout — contourne la RLS                       |

`authenticated` ne reçoit **aucun privilège**, et c'est vérifié par
`npm run sql:check`. Le rôle reste donc inopérant même si quelqu'un obtenait un
jeton de session par un autre moyen.

---

## Ce qui protège chaque table

### Les tables de contenu

`annonces`, `cantine_menus`, `agenda_events`, `documents`, `sondages`,
`sondage_choix` sont **lisibles** avec la clé publique, et **jamais modifiables**.

Aucune politique d'écriture n'est déclarée pour le rôle `anon`. Ce n'est pas un
oubli : c'est ce qui empêche quiconque a installé l'application de publier une
fausse information au nom de l'école. Le bureau publie avec la clé
`service_role`, qui ignore la RLS.

> Si quelqu'un ajoute un jour un `for insert to anon` « pour simplifier », il
> ouvre la publication à tout porteur de la clé publique — c'est-à-dire à tout
> le monde. `npm run sql:check` ne détecte pas ce cas précis : c'est le seul
> endroit du schéma qui repose sur la vigilance.

### `sondage_votes` et `messages` : aucune politique, et c'est le cœur du sujet

Ces deux tables ne reçoivent **aucune politique**. La RLS étant active et aucune
politique ne s'appliquant, tout accès direct est refusé — en lecture comme en
écriture.

L'intérêt n'est pas seulement d'interdire l'écriture. C'est aussi d'interdire la
**lecture** :

- `messages` contient des messages adressés au bureau. Certains signalent une
  situation personnelle — un enfant qui ne mange pas, un problème de transport,
  une difficulté familiale. Ils ne regardent personne d'autre que le bureau ;
- `sondage_votes` contient les identifiants d'installation des votants. Les
  exposer permettrait de savoir quel téléphone a voté quoi, et de croiser cette
  information avec d'autres.

Les deux seules opérations légitimes passent par des fonctions qui s'exécutent
avec les droits du propriétaire, et qui ne renvoient que ce qui est nécessaire.

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

Refuse un sondage fermé ou dont la date de clôture est passée. Vérifie que le
choix appartient bien au sondage. Ignore un second vote du même appareil plutôt
que d'échouer : `on conflict do nothing` rend la fonction idempotente, ce qui
protège aussi le cas d'une connexion qui vacille et dont la requête est rejouée.

Un déclencheur `verifier_vote_coherent` double la vérification au niveau de la
table, pour qu'un vote ne puisse pas désigner le sondage A et le choix n° 4 du
sondage B.

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

## Ce que le contrôle automatique vérifie

`npm run sql:check` lit les migrations et refuse la poussée si :

- une table n'active pas la RLS ;
- les privilèges par défaut d'une table ne sont pas révoqués pour `anon` ;
- une politique vise une table inexistante ;
- `messages` ou `sondage_votes` reçoit une politique, ou un droit de lecture ;
- une table de contenu n'est pas lisible, ou n'a pas de politique ;
- une fonction exposée n'est pas `security definer`, ou ne fixe pas son
  `search_path`.

Ces fautes ont une particularité : **elles ne se voient nulle part ailleurs**.
Le schéma s'applique sans erreur, l'application fonctionne, et le défaut reste
invisible jusqu'à ce que quelqu'un l'exploite.

Le contrôle a été éprouvé : retirer une ligne `enable row level security`, ou
accorder par mégarde un `grant select` sur `messages`, le fait échouer avec le
message correspondant.

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

### Durées de conservation

- **Messages** : le temps du traitement. À supprimer depuis le tableau de bord
  une fois traités — ce sont les seules données personnelles conservées.
- **Votes** : conservés sous forme de totaux. Les identifiants cessent d'être
  utiles dès la clôture du sondage.
- **Contenu publié** : tant qu'il reste utile aux familles.

### Droits des personnes

Désinstaller l'application efface immédiatement les données locales. Pour un
message envoyé au bureau, la demande se fait auprès de l'association — d'où
l'importance de compléter la section « Responsable de traitement » de
`app/confidentialite.tsx` **avant toute mise à disposition**.

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

5. **`npm run sql:check` ne détecte pas une politique d'écriture ajoutée par
   erreur** sur une table de contenu. C'est le seul angle mort connu du
   contrôle, et la raison pour laquelle toute modification de
   `supabase/migrations/` mérite une relecture humaine.
