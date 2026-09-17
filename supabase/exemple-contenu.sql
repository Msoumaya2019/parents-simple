-- =============================================================================
--  Contenu d'exemple — pour essayer l'application, pas pour la distribuer
-- =============================================================================
--
--  À QUOI ÇA SERT
--  --------------
--  Une base neuve est vide, et une application vide affiche cinq onglets vides.
--  Dans ce cas, impossible de distinguer « tout fonctionne, il n'y a rien à
--  montrer » de « quelque chose est cassé ». Ce fichier remplit chaque table de
--  quelques lignes réalistes, de quoi vérifier d'un coup d'œil que les cinq
--  onglets fonctionnent.
--
--  Il permet aussi d'éprouver le SEUL chemin que les contrôles automatiques ne
--  couvrent pas : voter à un sondage. Les contrôles n'éprouvent que les refus
--  (`voter` sur un sondage inexistant) ; le succès demande un sondage ouvert,
--  et c'est précisément ce que ce fichier crée.
--
--  CE QUE CE N'EST PAS
--  -------------------
--  Ce n'est PAS une migration. Il n'est pas dans `supabase/migrations/`, et
--  `npm run sql:check` ne le lit pas. Il ne s'applique jamais tout seul : c'est
--  vous qui le collez, et vous pouvez l'effacer ensuite.
--
--  COMMENT L'UTILISER
--  ------------------
--  1. tableau de bord Supabase → **SQL Editor** → **New query** ;
--  2. coller tout ce fichier ;
--  3. **Run**.
--
--  Le script peut être relancé sans dommage : chaque insertion porte
--  `on conflict do nothing`, donc une seconde exécution ne crée pas de doublon
--  et ne remplace rien que vous auriez modifié entre-temps.
--
--  POUR TOUT EFFACER
--  -----------------
--  Le bloc de nettoyage est à la fin, en commentaire. Le décommenter et
--  l'exécuter retire exactement les lignes de ce fichier, et rien d'autre.
--
--  LES DOCUMENTS, EUX, NE SONT PAS COMPLETS
--  ----------------------------------------
--  Les deux documents insérés décrivent des fichiers PDF qui n'existent pas
--  encore dans l'espace de stockage. La liste s'affichera, mais ouvrir un
--  document échouera — et l'application l'expliquera, plutôt que de faire
--  croire à un téléchargement en cours. Pour que les liens fonctionnent, il
--  faut déposer les fichiers dans le compartiment `documents` sous le nom
--  exact donné par `storage_path` (voir `docs/02-publier-du-contenu.md`).
-- =============================================================================


--  ---------------------------------------------------------------------------
--  Actualités — onglet Accueil
--  ---------------------------------------------------------------------------
--  `publiee_le` n'est pas fourni : la table le remplit avec la date du jour, ce
--  qui place ces actualités en tête du fil, du plus récent au plus ancien.
insert into public.annonces (id, titre, corps, epinglee, publiee_le) values
  (
    'a1000000-0000-4000-8000-000000000001',
    'Bienvenue sur l''application des parents',
    E'Cette application rassemble les informations utiles au quotidien : les actualités de l''école, les menus de la cantine, les dates à retenir, et un moyen simple de joindre le bureau de l''association.\n\nElle ne demande aucun compte et ne collecte rien sur vous. Vous pouvez la prêter à un autre parent sans rien laisser derrière vous.',
    true,
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Photo de classe : jeudi 24 septembre',
    E'La photo de classe aura lieu le jeudi 24 septembre au matin.\n\nLes enfants peuvent venir habillés comme ils le souhaitent. Les parents qui ne souhaitent pas que leur enfant soit photographié sont invités à le signaler à l''enseignant avant cette date.',
    false,
    now() - interval '2 days'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Menus de septembre en ligne',
    E'Les menus de la cantine pour la semaine du 21 septembre sont disponibles dans l''onglet Cantine.\n\nLes allergènes sont indiqués pour chaque plat. En cas de régime particulier, contactez le bureau de l''association depuis l''onglet Contact.',
    false,
    now() - interval '5 days'
  )
on conflict do nothing;


--  ---------------------------------------------------------------------------
--  Cantine — onglet Cantine
--  ---------------------------------------------------------------------------
--  Le mercredi est volontairement absent : beaucoup d'écoles n'ont pas classe
--  ce jour-là. Ajoutez la ligne si la vôtre en sert un.
--
--  `service_date` est un jour civil, sans heure ni fuseau : le menu du
--  21 septembre est celui du 21 septembre, quelle que soit l'heure à laquelle
--  on ouvre l'application.
insert into public.cantine_menus (id, service_date, entree, plat, dessert, allergenes, notes) values
  (
    'c1000000-0000-4000-8000-000000000001',
    '2026-09-21',
    'Salade de tomates',
    'Rôti de porc, haricots verts',
    'Yaourt nature',
    array['lait'],
    null
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    '2026-09-22',
    'Concombre vinaigrette',
    'Poisson pané, riz',
    'Compote de pommes',
    array['poisson', 'gluten'],
    null
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    '2026-09-24',
    'Betteraves',
    'Blanquette de volaille, purée',
    'Flan vanille',
    array['lait', 'oeuf'],
    'Repas froid possible sur demande'
  ),
  (
    'c1000000-0000-4000-8000-000000000004',
    '2026-09-25',
    'Melon',
    'Lasagnes, salade verte',
    'Fromage blanc',
    array['gluten', 'lait'],
    null
  )
on conflict do nothing;


--  ---------------------------------------------------------------------------
--  Agenda — onglet Agenda
--  ---------------------------------------------------------------------------
--  Les deux premiers événements portent un décalage explicite (+02:00) : la
--  France est à UTC+2 en septembre. Un décalage omis ferait dépendre l'heure
--  affichée du fuseau du serveur, et « 18 h » deviendrait « 16 h ».
insert into public.agenda_events (id, titre, description, debut_le, fin_le, lieu, journee_entiere) values
  (
    'e1000000-0000-4000-8000-000000000001',
    'Réunion de rentrée',
    'Présentation de l''année et des projets. Les questions sont bienvenues.',
    '2026-09-10T18:00:00+02:00',
    '2026-09-10T19:30:00+02:00',
    'Salle polyvalente',
    false
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'Photo de classe',
    null,
    '2026-09-24T09:00:00+02:00',
    '2026-09-24T11:00:00+02:00',
    'Cour de l''école',
    false
  ),
  (
    'e1000000-0000-4000-8000-000000000003',
    'Vacances de la Toussaint',
    'Reprise des cours le lundi 2 novembre au matin.',
    '2026-10-17T00:00:00+02:00',
    '2026-11-01T23:59:00+01:00',
    null,
    true
  )
on conflict do nothing;


--  ---------------------------------------------------------------------------
--  Documents — onglet Plus
--  ---------------------------------------------------------------------------
--  Rappel : les fichiers eux-mêmes ne sont pas créés par ce script. Tant qu'ils
--  ne sont pas déposés dans le compartiment `documents`, sous le nom exact de
--  `storage_path`, la liste s'affichera mais l'ouverture échouera — avec un
--  message, pas un écran vide.
insert into public.documents (id, titre, description, categorie, storage_path, taille_octets, publie_le) values
  (
    'd1000000-0000-4000-8000-000000000001',
    'Règlement intérieur 2026-2027',
    'Le règlement de l''école, tel qu''il a été voté en conseil d''école.',
    'administratif',
    'reglement-interieur-2026-2027.pdf',
    184320,
    now() - interval '10 days'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'Menus de la cantine — septembre',
    'Le calendrier complet des menus du mois.',
    'cantine',
    'menus-septembre-2026.pdf',
    96256,
    now() - interval '8 days'
  )
on conflict do nothing;


--  ---------------------------------------------------------------------------
--  Sondage — onglet Plus
--  ---------------------------------------------------------------------------
--  C'est ce sondage qui permet d'éprouver le seul chemin non couvert par les
--  contrôles automatiques : voter. Ouvrez l'onglet Plus, répondez, et vérifiez
--  que le décompte bouge.
--
--  Si le vote échoue, l'écran l'affiche en rouge sous la question — il ne reste
--  pas muet. C'est ce qui rend cette vérification manuelle acceptable en
--  attendant : le défaut serait appris tard, pas caché.
--
--  `cloture_le` est dans le futur, et `ouvert` vaut true : sans ces deux
--  conditions, la fonction refuserait le vote avec « Ce sondage est fermé ».
insert into public.sondages (id, question, precisions, ouvert, cloture_le) values
  (
    'b1000000-0000-4000-8000-000000000001',
    'Souhaitez-vous une sortie scolaire en novembre ?',
    'Le transport serait assuré par un car affrété. Merci de répondre avant le 15 octobre.',
    true,
    '2026-10-15T23:59:00+02:00'
  )
on conflict do nothing;

--  `position` fixe l'ordre d'affichage. C'est un simple numéro de colonne ici :
--  le mot n'a de sens réservé que dans une clause `returns table`, où il doit
--  être entre guillemets.
insert into public.sondage_choix (id, sondage_id, libelle, position) values
  (
    'f1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'Oui, avec plaisir',
    0
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'Non, pas cette fois',
    1
  ),
  (
    'f1000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'Je ne sais pas encore',
    2
  )
on conflict do nothing;


--  ---------------------------------------------------------------------------
--  Vérification
--  ---------------------------------------------------------------------------
--  Combien de lignes chaque table contient après l'opération.
select 'annonces' as table_, count(*) as lignes from public.annonces
union all select 'cantine_menus', count(*) from public.cantine_menus
union all select 'agenda_events', count(*) from public.agenda_events
union all select 'documents', count(*) from public.documents
union all select 'sondages', count(*) from public.sondages
union all select 'sondage_choix', count(*) from public.sondage_choix
order by table_;


--  ---------------------------------------------------------------------------
--  Nettoyage — à décommenter pour tout retirer
--  ---------------------------------------------------------------------------
--  Ces identifiants sont fixes, et n'appartiennent qu'à ce fichier : rien de ce
--  que vous avez saisi vous-même ne peut être effacé par ce bloc.
--
--  `sondage_choix` part avec son sondage (`on delete cascade`), mais les VOTES
--  partent aussi avec lui : si vous voulez voir combien de votes ce sondage
--  d'essai a reçus avant de le supprimer, interrogez `public.sondage_votes`
--  d'abord.
--
-- delete from public.sondage_votes where sondage_id = 'b1000000-0000-4000-8000-000000000001';
-- delete from public.sondages      where id = 'b1000000-0000-4000-8000-000000000001';
-- delete from public.documents     where id in ('d1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002');
-- delete from public.agenda_events where id in ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003');
-- delete from public.cantine_menus where id in ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000004');
-- delete from public.annonces      where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003');
