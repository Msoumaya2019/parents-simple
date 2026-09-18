/**
 * Éprouve `refusDeDroit`, le contrôle qui décide si une écriture a été refusée.
 *
 * POURQUOI CE TEST EXISTE
 * -----------------------
 * `refusDeDroit` est un contrôle dont la défaillance serait SILENCIEUSE. S'il
 * répond « refusé » un peu trop volontiers, `npm run securite:api` passe au
 * vert en annonçant que le stockage est protégé — alors qu'il ne l'est peut-être
 * pas. Aucun message ne le dirait, et c'est précisément l'état dans lequel on
 * ne veut pas distribuer l'application.
 *
 * Le cas le plus dangereux est le 400. Le service de stockage de Supabase
 * répond 400 aussi bien pour un refus de droit que pour un type de fichier
 * refusé ou une charge utile mal formée. Accepter 400 sans lire le corps
 * rendrait le contrôle muet : il passerait même si les droits étaient grands
 * ouverts, pour peu que la requête soit mal formée. Ce test verrouille donc les
 * deux côtés — ce qui doit être reconnu comme un refus, et ce qui ne doit
 * surtout pas l'être.
 *
 * Ce test ne touche pas au réseau. Le fichier qu'il importe n'interroge la base
 * que s'il est lancé directement.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { refusDeDroit } from '../scripts/verifier-securite-api.mjs';

/** Le corps réellement renvoyé par le stockage, mesuré le 18 septembre 2026. */
const CORPS_STOCKAGE_REFUSE = {
  statusCode: '403',
  error: 'Unauthorized',
  message: 'new row violates row-level security policy',
  code: 'AccessDenied',
};

describe('refusDeDroit', () => {
  it('reconnaît un refus exprimé par le statut HTTP', () => {
    assert.equal(refusDeDroit(401, null), true);
    assert.equal(refusDeDroit(403, null), true);
  });

  it('reconnaît un refus porté par le corps, malgré un HTTP 400', () => {
    // C'est le cas réel du stockage : statut HTTP 400, refus dans le corps, et
    // `statusCode` écrit en CHAÎNE. Une comparaison stricte au nombre 403 ne
    // correspondrait jamais — c'est l'erreur qui a réellement été commise ici.
    assert.equal(refusDeDroit(400, CORPS_STOCKAGE_REFUSE), true);
  });

  it('accepte aussi `statusCode` écrit en nombre', () => {
    // Rien ne garantit que le service gardera la même sérialisation. Accepter
    // les deux formes évite qu'un changement de format fasse passer le contrôle
    // au vert sans qu'il ait rien vérifié.
    assert.equal(refusDeDroit(400, { ...CORPS_STOCKAGE_REFUSE, statusCode: 403 }), true);
  });

  it('ne prend PAS un type de fichier refusé pour un refus de droit', () => {
    // Mesuré : un témoin `text/plain` reçoit ceci AVANT que les droits soient
    // regardés. Le confondre avec un refus de droit ferait passer le contrôle
    // sans avoir rien éprouvé.
    const corps = {
      statusCode: '415',
      error: 'invalid_mime_type',
      message: 'mime type text/plain is not supported',
      code: 'InvalidMimeType',
    };
    assert.equal(refusDeDroit(400, corps), false);
  });

  it('ne prend PAS une charge utile mal formée pour un refus de droit', () => {
    assert.equal(refusDeDroit(400, { message: 'invalid input syntax for type uuid' }), false);
    assert.equal(refusDeDroit(400, 'Bad Request'), false);
    assert.equal(refusDeDroit(400, null), false);
  });

  it('ne prend PAS un succès pour un refus', () => {
    assert.equal(refusDeDroit(200, null), false);
    assert.equal(refusDeDroit(201, { statusCode: '200' }), false);
  });

  it('exige la mention du refus, pas seulement un code 403', () => {
    // Un corps qui porterait un code 403 sans dire « Unauthorized » ni
    // « AccessDenied » ne décrit pas un refus de droit. L'exiger évite qu'une
    // réponse inattendue soit prise pour une protection.
    assert.equal(refusDeDroit(400, { statusCode: '403', message: 'autre chose' }), false);
  });
});
