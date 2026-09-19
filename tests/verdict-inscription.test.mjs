/**
 * Éprouve `verdictSurInscription`, la règle qui décide si l'inscription est
 * fermée.
 *
 * POURQUOI CE TEST EXISTE
 * -----------------------
 * Cette règle décide si l'application peut être distribuée. Sa défaillance
 * serait silencieuse, et elle mentirait dans le sens le plus dangereux : un
 * `disable_signup` lu de travers, et le script annonce « inscription fermée »
 * alors qu'elle est ouverte — c'est-à-dire que n'importe qui obtient le rôle
 * `authenticated`, et que les politiques d'écriture du bureau ne tiennent plus
 * qu'à `est_membre_bureau()`.
 *
 * LE CAS QUI COMPTE LE PLUS EST CELUI OÙ L'ON NE SAIT PAS LIRE
 * -----------------------------------------------------------
 * Un champ absent, une réponse vide, un 404, une panne : dans tous ces cas, la
 * tentation est d'écrire `reglages.disable_signup === true`, qui répond `false`
 * — donc « ouverte ». Ce n'est pas faux, mais ce n'est pas mesuré non plus : le
 * script accuserait la base sur la foi d'une réponse qu'il n'a pas sue lire.
 *
 * Le projet a déjà payé ce défaut une fois, sous une autre forme : un contrôle
 * vert parce que l'objet était absent. Ici, le remède est un TROISIÈME verdict
 * — `inconnue` — que ce banc verrouille. Deux verdicts ne suffiraient pas, et
 * c'est précisément ce que le premier essai de ce test a montré.
 *
 * Ce test ne touche pas au réseau. Le fichier qu'il importe n'interroge la base
 * que s'il est lancé directement ; ce contrat d'import est tenu par
 * `tests/import-sans-configuration.test.mjs`, qui éprouve aussi ce script.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { verdictSurInscription } from '../scripts/verifier-inscription.mjs';

describe('verdictSurInscription', () => {
  it('déclare l’inscription fermée sur un `true` booléen', () => {
    assert.equal(verdictSurInscription(200, { disable_signup: true }), 'fermee');
  });

  it('déclare l’inscription ouverte sur un `false` booléen', () => {
    // L'état réellement mesuré le 20 septembre 2026.
    assert.equal(verdictSurInscription(200, { disable_signup: false }), 'ouverte');
  });

  it('rend « inconnue » sur un champ ABSENT, et non « ouverte »', () => {
    // Le cas qui a motivé le troisième verdict. Rendre `'ouverte'` ici serait
    // accuser la base sans l'avoir lue ; rendre `'fermee'` serait pire encore.
    assert.equal(verdictSurInscription(200, {}), 'inconnue');
    assert.equal(verdictSurInscription(200, { mailer_autoconfirm: false }), 'inconnue');
  });

  it('rend « inconnue » sur un statut autre que 200', () => {
    assert.equal(verdictSurInscription(404, { disable_signup: true }), 'inconnue');
    assert.equal(verdictSurInscription(500, { disable_signup: false }), 'inconnue');
    assert.equal(verdictSurInscription(401, null), 'inconnue');
  });

  it('rend « inconnue » sur une réponse qui n’est pas un objet', () => {
    assert.equal(verdictSurInscription(200, null), 'inconnue');
    assert.equal(verdictSurInscription(200, undefined), 'inconnue');
    assert.equal(verdictSurInscription(200, 'Forbidden'), 'inconnue');
  });

  it('n’accepte PAS la chaîne « true » comme une inscription fermée', () => {
    // Tolérer une sérialisation différente ferait passer le contrôle au vert le
    // jour où le service changerait de format, sans avoir rien vérifié. Échouer
    // bruyamment est le bon côté de l'erreur : on croira l'inscription ouverte,
    // on ira regarder, et on verra.
    assert.equal(verdictSurInscription(200, { disable_signup: 'true' }), 'inconnue');
    assert.equal(verdictSurInscription(200, { disable_signup: 1 }), 'inconnue');
  });
});
