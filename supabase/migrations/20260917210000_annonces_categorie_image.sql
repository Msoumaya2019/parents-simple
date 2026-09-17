-- =============================================================================
--  annonces — catégorie et image
-- =============================================================================
--
--  POURQUOI CETTE MIGRATION EXISTE
--  -------------------------------
--  L'accueil doit présenter chaque actualité avec une pastille de catégorie et,
--  quand il y en a une, une image. Ni l'une ni l'autre n'existait : le fil ne
--  savait afficher qu'un titre, un texte et une date.
--
--  Ces deux informations viennent de la base, pas du code. Les écrire dans
--  l'application obligerait à publier une nouvelle version à chaque fois qu'une
--  actualité change de nature — ce qui est exactement ce que cette application
--  existe pour éviter.
--
--  POURQUOI UN TYPE ÉNUMÉRÉ ET NON UNE COLONNE LIBRE
--  -------------------------------------------------
--  `documents` et `messages` utilisent déjà un type énuméré pour leur
--  catégorie. Une colonne `text` libre laisserait passer « Cantine », « cantine »
--  et « CANTINE » comme trois catégories distinctes, et l'application afficherait
--  trois pastilles de couleurs différentes pour la même chose. Le type énuméré
--  rend la faute impossible à écrire.
--
--  POURQUOI LES INSTRUCTIONS SONT DÉFENSIVES
--  -----------------------------------------
--  Cette migration est recopiée à la main dans l'éditeur SQL du tableau de
--  bord. Un second passage — parce qu'on doute, parce que la fenêtre a été
--  rechargée — ne doit pas produire une erreur qui laisse croire à un échec
--  alors que tout est déjà en place. D'où `if not exists` partout où PostgreSQL
--  le permet, et un bloc `do` pour le type, qui n'a pas cette option.

--  ---------------------------------------------------------------------------
--  1. La catégorie
--  ---------------------------------------------------------------------------
--  `not null default 'actualite'` : les actualités déjà publiées reçoivent
--  « Actualité », qui est la valeur la plus honnête pour un texte dont on ne
--  sait rien d'autre. Une colonne nullable aurait obligé chaque écran à traiter
--  un cas « pas de catégorie » que personne ne sait afficher.

do $$
begin
  create type public.annonce_categorie as enum (
    'actualite',    -- information générale de l'école ou de l'association
    'cantine',      -- menus, allergènes, changements de service
    'agenda',       -- dates à retenir
    'a_venir',      -- ce qui va se passer, sans être encore daté à l'agenda
    'association'   -- la vie de l'association de parents
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.annonces
  add column if not exists categorie public.annonce_categorie not null default 'actualite';

comment on column public.annonces.categorie is
  'Nature de l''actualité. Décide de la pastille affichée sur l''accueil.';

--  ---------------------------------------------------------------------------
--  2. L'image
--  ---------------------------------------------------------------------------
--  Facultative, et c'est le cas normal : une actualité est le plus souvent du
--  texte. L'écran doit donc savoir se passer d'image, et non afficher un cadre
--  vide.
--
--  La colonne accepte DEUX FORMES, et c'est délibéré :
--
--    - une adresse complète (`https://…`), pour une image déjà en ligne — le
--      bureau peut alors coller un lien depuis le tableau de bord, sans rien
--      téléverser ;
--    - un chemin dans le compartiment `annonces` (par exemple
--      `photo-classe.jpg`), pour une image déposée depuis le tableau de bord.
--
--  `src/services/annonces.ts` distingue les deux par le préfixe `http`. Une
--  seule forme aurait été plus simple à décrire, mais elle aurait imposé un
--  téléversement pour publier une image que l'école met déjà à disposition
--  ailleurs.

alter table public.annonces
  add column if not exists image_url text;

alter table public.annonces
  drop constraint if exists annonces_image_url_valide;

alter table public.annonces
  add constraint annonces_image_url_valide
  check (image_url is null or char_length(btrim(image_url)) between 1 and 1000);

comment on column public.annonces.image_url is
  'Adresse complète, ou chemin dans le compartiment `annonces`. NULL quand l''actualité n''a pas d''image.';

--  ---------------------------------------------------------------------------
--  3. Le compartiment des images d'actualité
--  ---------------------------------------------------------------------------
--  Public en lecture, comme celui des documents : les adresses ne contiennent
--  aucun secret et peuvent être partagées telles quelles. Un compartiment privé
--  exigerait une signature par fichier, donc un serveur pour la délivrer — ce
--  que cette application n'a pas.
--
--  5 Mo et non 20 : une image d'actualité s'affiche sur quelques centimètres de
--  large. Au-delà de 5 Mo, on ne transporte plus de l'information mais des
--  pixels que personne ne verra, sur le forfait mobile d'un parent.
--
--  Aucune politique d'écriture : le bureau dépose les fichiers depuis le tableau
--  de bord, qui utilise la clé secrète.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'annonces',
  'annonces',
  true,
  5242880, -- 5 Mo
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]
)
on conflict (id) do nothing;

drop policy if exists annonces_storage_lecture_publique on storage.objects;

create policy annonces_storage_lecture_publique
  on storage.objects for select
  to anon
  using (bucket_id = 'annonces');
