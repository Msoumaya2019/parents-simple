-- =============================================================================
--  Schéma initial — FCPE Écoles Frères Lumières (Montmagny)
-- =============================================================================
--
--  Application :
--      npx supabase link --project-ref <référence-du-projet>
--      npx supabase db push
--  ou, sans CLI : coller ce fichier dans l'éditeur SQL du tableau de bord.
--
-- -----------------------------------------------------------------------------
--  RÈGLE DIRECTRICE
-- -----------------------------------------------------------------------------
--  Cette application n'a AUCUN compte : elle s'adresse à tous les parents, y
--  compris ceux qui n'ouvriront l'application qu'une fois. Elle embarque donc
--  une clé publique que n'importe qui peut extraire du binaire installé.
--
--  Conséquence : la sécurité ne repose pas sur le code de l'application. Elle
--  repose ENTIÈREMENT sur ce fichier.
--
--  Chaque table reçoit `enable row level security` dans la foulée de sa
--  création, et les privilèges sont accordés explicitement, table par table,
--  rôle par rôle. Une table sans RLS est lisible et modifiable par tout porteur
--  de la clé publique : c'est le défaut le plus courant, et le plus coûteux,
--  d'un projet Supabase.
--
--  TROIS NIVEAUX D'ACCÈS, ET RIEN D'AUTRE
--  --------------------------------------
--    anon   le parent, depuis son téléphone. Lit le contenu, dépose un
--           message, vote à un sondage. N'écrit rien d'autre.
--    (rien) le rôle `authenticated` n'est jamais utilisé : il n'existe pas de
--           connexion dans cette application. Aucun privilège ne lui est
--           accordé, et l'absence de politique le laisse sans effet.
--    bureau la publication passe par le tableau de bord Supabase, donc par la
--           clé `service_role`, qui contourne la RLS. C'est délibéré : il n'y
--           a pas d'interface d'administration à construire, à sécuriser ni à
--           maintenir.
--
--  Ce dernier point est un choix, pas un oubli. Publier une actualité demande
--  d'ouvrir le tableau de bord, ce qui est acceptable pour quelques
--  publications par semaine, et supprime tout un pan de surface d'attaque.
-- =============================================================================


-- =============================================================================
--  1. Types énumérés
-- =============================================================================
--  Déclarés en base plutôt que contraints par des chaînes libres : une valeur
--  erronée est refusée à l'écriture, et non découverte à l'affichage — sur le
--  téléphone d'un parent, après coup.

create type public.message_categorie as enum (
  'cantine',
  'transport',
  'vie_scolaire',
  'activites',
  'autre'
);

create type public.document_categorie as enum (
  'administratif',
  'scolarite',
  'cantine',
  'activites',
  'autre'
);


-- =============================================================================
--  2. Fonctions utilitaires
-- =============================================================================

--  ---------------------------------------------------------------------------
--  `set_updated_at()` — horodatage automatique des modifications
--  ---------------------------------------------------------------------------
--  Sans ce déclencheur, `updated_at` reste à sa valeur d'insertion et devient
--  trompeur : il faut alors le renseigner depuis chaque écriture, ce qui finit
--  par être oublié à un endroit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

--  Une fonction qui rend `trigger` ne peut pas être appelée directement, et les
--  déclencheurs s'exécutent sans que l'appelant ait besoin du droit `execute`.
--  Révoqué pour que la règle soit uniforme et vérifiable d'un coup d'œil.
revoke all on function public.set_updated_at() from public, anon, authenticated;


-- =============================================================================
--  3. Tables de contenu
-- =============================================================================
--  Toutes en lecture publique. Aucune n'est modifiable avec la clé publique :
--  le bureau publie depuis le tableau de bord.

--  ---------------------------------------------------------------------------
--  annonces — les actualités de l'école et de l'association
--  ---------------------------------------------------------------------------
--  `epinglee` existe parce qu'une information qui concerne tout le monde
--  aujourd'hui — une fermeture d'école, une grève de cantine — doit rester en
--  tête du fil même après la publication de trois comptes rendus.
create table public.annonces (
  id           uuid primary key default gen_random_uuid(),
  titre        text not null,
  corps        text not null,
  epinglee     boolean not null default false,
  publiee_le   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint annonces_titre_valide check (char_length(btrim(titre)) between 1 and 160),
  constraint annonces_corps_valide check (char_length(btrim(corps)) between 1 and 8000)
);

comment on table public.annonces is
  'Actualités publiées par le bureau. Lecture publique, écriture par le tableau de bord uniquement.';


--  ---------------------------------------------------------------------------
--  cantine_menus — un menu par jour de service
--  ---------------------------------------------------------------------------
--  `service_date` est une DATE, pas un horodatage : un menu concerne une
--  journée civile. Stocker un instant obligerait chaque lecteur à choisir un
--  fuseau, et ferait basculer l'affichage d'un jour à l'autre selon le
--  réglage du téléphone.
--
--  La contrainte d'unicité est de fond : deux menus pour le même jour
--  donneraient deux affichages contradictoires, sans moyen de savoir lequel
--  fait foi.
create table public.cantine_menus (
  id            uuid primary key default gen_random_uuid(),
  service_date  date not null,
  entree        text,
  plat          text,
  dessert       text,
  allergenes    text[],
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint cantine_menus_jour_unique unique (service_date),
  constraint cantine_menus_contenu check (
    coalesce(btrim(entree), '') <> ''
    or coalesce(btrim(plat), '') <> ''
    or coalesce(btrim(dessert), '') <> ''
  )
);

comment on table public.cantine_menus is
  'Menus de cantine, un par jour de service. Lecture publique.';


--  ---------------------------------------------------------------------------
--  agenda_events — les dates importantes
--  ---------------------------------------------------------------------------
--  `debut_le` et `fin_le` sont des horodatages, contrairement aux menus : une
--  réunion commence à 18 h 30, et cette heure doit être affichée telle quelle.
--  `fin_le` est facultatif — beaucoup d'événements n'ont pas d'heure de fin
--  connue, et l'obliger ferait saisir une valeur inventée.
create table public.agenda_events (
  id           uuid primary key default gen_random_uuid(),
  titre        text not null,
  description  text,
  debut_le     timestamptz not null,
  fin_le       timestamptz,
  lieu         text,
  journee_entiere boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint agenda_titre_valide check (char_length(btrim(titre)) between 1 and 160),
  constraint agenda_ordre_valide check (fin_le is null or fin_le >= debut_le)
);

comment on table public.agenda_events is
  'Événements de l''agenda scolaire. Lecture publique.';


--  ---------------------------------------------------------------------------
--  documents — les documents utiles aux familles
--  ---------------------------------------------------------------------------
--  Le fichier lui-même vit dans Storage ; cette table ne porte que ses
--  métadonnées et son chemin. `taille_octets` est renseignée à la publication,
--  ce qui permet d'avertir un parent avant qu'il ne télécharge 12 Mo sur son
--  forfait mobile.
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  titre          text not null,
  description    text,
  categorie      public.document_categorie not null default 'autre',
  storage_path   text not null,
  taille_octets  bigint,
  publie_le      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint documents_titre_valide check (char_length(btrim(titre)) between 1 and 160),
  constraint documents_chemin_valide check (char_length(btrim(storage_path)) between 1 and 400),
  constraint documents_taille_positive check (taille_octets is null or taille_octets >= 0)
);

comment on table public.documents is
  'Métadonnées des documents PDF ou images. Le fichier est dans le bucket Storage « documents ».';


--  ---------------------------------------------------------------------------
--  sondages — questions posées aux parents
--  ---------------------------------------------------------------------------
--  `cloture_le` est facultatif : un sondage sans date de clôture reste ouvert
--  jusqu'à ce que le bureau le ferme. `ouvert` permet de fermer un sondage
--  immédiatement sans effacer la date prévue, et donc sans réécrire l'historique.
create table public.sondages (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  precisions  text,
  ouvert      boolean not null default true,
  cloture_le  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint sondages_question_valide check (char_length(btrim(question)) between 1 and 300)
);

comment on table public.sondages is
  'Sondages. Un sondage accepte plusieurs choix, un seul vote par appareil et par sondage.';


--  ---------------------------------------------------------------------------
--  sondage_choix — les réponses proposées
--  ---------------------------------------------------------------------------
--  `position` fixe l'ordre d'affichage. Sans elle, PostgreSQL ne garantit aucun
--  ordre de lecture : les réponses pourraient changer de place entre deux
--  ouvertures de l'écran, ce qui donne l'impression que l'application bugue.
create table public.sondage_choix (
  id          uuid primary key default gen_random_uuid(),
  sondage_id  uuid not null references public.sondages (id) on delete cascade,
  libelle     text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint sondage_choix_libelle_valide check (char_length(btrim(libelle)) between 1 and 200)
);

comment on table public.sondage_choix is
  'Réponses possibles d''un sondage. Supprimer un sondage supprime ses choix.';


--  ---------------------------------------------------------------------------
--  sondage_votes — les votes
--  ---------------------------------------------------------------------------
--  POURQUOI `votant_id` ET CE QU'IL EST
--  ------------------------------------
--  Il n'y a pas de compte : rien n'identifie un parent. Sans la moindre
--  mémoire, un même appareil pourrait voter indéfiniment et le résultat du
--  sondage ne voudrait rien dire.
--
--  `votant_id` est donc un identifiant aléatoire, tiré une fois par
--  installation et conservé sur le téléphone. Il n'est dérivé d'aucun élément
--  du matériel ni du système : deux installations produisent deux valeurs sans
--  aucun lien. Il ne permet pas de remonter à une personne, mais il est
--  pseudonyme au sens du RGPD et doit être déclaré comme tel.
--
--  CE QU'IL NE FAIT PAS
--  --------------------
--  Il n'empêche pas un utilisateur déterminé de voter plusieurs fois : effacer
--  l'application et la réinstaller produit un nouvel identifiant. C'est une
--  limite assumée, et la seule alternative serait de demander un compte — ce
--  qui a été écarté. Pour un sondage d'école, décourager le double vote
--  accidentel suffit ; le résultat n'a pas de portée décisionnaire au point
--  qu'on doive s'en protéger contre un adversaire.
--
--  La contrainte d'unicité, elle, est une garantie réelle : deux appuis
--  rapprochés sur le même bouton ne créent pas deux votes.
create table public.sondage_votes (
  id          uuid primary key default gen_random_uuid(),
  sondage_id  uuid not null references public.sondages (id) on delete cascade,
  choix_id    uuid not null references public.sondage_choix (id) on delete cascade,
  votant_id   uuid not null,
  created_at  timestamptz not null default now(),

  constraint sondage_votes_unique unique (sondage_id, votant_id)
);

comment on table public.sondage_votes is
  'Votes anonymes. Aucune lecture directe par la clé publique : les résultats passent par la fonction sondage_resultats().';


--  ---------------------------------------------------------------------------
--  messages — ce que les parents écrivent au bureau
--  ---------------------------------------------------------------------------
--  `appareil_id` joue le même rôle que `votant_id` : il permet de limiter le
--  nombre de messages qu'une même installation peut déposer en peu de temps.
--  Sans lui, un formulaire ouvert et sans compte est une porte ouverte à
--  l'inondation.
--
--  `reponse_a` est facultatif et n'est jamais obligatoire : exiger une adresse
--  pour signaler un problème de cantine ferait renoncer une partie des parents,
--  ce qui va contre l'objet même de cet écran.
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sujet         text not null,
  corps         text not null,
  categorie     public.message_categorie not null default 'autre',
  reponse_a     text,
  appareil_id   uuid not null,
  traite        boolean not null default false,
  created_at    timestamptz not null default now(),

  constraint messages_sujet_valide check (char_length(btrim(sujet)) between 1 and 160),
  constraint messages_corps_valide check (char_length(btrim(corps)) between 1 and 4000),
  --  Un format d'adresse plausible, pas une validation complète : la seule
  --  validation qui compte est l'envoi d'un message à cette adresse, et le
  --  bureau la fera depuis sa propre boîte. Une expression trop stricte
  --  refuserait des adresses valides, ce qui est pire que d'en accepter une
  --  fausse — l'adresse fausse se voit tout de suite, le refus non.
  constraint messages_reponse_format check (
    reponse_a is null
    or reponse_a ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint messages_reponse_longueur check (
    reponse_a is null or char_length(reponse_a) <= 254
  )
);

comment on table public.messages is
  'Messages déposés par les parents. Lecture réservée au bureau (tableau de bord).';


-- =============================================================================
--  4. Index
-- =============================================================================
--  Chaque index correspond à une requête réellement écrite dans `src/services/`.
--  Un index sans requête coûte à l'écriture et ne sert à rien.

--  Le fil d'accueil : épinglées d'abord, puis les plus récentes.
create index annonces_fil_idx
  on public.annonces (epinglee desc, publiee_le desc);

--  La semaine de cantine : menus à venir, dans l'ordre chronologique.
create index cantine_menus_service_date_idx
  on public.cantine_menus (service_date);

--  L'agenda : prochains événements.
create index agenda_events_debut_idx
  on public.agenda_events (debut_le);

--  La liste des documents, du plus récent au plus ancien.
create index documents_publie_le_idx
  on public.documents (publie_le desc);

--  Le comptage des votes d'un sondage — c'est la requête la plus fréquente de
--  l'application, appelée à chaque ouverture de l'onglet Plus.
create index sondage_votes_sondage_idx
  on public.sondage_votes (sondage_id);

--  Les choix d'un sondage, dans l'ordre voulu.
create index sondage_choix_sondage_position_idx
  on public.sondage_choix (sondage_id, position);

--  Le contrôle de cadence des messages, qui compte les dépôts récents d'un
--  même appareil.
create index messages_appareil_created_idx
  on public.messages (appareil_id, created_at desc);


-- =============================================================================
--  5. Déclencheurs de cohérence
-- =============================================================================

create trigger annonces_set_updated_at
  before update on public.annonces
  for each row execute function public.set_updated_at();

create trigger cantine_menus_set_updated_at
  before update on public.cantine_menus
  for each row execute function public.set_updated_at();

create trigger agenda_events_set_updated_at
  before update on public.agenda_events
  for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger sondages_set_updated_at
  before update on public.sondages
  for each row execute function public.set_updated_at();


--  ---------------------------------------------------------------------------
--  Un vote doit viser un choix du sondage auquel il se rattache
--  ---------------------------------------------------------------------------
--  `choix_id` et `sondage_id` sont deux clés étrangères distinctes, et rien ne
--  les relie : sans ce déclencheur, un vote pouvait désigner le sondage A et le
--  choix n° 4 du sondage B. Le décompte devenait alors faux d'une manière
--  difficile à repérer, puisqu'aucune erreur n'était levée — seule une ligne
--  incohérente apparaissait dans les résultats.
--
--  Une clé étrangère composite `(choix_id, sondage_id)` aurait été plus
--  élégante, mais elle oblige à déclarer une contrainte d'unicité sur
--  `sondage_choix (id, sondage_id)` uniquement pour la rendre référençable. Le
--  déclencheur dit la même chose sans modifier la table des choix.
create or replace function public.verifier_vote_coherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.sondage_choix
     where id = new.choix_id
       and sondage_id = new.sondage_id
  ) then
    raise exception 'Le choix ne fait pas partie de ce sondage.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.verifier_vote_coherent() from public, anon, authenticated;

create trigger sondage_votes_verifier_coherence
  before insert or update on public.sondage_votes
  for each row execute function public.verifier_vote_coherent();


-- =============================================================================
--  6. Fonctions exposées à l'application
-- =============================================================================
--  Les deux seules écritures possibles avec la clé publique passent par ces
--  fonctions, et par aucune autre voie. Leur intérêt est double :
--
--    - la table reste fermée, donc aucun parent ne peut lire les votes des
--      autres ni les messages des autres ;
--    - les règles — sondage ouvert, choix cohérent, cadence des messages —
--      sont appliquées par la base, et non par l'application. Un client
--      modifié, ou un simple appel direct à l'API avec la clé publique, s'y
--      heurte exactement de la même façon.
--
--  Toutes sont `security definer`, ce qui est indispensable puisqu'elles
--  écrivent dans des tables auxquelles `anon` n'a aucun privilège. `set
--  search_path = ''` ferme le piège classique de ce mode : sans lui, un schéma
--  placé plus haut dans le `search_path` de l'appelant pourrait redéfinir les
--  tables visées et faire écrire la fonction ailleurs. Tous les noms sont donc
--  qualifiés explicitement.

--  ---------------------------------------------------------------------------
--  `sondage_resultats()` — le décompte, sans exposer les votes
--  ---------------------------------------------------------------------------
--  L'application a besoin du nombre de voix par réponse. Elle n'a pas besoin de
--  savoir qui a voté, et n'a rien à faire de `votant_id`. Renvoyer une table
--  agrégée plutôt que d'ouvrir un `select` sur `sondage_votes` supprime la
--  question : les identifiants des votants ne quittent jamais la base.
--
--  `left join` et non `join` : une réponse qui n'a reçu aucun vote doit
--  apparaître à zéro. Avec une jointure interne, elle disparaîtrait de
--  l'affichage, et un parent ne pourrait plus voter pour elle — précisément
--  celle que personne n'a encore choisie.
--
--  POURQUOI LA FONCTION PREND UN TABLEAU D'IDENTIFIANTS
--  ---------------------------------------------------
--  L'onglet Plus affiche plusieurs sondages à la fois. Une fonction n'acceptant
--  qu'un seul identifiant aurait imposé un appel par sondage : sur une
--  connexion mobile médiocre, l'écran se remplirait par morceaux, chaque
--  sondage apparaissant après une attente séparée. Une seule requête pour
--  l'ensemble donne un affichage complet d'un coup.
create or replace function public.sondage_resultats(p_sondage_ids uuid[])
returns table (
  sondage_id uuid,
  choix_id   uuid,
  libelle    text,
  position   integer,
  votes      bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.sondage_id,
    c.id,
    c.libelle,
    c.position,
    count(v.id)
  from public.sondage_choix c
  left join public.sondage_votes v on v.choix_id = c.id
  where c.sondage_id = any (p_sondage_ids)
  group by c.sondage_id, c.id, c.libelle, c.position
  order by c.sondage_id, c.position, c.libelle;
$$;

revoke all on function public.sondage_resultats(uuid[]) from public, authenticated;
grant execute on function public.sondage_resultats(uuid[]) to anon;


--  ---------------------------------------------------------------------------
--  `voter()` — déposer un vote
--  ---------------------------------------------------------------------------
--  Refuse un sondage clos ou fermé. Refuse un choix qui n'appartient pas au
--  sondage. Ignore un second vote du même appareil plutôt que d'échouer :
--  `on conflict do nothing` laisse la première réponse en place et rend la
--  fonction idempotente — un parent qui appuie deux fois, ou dont la connexion
--  vacille et dont la requête est rejouée, ne casse rien.
--
--  Renvoie `true` si le vote a été enregistré, `false` s'il existait déjà.
create or replace function public.voter(
  p_sondage_id uuid,
  p_choix_id   uuid,
  p_votant_id  uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere boolean;
begin
  if not exists (
    select 1
      from public.sondages s
     where s.id = p_sondage_id
       and s.ouvert
       and (s.cloture_le is null or s.cloture_le > now())
  ) then
    raise exception 'Ce sondage est fermé.' using errcode = '22023';
  end if;

  insert into public.sondage_votes (sondage_id, choix_id, votant_id)
  values (p_sondage_id, p_choix_id, p_votant_id)
  on conflict (sondage_id, votant_id) do nothing;

  v_insere := found;
  return v_insere;
end;
$$;

revoke all on function public.voter(uuid, uuid, uuid) from public, authenticated;
grant execute on function public.voter(uuid, uuid, uuid) to anon;


--  ---------------------------------------------------------------------------
--  `envoyer_message()` — déposer un message pour le bureau
--  ---------------------------------------------------------------------------
--  La cadence est contrôlée ici, en base, et non dans l'application : c'est le
--  seul endroit qu'un client modifié ne peut pas contourner.
--
--  Trois dépôts par quart d'heure et par appareil. Le seuil est volontairement
--  bas — un parent qui signale un vrai problème écrit un message, rarement
--  trois — et il est vérifié sur `appareil_id`, fourni par le client. Un
--  utilisateur déterminé peut donc le contourner en changeant d'identifiant.
--  C'est assumé : l'objectif est d'arrêter l'inondation automatique, pas un
--  adversaire. La protection réelle contre un message malveillant isolé est
--  humaine — le bureau lit ce qui arrive, et peut le supprimer.
create or replace function public.envoyer_message(
  p_sujet       text,
  p_corps       text,
  p_categorie   public.message_categorie,
  p_reponse_a   text,
  p_appareil_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recents integer;
  v_id      uuid;
begin
  select count(*)
    into v_recents
    from public.messages m
   where m.appareil_id = p_appareil_id
     and m.created_at > now() - interval '15 minutes';

  if v_recents >= 3 then
    raise exception 'Trop de messages envoyés coup sur coup. Merci de réessayer dans quelques minutes.'
      using errcode = '22023';
  end if;

  insert into public.messages (sujet, corps, categorie, reponse_a, appareil_id)
  values (
    btrim(p_sujet),
    btrim(p_corps),
    coalesce(p_categorie, 'autre'),
    nullif(btrim(coalesce(p_reponse_a, '')), ''),
    p_appareil_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.envoyer_message(text, text, public.message_categorie, text, uuid) from public, authenticated;
grant execute on function public.envoyer_message(text, text, public.message_categorie, text, uuid) to anon;


-- =============================================================================
--  7. Row Level Security
-- =============================================================================
--  Fermé par défaut : sans politique correspondante, une opération est
--  refusée. C'est le bon sens de l'erreur — un oubli rend une fonctionnalité
--  inaccessible et se voit immédiatement, plutôt que d'ouvrir une table à tout
--  le monde sans que rien ne le signale.

alter table public.annonces        enable row level security;
alter table public.cantine_menus   enable row level security;
alter table public.agenda_events   enable row level security;
alter table public.documents       enable row level security;
alter table public.sondages        enable row level security;
alter table public.sondage_choix   enable row level security;
alter table public.sondage_votes   enable row level security;
alter table public.messages        enable row level security;

--  Contenu : lecture publique. C'est tout l'objet de l'application — un parent
--  doit pouvoir consulter les actualités, les menus et l'agenda sans rien
--  installer d'autre ni créer de compte.
--
--  Aucune politique d'écriture n'est déclarée, et c'est délibéré : le rôle
--  `anon` ne peut donc ni insérer, ni modifier, ni supprimer. Le bureau publie
--  avec la clé `service_role`, qui ignore la RLS. Ajouter un `for insert to
--  anon` ici ouvrirait la publication à quiconque possède la clé publique,
--  c'est-à-dire à quiconque a installé l'application.
create policy annonces_lecture_publique
  on public.annonces for select
  to anon
  using (true);

create policy cantine_menus_lecture_publique
  on public.cantine_menus for select
  to anon
  using (true);

create policy agenda_events_lecture_publique
  on public.agenda_events for select
  to anon
  using (true);

create policy documents_lecture_publique
  on public.documents for select
  to anon
  using (true);

--  Un sondage fermé reste lisible : un parent doit pouvoir consulter le
--  résultat de ce à quoi il a répondu. C'est `voter()` qui refuse d'enregistrer
--  un vote sur un sondage clos, pas la lecture qui le cache.
create policy sondages_lecture_publique
  on public.sondages for select
  to anon
  using (true);

create policy sondage_choix_lecture_publique
  on public.sondage_choix for select
  to anon
  using (true);

--  ---------------------------------------------------------------------------
--  sondage_votes et messages : AUCUNE politique
--  ---------------------------------------------------------------------------
--  Ces deux tables ne reçoivent volontairement aucune politique pour `anon`.
--  La RLS étant active et aucune politique ne s'appliquant, tout accès direct
--  est refusé — lecture comme écriture.
--
--  Les deux seules opérations légitimes passent par `voter()` et
--  `envoyer_message()`, qui s'exécutent avec les droits du propriétaire.
--
--  L'intérêt n'est pas seulement d'interdire l'écriture : c'est aussi
--  d'interdire la LECTURE. Sans cela, n'importe qui pourrait lire les messages
--  adressés au bureau — dont certains signalent une situation personnelle — et
--  la liste des identifiants de votants. La confidentialité des échanges repose
--  sur cette absence de politique.
--
--  Ne pas ajouter de `for select to anon` ici « pour afficher les résultats » :
--  `sondage_resultats()` existe pour cela, et ne renvoie que des compteurs.


-- =============================================================================
--  8. Privilèges
-- =============================================================================
--  Supabase accorde par défaut les privilèges sur les nouvelles tables du
--  schéma `public` aux rôles `anon` et `authenticated`. Les politiques ne
--  suffisent donc pas : un privilège accordé sans politique ne donne rien, mais
--  l'inverse — une politique sans privilège — est un piège à retardement, car
--  un changement de réglage côté plateforme suffirait à ouvrir l'accès.
--
--  On écrit donc les deux, explicitement, table par table. La règle est
--  vérifiable d'un coup d'œil : chaque table est révoquée, puis seules les
--  lectures nécessaires sont rendues.
--
--  `authenticated` ne reçoit RIEN : cette application n'a pas de connexion, et
--  l'absence de privilège rend le rôle inopérant même si quelqu'un obtenait un
--  jeton de session par un autre moyen.

revoke all on public.annonces      from anon, authenticated;
revoke all on public.cantine_menus from anon, authenticated;
revoke all on public.agenda_events from anon, authenticated;
revoke all on public.documents     from anon, authenticated;
revoke all on public.sondages      from anon, authenticated;
revoke all on public.sondage_choix from anon, authenticated;
revoke all on public.sondage_votes from anon, authenticated;
revoke all on public.messages      from anon, authenticated;

grant select on public.annonces      to anon;
grant select on public.cantine_menus to anon;
grant select on public.agenda_events to anon;
grant select on public.documents     to anon;
grant select on public.sondages      to anon;
grant select on public.sondage_choix to anon;

--  Ni `select` ni `insert` sur `sondage_votes` et `messages` : tout passe par
--  les fonctions de la section 6, qui n'ont besoin d'aucun privilège d'appelant
--  puisqu'elles s'exécutent en `security definer`.


-- =============================================================================
--  9. Stockage des documents
-- =============================================================================
--  Le bucket est PUBLIC en lecture : un parent doit pouvoir ouvrir un PDF sans
--  compte. Les documents publiés ici sont des documents scolaires destinés à
--  toutes les familles — menus, calendriers, formulaires — et non des pièces
--  individuelles. Un document nominatif n'a rien à y faire : il doit être
--  transmis par un autre canal.
--
--  Aucune politique d'écriture : le bureau dépose les fichiers depuis le
--  tableau de bord, qui utilise la clé `service_role`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,
  20971520, -- 20 Mo : au-delà, le téléchargement sur un forfait mobile devient
            -- pénible, et un document scolaire n'a pas besoin de plus.
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do nothing;

create policy documents_storage_lecture_publique
  on storage.objects for select
  to anon
  using (bucket_id = 'documents');
