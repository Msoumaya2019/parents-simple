-- =============================================================================
--  Membres du bureau : ouvrir l'écriture à quelques personnes nommées
-- =============================================================================
--
--  POURQUOI CETTE MIGRATION EXISTE
--  -------------------------------
--  Jusqu'ici, personne ne pouvait écrire depuis l'extérieur : les huit tables
--  étaient révoquées pour `anon` comme pour `authenticated`, et le bureau
--  publiait depuis le tableau de bord, qui se sert de la clé `service_role`.
--
--  Cette migration ouvre une seconde voie, pour que le bureau publie depuis une
--  page web au lieu d'un tableur technique. Elle doit le faire sans relâcher ce
--  qui protège l'application.
--
--  LE PIÈGE, ET IL EST GROS
--  ------------------------
--  La tentation est d'accorder l'écriture au rôle `authenticated` et de
--  s'arrêter là. Ce serait une faille : Supabase autorise par défaut
--  l'inscription publique. N'importe qui pourrait créer un compte par
--  `/auth/v1/signup`, devenir `authenticated`, et publier sur l'application de
--  l'école. Le rôle seul ne dit pas *qui* est la personne, seulement qu'elle a
--  un jeton signé par le projet.
--
--  L'autorité est donc une LISTE NOMINATIVE : `membres_bureau`. Une politique
--  n'accorde rien parce que la personne est connectée, mais parce que son
--  identifiant figure dans cette liste. Deux verrous plutôt qu'un, et le
--  second — désactiver l'inscription publique dans le tableau de bord — est
--  documenté dans `docs/05-administration.md`. Le verrou qui compte ici est
--  celui de la base : il tient même si quelqu'un rallume l'inscription.
--
--  AUCUNE CLÉ À PRIVILÈGES N'EST NÉCESSAIRE
--  ----------------------------------------
--  La page d'administration se sert de la clé publishable, celle qui est déjà
--  publique dans l'application mobile, plus la session de la personne
--  connectée. La clé `service_role` n'a pas à quitter le tableau de bord, et
--  c'est une bonne nouvelle : elle n'a donc aucun endroit où fuiter.
-- =============================================================================


-- =============================================================================
--  1. La liste nominative
-- =============================================================================
--  `on delete cascade` sur `auth.users` : supprimer un compte retire son
--  autorisation. L'oublier laisserait une ligne pointant vers un identifiant
--  qui n'existe plus — inoffensif, mais un compte recréé avec le même
--  identifiant hériterait des droits sans que personne ne s'en aperçoive.
--
--  `courriel` est recopié pour que la liste reste lisible par un humain. Il
--  n'est pas la clé : deux comptes peuvent porter le même courriel dans des
--  circonstances exceptionnelles, et surtout une personne peut changer
--  d'adresse. La clé est `user_id`, qui ne change jamais.
create table public.membres_bureau (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  courriel   text not null,
  ajoute_le  timestamptz not null default now(),

  constraint membres_bureau_courriel_valide check (char_length(btrim(courriel)) between 3 and 320)
);

comment on table public.membres_bureau is
  'Les personnes autorisées à publier depuis la page d''administration. L''autorité est cette liste, jamais le seul fait d''être connecté.';

--  RLS active, et AUCUNE politique : la table est donc muette pour tout le
--  monde par l'API. C'est délibéré. Un membre n'a pas besoin de lire la liste
--  pour publier une annonce, et une liste de noms et d'adresses n'a rien à
--  faire dans une réponse HTTP. Elle se consulte dans le tableau de bord.
--
--  Le piège : sans RLS, une table nouvellement créée dans `public` est
--  exposée en lecture par l'API REST de Supabase. `enable row level security`
--  n'est pas une formalité ici, c'est le contrôle.
alter table public.membres_bureau enable row level security;


-- =============================================================================
--  2. « Cette personne est-elle du bureau ? »
-- =============================================================================
--  Une seule fonction, appelée par toutes les politiques. Les écrire à la main
--  dans chacune reproduirait la même requête six fois, et une seule d'entre
--  elles écrite de travers suffirait à ouvrir une table.
--
--  `security definer` est NÉCESSAIRE, et pas décoratif : la table ci-dessus
--  n'accorde rien à `authenticated`. Sans `security definer`, la fonction
--  s'exécuterait avec les droits de l'appelant, ne verrait aucune ligne, et
--  répondrait `false` à tout le monde — y compris aux membres du bureau. Le
--  symptôme serait « personne ne peut publier », et la cause serait invisible.
--
--  `set search_path = ''` : une fonction `security definer` s'exécute avec les
--  droits de son propriétaire. Si elle résolvait ses noms de tables par le
--  `search_path` de l'appelant, un schéma placé devant `public` détournerait
--  la requête vers une table factice. On qualifie donc tout, et on vide le
--  chemin de recherche pour que rien ne puisse s'y glisser.
create or replace function public.est_membre_bureau()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.membres_bureau m
     where m.user_id = auth.uid()
  );
$$;

comment on function public.est_membre_bureau() is
  'Vrai si la personne connectée figure dans la liste du bureau. Appelée par toutes les politiques d''écriture, et par la page d''administration elle-même.';

--  Exécutable par les personnes connectées seulement. La page d'administration
--  l'appelle pour afficher un refus clair plutôt qu'un écran qui ne marche
--  pas — la même fonction que celle qui décide, donc l'écran et la base ne
--  peuvent pas être en désaccord.
--
--  `anon` n'en a pas besoin : un visiteur non connecté n'a rien à écrire, et
--  la fonction ne répondrait que `false`.
revoke all on function public.est_membre_bureau() from public, anon, authenticated;
grant execute on function public.est_membre_bureau() to authenticated;


-- =============================================================================
--  3. Inscrire une personne, en une ligne
-- =============================================================================
--  Le tableau de bord demande d'aller chercher un identifiant à la main dans
--  la liste des comptes, puis de le recopier. C'est exactement le genre de
--  manipulation où l'on se trompe d'une ligne et où l'on inscrit la mauvaise
--  personne. Cette fonction prend le courriel et fait la correspondance.
--
--  Elle N'EST ACCORDÉE À PERSONNE : ni `anon`, ni `authenticated`. Seul le
--  propriétaire de la base — le tableau de bord — peut l'appeler. Un membre du
--  bureau ne peut donc pas s'ajouter de collègue : c'est volontaire.
create or replace function public.ajouter_membre_bureau(p_courriel text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_connu   boolean;
begin
  select u.id
    into v_id
    from auth.users u
   where lower(u.email) = lower(btrim(p_courriel));

  if v_id is null then
    --  Message explicite : le cas courant est d'inscrire quelqu'un dont le
    --  compte n'a pas encore été créé. Dire « introuvable » ferait chercher
    --  une erreur de droits, qui n'existe pas.
    raise exception 'Aucun compte pour « % ». Créez d''abord la personne dans Authentication → Users.',
      btrim(p_courriel)
      using errcode = '22023';
  end if;

  select exists (select 1 from public.membres_bureau m where m.user_id = v_id)
    into v_connu;

  insert into public.membres_bureau (user_id, courriel)
  values (v_id, lower(btrim(p_courriel)))
  on conflict (user_id) do update set courriel = excluded.courriel;

  --  On rend la différence plutôt qu'un « c'est fait » uniforme : rejouer la
  --  même commande est sans effet, et l'annoncer évite de croire à une erreur.
  return case when v_connu then 'déjà membre' else 'ajouté' end;
end;
$$;

revoke all on function public.ajouter_membre_bureau(text) from public, anon, authenticated;


-- =============================================================================
--  4. Privilèges
-- =============================================================================
--  On reprend la règle de la migration initiale : chaque table est nommée, et
--  le privilège suit la politique. Un privilège accordé sans politique ne donne
--  rien, mais l'inverse — une politique sans privilège — est un piège à
--  retardement : un changement de réglage côté plateforme suffirait à l'ouvrir.
--
--  `anon` ne reçoit RIEN de plus qu'avant. C'est le point à vérifier d'un coup
--  d'œil : les lignes ci-dessous ne mentionnent que `authenticated`.

revoke all on public.membres_bureau from anon, authenticated;

grant select, insert, update, delete on public.annonces      to authenticated;
grant select, insert, update, delete on public.cantine_menus to authenticated;
grant select, insert, update, delete on public.agenda_events to authenticated;
grant select, insert, update, delete on public.documents     to authenticated;

--  `sondages` et `sondage_choix` sont ouverts aussi : créer un sondage et ses
--  réponses est un geste de bureau. `sondage_votes` et `messages` restent
--  fermés, délibérément — ce sont des données de parents, pas du contenu
--  publié. Le bureau les lit dans le tableau de bord.


-- =============================================================================
--  5. Politiques d'écriture
-- =============================================================================
--  `for all` couvre lecture, insertion, modification et suppression. Le bureau
--  a besoin des quatre : la page liste ce qui existe pour le corriger, et une
--  faute de frappe publiée doit pouvoir être retirée.
--
--  `using` filtre les lignes visibles et modifiables ; `with check` filtre ce
--  qui peut être écrit. Les deux portent la même condition, et ce n'est pas une
--  redondance : `using` seul laisserait un membre réécrire une ligne pour
--  contourner la condition — sans objet ici, mais la règle vaut d'être tenue.
--
--  Toutes visent `to authenticated`. Aucune ne vise `anon` : c'est la
--  propriété que `scripts/verifier-securite-api.mjs` éprouve contre la base
--  réelle, et qui échouerait si quelqu'un en ajoutait une par mégarde.

create policy annonces_bureau
  on public.annonces for all to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());

create policy cantine_menus_bureau
  on public.cantine_menus for all to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());

create policy agenda_events_bureau
  on public.agenda_events for all to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());

create policy documents_bureau
  on public.documents for all to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());

create policy sondages_bureau
  on public.sondages for all to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());

create policy sondage_choix_bureau
  on public.sondage_choix for all to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());


-- =============================================================================
--  6. Stockage
-- =============================================================================
--  Publier une annonce avec une photo, ou déposer un PDF, écrit dans
--  `storage.objects` — une table comme une autre, soumise à ses propres
--  politiques. Sans ces deux politiques, le formulaire échouerait à l'envoi du
--  fichier alors que l'enregistrement de la ligne aurait réussi : une annonce
--  publiée avec une image introuvable, et rien dans les journaux pour le dire.
--
--  La condition sur `bucket_id` borne le droit aux deux compartiments de
--  contenu. Sans elle, un membre du bureau pourrait écrire dans n'importe quel
--  compartiment du projet, y compris ceux qu'on ajouterait plus tard.

create policy annonces_storage_bureau
  on storage.objects for all to authenticated
  using (bucket_id = 'annonces' and public.est_membre_bureau())
  with check (bucket_id = 'annonces' and public.est_membre_bureau());

create policy documents_storage_bureau
  on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.est_membre_bureau())
  with check (bucket_id = 'documents' and public.est_membre_bureau());
