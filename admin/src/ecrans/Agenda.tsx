import { useState, type FormEvent } from 'react';

import { Avis, Bouton, Case, Carte, Champ, ZoneTexte } from '../components/ui';
import { BORNES, ordreDesDatesValide } from '../lib/bornes';
import { useChargement } from '../lib/chargement';
import type { Client } from '../lib/client';
import {
  creerEvenement,
  listerEvenements,
  modifierEvenement,
  supprimerEvenement,
} from '../lib/contenu';
import { formaterDate, versInstant, versLocal } from '../lib/dates';
import { messageDe } from '../lib/erreurs';
import type { EvenementAgenda } from '../lib/types';

/**
 * Les dates de l'agenda.
 *
 * Les deux champs de date sont des `datetime-local`, donc des heures LOCALES.
 * `versInstant` les convertit en instants absolus avant l'envoi, et `versLocal`
 * fait le chemin inverse au préremplissage. Sans ces deux conversions, un
 * événement saisi à 20 h 30 apparaîtrait à 22 h 30 dans l'application — un
 * décalage silencieux, qu'on ne remarque qu'en comparant une montre à l'écran.
 */
export function Agenda({ client }: { readonly client: Client }) {
  const { etat, recharger } = useChargement('agenda', () => listerEvenements(client));
  const evenements = etat.statut === 'succes' ? etat.donnees : null;

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [lieu, setLieu] = useState('');
  const [journeeEntiere, setJourneeEntiere] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const messageErreur = erreur ?? (etat.statut === 'erreur' ? etat.message : null);

  function reinitialiser() {
    setEnEdition(null);
    setTitre('');
    setDescription('');
    setDebut('');
    setFin('');
    setLieu('');
    setJourneeEntiere(false);
  }

  function charger(evenement: EvenementAgenda) {
    setEnEdition(evenement.id);
    setTitre(evenement.titre);
    setDescription(evenement.description ?? '');
    setDebut(versLocal(evenement.debut_le));
    setFin(versLocal(evenement.fin_le));
    setLieu(evenement.lieu ?? '');
    setJourneeEntiere(evenement.journee_entiere);
    setSucces(null);
    setErreur(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(null);

    const titrePropre = titre.trim();
    if (titrePropre === '') {
      setErreur('Le titre de l’événement ne peut pas être vide.');
      return;
    }

    const debutInstant = versInstant(debut);
    if (debutInstant === null) {
      setErreur('Renseignez la date et l’heure de début.');
      return;
    }

    // La contrainte `agenda_ordre_valide` refuse une fin antérieure au début.
    // Le contrôle est refait ici pour dire pourquoi, plutôt que de laisser
    // remonter un message de Postgres qui parle de contrainte violée.
    if (!ordreDesDatesValide(debut, fin)) {
      setErreur('La fin ne peut pas être avant le début.');
      return;
    }

    const finInstant = fin.trim() === '' ? null : versInstant(fin);
    if (fin.trim() !== '' && finInstant === null) {
      setErreur('L’heure de fin n’a pas pu être lue. Vérifiez la saisie.');
      return;
    }

    const videOuTexte = (valeur: string) => {
      const propre = valeur.trim();
      return propre === '' ? null : propre;
    };

    const valeurs = {
      titre: titrePropre,
      description: videOuTexte(description),
      debut_le: debutInstant,
      fin_le: finInstant,
      lieu: videOuTexte(lieu),
      journee_entiere: journeeEntiere,
    };

    setEnCours(true);
    try {
      if (enEdition === null) {
        await creerEvenement(client, valeurs);
        setSucces('Événement ajouté à l’agenda.');
      } else {
        await modifierEvenement(client, enEdition, valeurs);
        setSucces('Événement modifié.');
      }
      reinitialiser();
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    } finally {
      setEnCours(false);
    }
  }

  async function retirer(evenement: EvenementAgenda) {
    const confirme = window.confirm(
      `Supprimer « ${evenement.titre} » de l’agenda ?\n\n` +
        'Il disparaîtra de l’application. Cette action ne peut pas être annulée.',
    );
    if (!confirme) {
      return;
    }

    setErreur(null);
    setSucces(null);
    try {
      await supprimerEvenement(client, evenement.id);
      if (enEdition === evenement.id) {
        reinitialiser();
      }
      setSucces('Événement supprimé.');
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    }
  }

  return (
    <>
      <Carte
        titre={enEdition === null ? 'Ajouter un événement' : 'Modifier l’événement'}
        aide="Les heures sont celles de votre ordinateur. L’application les affichera à la même heure."
      >
        {messageErreur !== null && <Avis ton="erreur" texte={messageErreur} />}
        {succes !== null && <Avis ton="succes" texte={succes} />}

        <form onSubmit={enregistrer}>
          <Champ
            libelle="Titre"
            valeur={titre}
            onChange={setTitre}
            maxLength={BORNES.titreEvenement.max}
            obligatoire
          />

          <div className="grille">
            <Champ
              libelle="Début"
              valeur={debut}
              onChange={setDebut}
              type="datetime-local"
              obligatoire
            />
            <Champ libelle="Fin" valeur={fin} onChange={setFin} type="datetime-local" />
          </div>

          <div className="grille">
            <Champ libelle="Lieu" valeur={lieu} onChange={setLieu} />
            <Case libelle="Journée entière" cochee={journeeEntiere} onChange={setJourneeEntiere} />
          </div>

          <ZoneTexte
            libelle="Description"
            valeur={description}
            onChange={setDescription}
            lignes={4}
          />

          <div className="actions">
            <Bouton type="submit" desactive={enCours || titre.trim() === '' || debut.trim() === ''}>
              {enCours ? 'Enregistrement…' : enEdition === null ? 'Ajouter' : 'Enregistrer'}
            </Bouton>
            {enEdition !== null && (
              <Bouton variante="discret" onClick={reinitialiser}>
                Annuler la modification
              </Bouton>
            )}
          </div>
        </form>
      </Carte>

      <Carte titre="Événements à venir et passés" aide="Du plus proche au plus lointain.">
        {evenements === null && <p className="vide">Chargement…</p>}
        {evenements !== null && evenements.length === 0 && (
          <p className="vide">Aucun événement pour le moment.</p>
        )}
        {evenements !== null && evenements.length > 0 && (
          <ul className="liste">
            {evenements.map((evenement) => (
              <li key={evenement.id}>
                <span>
                  <span className="titre">{evenement.titre}</span>{' '}
                  {evenement.journee_entiere && <span className="pastille">journée entière</span>}
                  <br />
                  <span className="details">
                    {formaterDate(evenement.debut_le, !evenement.journee_entiere)}
                    {evenement.fin_le !== null
                      ? ` → ${formaterDate(evenement.fin_le, !evenement.journee_entiere)}`
                      : ''}
                    {evenement.lieu !== null ? ` · ${evenement.lieu}` : ''}
                  </span>
                </span>
                <span className="actions">
                  <Bouton variante="discret" onClick={() => charger(evenement)}>
                    Modifier
                  </Bouton>
                  <Bouton variante="danger" onClick={() => void retirer(evenement)}>
                    Supprimer
                  </Bouton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </>
  );
}
