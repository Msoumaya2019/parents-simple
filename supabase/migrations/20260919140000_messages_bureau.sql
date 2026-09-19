-- =============================================================================
--  Messages des parents : les rendre lisibles au bureau, et à lui seul
-- =============================================================================
--
--  POURQUOI CETTE MIGRATION EXISTE
--  -------------------------------
--  `messages` n'a longtemps porté AUCUNE politique, et c'était délibéré : la
--  table contient ce que des parents écrivent au bureau, parfois sur une
--  situation personnelle. La fermer à `anon` protège un parent de l'autre.
--
--  Mais la table était fermée à `authenticated` AUSSI, si bien que le seul
--  chemin de lecture était le tableau de bord Supabase. Or ce chemin demande un
--  compte ayant accès au PROJET : qui peut ouvrir le Table Editor peut aussi
--  modifier le schéma, lire toutes les autres tables et changer les politiques.
--  Lire un message de parent demandait donc les clés du projet — bien plus que
--  le strict nécessaire, et à donner au plus petit nombre possible de personnes.
--
--  Cette migration ouvre une voie étroite : les personnes inscrites dans
--  `membres_bureau` lisent les messages depuis la page d'administration, avec
--  leur compte du bureau, sans aucun accès au projet Supabase.
--
--  CE QUI NE CHANGE PAS, ET C'EST L'ESSENTIEL
--  ------------------------------------------
--  La clé publique ne lit rien. `anon` ne reçoit toujours aucun privilège sur
--  cette table, et une seule politique mal écrite suffirait à tout ouvrir —
--  c'est pourquoi `scripts/check-sql.mjs` exige désormais, pour cette table,
--  que CHAQUE politique vise `authenticated` et porte la condition
--  d'appartenance. La sonde de `scripts/verifier-securite-api.mjs` continue de
--  vérifier, contre la base réelle, que la clé publique se fait refuser.
--
--  POURQUOI PAS DE `delete`
--  ------------------------
--  Le bureau marque un message traité, il ne l'efface pas. La suppression est
--  irréversible et ne se rattrape pas ; elle reste un geste du tableau de bord,
--  fait en connaissance de cause. La politique de confidentialité promet que
--  les messages traités sont supprimés — la promesse est tenue, mais par une
--  personne, pas par une case à cocher qui pourrait être cliquée de travers.
--
--  REJOUABLE, PARCE QU'ELLE EST APPLIQUÉE À LA MAIN
--  ------------------------------------------------
--  Comme les précédentes : collée dans l'éditeur SQL, sans historique. Un
--  `revoke` explicite, un `grant`, et un `drop policy if exists` avant chaque
--  `create policy` — rejouer une migration déjà appliquée est alors sans effet
--  au lieu de lever une erreur qui ferait croire à un échec.
-- =============================================================================


-- =============================================================================
--  1. Privilèges
-- =============================================================================
--  On reprend la règle des migrations précédentes : chaque table est nommée, et
--  le privilège suit la politique. Un privilège accordé sans politique ne donne
--  rien, mais l'inverse — une politique sans privilège — est un piège à
--  retardement : un changement de réglage côté plateforme suffirait à l'ouvrir.
--
--  Le `revoke` sur `anon` est écrit ici bien que la migration initiale le porte
--  déjà. Ce n'est pas une redondance de confort : c'est la ligne qu'un lecteur
--  pressé doit trouver pour se convaincre que la clé publique ne lit pas.

revoke all on public.messages from anon;

grant select, update on public.messages to authenticated;


-- =============================================================================
--  2. Politiques
-- =============================================================================
--  DEUX politiques, et non un `for all`. Le bureau lit et marque comme traité :
--  il n'insère pas (c'est `envoyer_message()`), et il ne supprime pas. Un
--  `for all` aurait exprimé un droit qu'on ne veut pas donner, et la ligne
--  aurait fini par être prise pour une autorisation.
--
--  La lecture n'a que `using` : PostgreSQL refuse `with check` sur un `for
--  select`, et il n'y a rien à vérifier sur ce qu'on lit.
--
--  La modification porte les DEUX clauses, avec la même condition. Ce n'est pas
--  une redondance : `using` décide des lignes visibles et modifiables,
--  `with check` décide de ce qui peut être écrit. N'en garder qu'une laisserait
--  passer la moitié du geste.
--
--  Les deux visent `authenticated`, jamais `anon`. `authenticated` s'obtient en
--  s'inscrivant — l'inscription publique est ouverte par défaut — donc le rôle
--  seul ne dit pas QUI agit. C'est `public.est_membre_bureau()` qui le dit, et
--  elle est exigée POSITIVE : `not public.est_membre_bureau()` la contiendrait
--  aussi, en refusant exactement les personnes qu'on veut autoriser.

drop policy if exists messages_bureau_lecture on public.messages;
create policy messages_bureau_lecture
  on public.messages for select to authenticated
  using (public.est_membre_bureau());

drop policy if exists messages_bureau_traitement on public.messages;
create policy messages_bureau_traitement
  on public.messages for update to authenticated
  using (public.est_membre_bureau())
  with check (public.est_membre_bureau());
