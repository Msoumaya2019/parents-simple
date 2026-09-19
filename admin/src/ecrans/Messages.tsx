import { useState } from 'react';

import { Avis, Bouton, Carte, Case } from '../components/ui';
import { lienMailto } from '../lib/adresse';
import { useChargement } from '../lib/chargement';
import { messageListeAbsente } from '../lib/message-liste';
import type { Client } from '../lib/client';
import { listerMessages, marquerMessageTraite } from '../lib/contenu';
import { formaterDate } from '../lib/dates';
import { messageDe } from '../lib/erreurs';
import { libelleCategorieMessage, type MessageParent } from '../lib/types';

/**
 * Les messages que des parents ont adressés au bureau.
 *
 * POURQUOI CET ÉCRAN EXISTE
 * -------------------------
 * La table `messages` était fermée à `anon` ET à `authenticated` : le seul
 * chemin de lecture était le tableau de bord Supabase. Or ce chemin demande un
 * compte ayant accès au PROJET — qui peut aussi modifier le schéma, lire toutes
 * les autres tables et changer les politiques. Lire un message de parent
 * coûtait donc bien plus que le nécessaire.
 *
 * `supabase/migrations/20260919140000_messages_bureau.sql` ouvre une voie
 * étroite, et cet écran est ce qu'elle ouvre. La clé publique, elle, ne lit
 * toujours rien.
 *
 * CE QUE CET ÉCRAN NE FAIT PAS, ET POURQUOI
 * -----------------------------------------
 * Il ne supprime pas. La page de confidentialité promet que les messages
 * traités sont supprimés ; cette promesse reste tenue par une personne, depuis
 * le tableau de bord, et non par une case à cocher qu'on peut cliquer de
 * travers. Un bouton « supprimer » à côté d'une case « traité » est un geste
 * qu'on déclenche par erreur, et rien ne le rattrape.
 *
 * ET IL LE DIT, SINON IL MENT. Refuser le bouton ne suffit pas : cocher
 * « traité » ferme le traitement, et la promesse attache la suppression à ce
 * moment précis. Un écran muet ferait donc croire le travail fini à qui vient
 * de cocher — d'autant plus que la suppression était, avant cet écran, à portée
 * de clic dans le Table Editor, où l'on marquait « traité ». L'aide de la carte
 * et le message de confirmation le rappellent donc, à l'instant où le membre du
 * bureau croit avoir terminé.
 *
 * Il ne répond pas non plus : le bureau répond depuis sa propre boîte, à
 * l'adresse que le parent a laissée — quand il en a laissé une.
 *
 * L'ORDRE DE LA LISTE EST UNE DÉCISION, PAS UN DÉTAIL
 * ---------------------------------------------------
 * `listerMessages` met les non traités en tête, puis les plus récents. Trier
 * par date seule enterrerait un message ancien jamais traité sous dix messages
 * récents déjà lus — et c'est exactement celui qu'il ne faut pas perdre. Le
 * compteur en tête d'écran dit la même chose en un mot.
 */
export function Messages({ client }: { readonly client: Client }) {
  const { etat, recharger } = useChargement('messages', () => listerMessages(client));
  const messages = etat.statut === 'succes' ? etat.donnees : null;

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const messageErreur = erreur ?? (etat.statut === 'erreur' ? etat.message : null);
  const nonTraites = messages === null ? null : messages.filter((m) => !m.traite).length;

  async function basculer(message: MessageParent, traite: boolean) {
    setErreur(null);
    setSucces(null);
    setEnCours(message.id);

    try {
      await marquerMessageTraite(client, message.id, traite);
      setSucces(
        traite
          ? 'Message marqué comme traité. Il reste à le supprimer depuis le tableau de bord.'
          : 'Message remis dans la pile des messages à traiter.',
      );
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <Carte
      titre="Messages reçus"
      aide="Ce que des parents ont écrit depuis l’application. Les messages non traités sont en tête. Un message traité reste à supprimer depuis le tableau de bord Supabase : la page de confidentialité promet sa suppression aux parents."
    >
      {messageErreur !== null && <Avis ton="erreur" texte={messageErreur} />}
      {succes !== null && <Avis ton="succes" texte={succes} />}

      {/*
        Ce rappel n'est pas décoratif. La migration qui ouvre cette lecture est
        appliquée À LA MAIN, dans l'éditeur SQL : le jour de la mise en service,
        cet écran échouera, et la cause la plus probable n'est pas dans le code.
        Sans cette phrase, le bureau lit un message de Postgres parlant de
        relation inexistante et n'a aucun moyen de savoir quoi faire.
      */}
      {etat.statut === 'erreur' && (
        <p className="aide">
          Si ce message apparaît juste après la mise en service, la migration{' '}
          <code>20260919140000_messages_bureau.sql</code> n’a probablement pas encore été appliquée.
          Voir <code>docs/05-administration.md</code>.
        </p>
      )}

      {nonTraites !== null && (
        <p className="compteur">
          {nonTraites === 0
            ? 'Tous les messages sont traités.'
            : `${nonTraites} message${nonTraites > 1 ? 's' : ''} à traiter.`}
        </p>
      )}

      {messages === null && <p className="vide">{messageListeAbsente(etat)}</p>}

      {messages !== null && messages.length === 0 && (
        <p className="vide">Aucun message reçu pour le moment.</p>
      )}

      {messages !== null && messages.length > 0 && (
        <ul className="messages">
          {messages.map((message) => (
            <li key={message.id} className={message.traite ? 'traite' : undefined}>
              <div className="message-entete">
                <span className="message-sujet">{message.sujet}</span>
                <span className="details">
                  <span className="pastille">{libelleCategorieMessage(message.categorie)}</span>{' '}
                  {formaterDate(message.created_at, true)}
                </span>
              </div>

              {/*
                `pre-wrap` n'est pas un détail de style : sans lui, les retours
                à la ligne du parent disparaissent et son message devient un
                pavé. Un parent qui écrit trois points sur trois lignes a
                écrit trois points, pas une phrase.
              */}
              <p className="message-corps">{message.corps}</p>

              <div className="message-pied">
                {message.reponse_a === null ? (
                  <span className="message-sans-reponse">
                    Aucune adresse de réponse : ce parent n’en a pas laissé. Le bureau ne peut pas
                    lui écrire — à moins qu’il n’ait indiqué un moyen de le joindre dans son
                    message.
                  </span>
                ) : (
                  <span className="details">
                    Répondre à <a href={lienMailto(message.reponse_a)}>{message.reponse_a}</a>
                  </span>
                )}

                <span className="message-case">
                  <Case
                    libelle={message.traite ? 'Traité' : 'Marquer comme traité'}
                    cochee={message.traite}
                    desactive={enCours === message.id}
                    onChange={(cochee) => void basculer(message, cochee)}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/*
        Le rechargement est offert à la main, et pas seulement après une
        modification : deux membres du bureau peuvent avoir l'écran ouvert en
        même temps, et rien ne les prévient qu'un message vient d'arriver.
        Sans ce bouton, il faudrait recharger la page entière.
      */}
      {messages !== null && (
        <div className="actions">
          <Bouton variante="discret" onClick={recharger}>
            Recharger la liste
          </Bouton>
        </div>
      )}
    </Carte>
  );
}
