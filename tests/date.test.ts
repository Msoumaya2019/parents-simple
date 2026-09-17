/**
 * Tests des utilitaires de date.
 *
 * Ces fonctions sont testées en priorité parce qu'elles sont la principale
 * source de bogues invisibles de cette application : un décalage d'un jour ne
 * casse rien, ne lève aucune erreur, et ne se voit qu'en comparant l'écran au
 * calendrier réel — c'est-à-dire trop tard.
 *
 * Les tests construisent leurs dates avec `new Date(annee, mois, jour)`, donc
 * en heure locale. C'est délibéré : ils doivent passer de la même façon sur une
 * machine à Paris et sur un exécuteur d'intégration continue à UTC. Une date
 * écrite `new Date('2026-09-22')` serait lue comme minuit UTC et rendrait le
 * test dépendant du fuseau de la machine, ce qui est exactement le défaut que
 * ces tests doivent détecter.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dateLongue,
  decalerJours,
  depuis,
  estEnCours,
  estPasse,
  heure,
  jourCivilCourt,
  jourCivilLong,
  jourCourant,
  lundiDeLaSemaine,
  sondageFerme,
  tailleLisible,
  versJourCivil,
} from '@/utils/date';

describe('versJourCivil', () => {
  it('rend le jour local, sans conversion de fuseau', () => {
    // 22 septembre 2026 à 23 h 30, heure locale. Une conversion en UTC
    // produirait le 22 à 21 h 30 à Paris, mais le 23 à 01 h 30 en Nouvelle-
    // Calédonie. Le jour civil doit rester le 22 partout.
    assert.equal(versJourCivil(new Date(2026, 8, 22, 23, 30)), '2026-09-22');
  });

  it('complète le mois et le jour sur deux chiffres', () => {
    assert.equal(versJourCivil(new Date(2026, 0, 5)), '2026-01-05');
  });

  it('gère le passage à l’année suivante', () => {
    assert.equal(versJourCivil(new Date(2026, 11, 31)), '2026-12-31');
  });
});

describe('jourCourant', () => {
  it('accepte une date injectée, pour rester testable', () => {
    assert.equal(jourCourant(new Date(2026, 8, 22, 12, 0)), '2026-09-22');
  });
});

describe('lundiDeLaSemaine', () => {
  it('rend le même jour pour un lundi', () => {
    const lundi = lundiDeLaSemaine(new Date(2026, 8, 21));
    assert.equal(versJourCivil(lundi), '2026-09-21');
  });

  it('remonte au lundi pour un mercredi', () => {
    const lundi = lundiDeLaSemaine(new Date(2026, 8, 23));
    assert.equal(versJourCivil(lundi), '2026-09-21');
  });

  it('rattache le dimanche à la semaine qui se termine, et non à celle qui commence', () => {
    // 27 septembre 2026 est un dimanche. Le cas est le plus important du lot :
    // avec la formule naïve `jour - 1`, le dimanche serait rattaché au lundi
    // 28, et l'écran de la cantine afficherait « cette semaine » avec les menus
    // de la semaine suivante — au moment précis où les parents préparent la
    // semaine.
    const dimanche = new Date(2026, 8, 27);
    assert.equal(dimanche.getDay(), 0, 'prémisse : la date choisie est un dimanche');

    const lundi = lundiDeLaSemaine(dimanche);
    assert.equal(versJourCivil(lundi), '2026-09-21');
  });

  it('franchit correctement une fin de mois', () => {
    // 1er octobre 2026 est un jeudi : le lundi de sa semaine est en septembre.
    const lundi = lundiDeLaSemaine(new Date(2026, 9, 1));
    assert.equal(versJourCivil(lundi), '2026-09-28');
  });

  it('ne conserve pas l’heure de la date d’origine', () => {
    const lundi = lundiDeLaSemaine(new Date(2026, 8, 23, 18, 45));
    assert.equal(lundi.getHours(), 0);
    assert.equal(lundi.getMinutes(), 0);
  });
});

describe('decalerJours', () => {
  it('avance d’un jour', () => {
    assert.equal(versJourCivil(decalerJours(new Date(2026, 8, 22), 1)), '2026-09-23');
  });

  it('franchit une fin de mois', () => {
    assert.equal(versJourCivil(decalerJours(new Date(2026, 8, 30), 1)), '2026-10-01');
  });

  it('franchit une fin d’année', () => {
    assert.equal(versJourCivil(decalerJours(new Date(2026, 11, 31), 1)), '2027-01-01');
  });

  it('recule de plusieurs semaines', () => {
    assert.equal(versJourCivil(decalerJours(new Date(2026, 8, 22), -14)), '2026-09-08');
  });

  it('gère l’heure d’été sans perdre un jour', () => {
    // Le 25 octobre 2026, la France repasse à l'heure d'hiver. Un décalage
    // calculé en millisecondes (24 × 3600 × 1000) ferait perdre ou gagner une
    // heure, et parfois un jour selon l'heure de départ.
    assert.equal(versJourCivil(decalerJours(new Date(2026, 9, 24), 1)), '2026-10-25');
    assert.equal(versJourCivil(decalerJours(new Date(2026, 9, 26), -1)), '2026-10-25');
  });
});

describe('jourCivilLong et jourCivilCourt', () => {
  it('nomme le jour et le mois en français', () => {
    assert.equal(jourCivilLong('2026-09-22'), 'mardi 22 septembre');
    assert.equal(jourCivilCourt('2026-09-22'), 'mar. 22 sept.');
  });

  it('ne décale pas la date en la lisant', () => {
    // Le 1er janvier est le cas le plus exposé : une lecture en UTC le
    // ramènerait au 31 décembre dans tout fuseau en retard sur Greenwich.
    assert.equal(jourCivilLong('2026-01-01'), 'jeudi 1 janvier');
  });

  it('rend une chaîne vide sur une entrée mal formée', () => {
    assert.equal(jourCivilLong('22/09/2026'), '');
    assert.equal(jourCivilCourt(''), '');
  });
});

describe('dateLongue et heure', () => {
  it('formate un instant dans le fuseau local', () => {
    // Construit en heure locale, puis relu : la conversion doit être neutre.
    const instant = new Date(2026, 8, 22, 18, 30).toISOString();
    assert.equal(dateLongue(instant), 'mardi 22 septembre 2026');
    assert.equal(heure(instant), '18 h 30');
  });

  it('omet les minutes quand elles sont nulles', () => {
    assert.equal(heure(new Date(2026, 8, 22, 18, 0).toISOString()), '18 h');
  });

  it('rend une chaîne vide sur une entrée invalide', () => {
    assert.equal(dateLongue('pas une date'), '');
    assert.equal(heure(''), '');
  });
});

describe('estPasse et estEnCours', () => {
  const maintenant = new Date(2026, 8, 22, 19, 0);

  it('considère un événement terminé comme passé', () => {
    const debut = new Date(2026, 8, 22, 18, 0).toISOString();
    const fin = new Date(2026, 8, 22, 18, 30).toISOString();
    assert.equal(estPasse(debut, fin, maintenant), true);
    assert.equal(estEnCours(debut, fin, maintenant), false);
  });

  it('considère un événement en cours comme non passé', () => {
    const debut = new Date(2026, 8, 22, 18, 0).toISOString();
    const fin = new Date(2026, 8, 22, 20, 0).toISOString();
    assert.equal(estPasse(debut, fin, maintenant), false);
    assert.equal(estEnCours(debut, fin, maintenant), true);
  });

  it('marque passé un événement sans heure de fin dès que son début est dépassé', () => {
    // Sans heure de fin, on ignore si l'événement dure encore. La règle retenue
    // est celle du début : passé 18 h, l'événement de 18 h quitte la liste des
    // « à venir ». Il n'est jamais marqué « en cours » pour autant — afficher
    // « en ce moment » pour un événement dont on ignore la fin serait une
    // affirmation que l'application n'est pas en mesure de soutenir.
    const debut = new Date(2026, 8, 22, 18, 0).toISOString();
    assert.equal(estPasse(debut, null, maintenant), true);
    assert.equal(estEnCours(debut, null, maintenant), false);
  });

  it('ne marque ni passé ni en cours un événement sans fin encore à venir', () => {
    const debut = new Date(2026, 8, 22, 20, 0).toISOString();
    assert.equal(estPasse(debut, null, maintenant), false);
    assert.equal(estEnCours(debut, null, maintenant), false);
  });
});

describe('sondageFerme', () => {
  const maintenant = new Date(2026, 8, 22, 12, 0);

  it('est fermé quand le bureau l’a fermé', () => {
    assert.equal(sondageFerme(false, null, maintenant), true);
  });

  it('est ouvert sans date de clôture', () => {
    assert.equal(sondageFerme(true, null, maintenant), false);
  });

  it('est fermé quand la date de clôture est dépassée', () => {
    const cloture = new Date(2026, 8, 21, 12, 0).toISOString();
    assert.equal(sondageFerme(true, cloture, maintenant), true);
  });

  it('reste ouvert avant la date de clôture', () => {
    const cloture = new Date(2026, 8, 23, 12, 0).toISOString();
    assert.equal(sondageFerme(true, cloture, maintenant), false);
  });

  it('est fermé à l’instant même de la clôture', () => {
    // La comparaison est inclusive : à l'heure dite, le sondage est clos. Un
    // `<` strict laisserait une seconde pendant laquelle l'écran proposerait un
    // vote que la base refuserait.
    const cloture = maintenant.toISOString();
    assert.equal(sondageFerme(true, cloture, maintenant), true);
  });
});

describe('depuis', () => {
  const maintenant = new Date(2026, 8, 22, 12, 0);

  it('nomme le jour même', () => {
    assert.equal(depuis(new Date(2026, 8, 22, 8, 0).toISOString(), maintenant), "aujourd'hui");
  });

  it('nomme la veille « hier », et non « il y a 1 jour »', () => {
    // Le seuil est vérifié explicitement : c'est le genre de condition qui
    // passe de « hier » à « il y a 1 jour » lors d'une refonte, sans que
    // personne ne s'en aperçoive avant de lire l'écran.
    assert.equal(depuis(new Date(2026, 8, 21, 20, 0).toISOString(), maintenant), 'hier');
  });

  it('compte en jours jusqu’à une semaine', () => {
    assert.equal(depuis(new Date(2026, 8, 19, 12, 0).toISOString(), maintenant), 'il y a 3 jours');
    assert.equal(depuis(new Date(2026, 8, 17, 12, 0).toISOString(), maintenant), 'il y a 5 jours');
  });

  it('bascule en semaines au-delà', () => {
    assert.equal(
      depuis(new Date(2026, 8, 15, 12, 0).toISOString(), maintenant),
      'il y a une semaine',
    );
    assert.equal(
      depuis(new Date(2026, 8, 8, 12, 0).toISOString(), maintenant),
      'il y a 2 semaines',
    );
  });

  it('affiche une date au-delà d’un mois', () => {
    assert.equal(depuis(new Date(2026, 6, 4, 12, 0).toISOString(), maintenant), '4 juillet 2026');
  });

  it('rend une chaîne vide sur une entrée invalide', () => {
    assert.equal(depuis('pas une date', maintenant), '');
  });
});

describe('tailleLisible', () => {
  it('rend une chaîne vide sans taille connue', () => {
    assert.equal(tailleLisible(null), '');
    assert.equal(tailleLisible(-1), '');
  });

  it('exprime les octets, kilo-octets et méga-octets', () => {
    assert.equal(tailleLisible(512), '512 o');
    assert.equal(tailleLisible(2048), '2 ko');
    assert.equal(tailleLisible(13_000_000), '12,4 Mo');
  });
});
