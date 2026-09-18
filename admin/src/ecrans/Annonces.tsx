import { useId, useState, type FormEvent } from 'react';

import { Avis, Bouton, Case, Carte, Champ, Choix, ZoneTexte } from '../components/ui';
import { BORNES } from '../lib/bornes';
import { useChargement } from '../lib/chargement';
import type { Client } from '../lib/client';
import {
  creerAnnonce,
  listerAnnonces,
  modifierAnnonce,
  supprimerAnnonce,
  televerserImage,
} from '../lib/contenu';
import { formaterDate } from '../lib/dates';
import { messageDe } from '../lib/erreurs';
import { CATEGORIES_ANNONCE, type Annonce, type CategorieAnnonce } from '../lib/types';

/**
 * Publier et corriger les annonces.
 *
 * L'écran tient le formulaire et la liste dans la même vue, sans page séparée :
 * le bureau publie en regardant ce qui existe déjà, ce qui évite de créer deux
 * fois la même annonce faute de l'avoir vue.
 */
export function Annonces({ client }: { readonly client: Client }) {
  const { etat, recharger } = useChargement('annonces', () => listerAnnonces(client));
  const annonces = etat.statut === 'succes' ? etat.donnees : null;

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [categorie, setCategorie] = useState<CategorieAnnonce>('actualite');
  const [epinglee, setEpinglee] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const idFichier = useId();

  // L'erreur du formulaire prime sur celle du chargement : si les deux sont
  // présentes, c'est celle que la personne vient de provoquer qui l'intéresse.
  const messageErreur = erreur ?? (etat.statut === 'erreur' ? etat.message : null);

  function reinitialiser() {
    setEnEdition(null);
    setTitre('');
    setCorps('');
    setCategorie('actualite');
    setEpinglee(false);
    setImageUrl('');
  }

  function commencerLaModification(annonce: Annonce) {
    setEnEdition(annonce.id);
    setTitre(annonce.titre);
    setCorps(annonce.corps);
    setCategorie(annonce.categorie);
    setEpinglee(annonce.epinglee);
    setImageUrl(annonce.image_url ?? '');
    setSucces(null);
    setErreur(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function envoyerImage(fichier: File | undefined) {
    if (fichier === undefined) {
      return;
    }

    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const chemin = await televerserImage(client, fichier);
      setImageUrl(chemin);
      setSucces(
        `Image envoyée. Elle sera rattachée à l’annonce à l’enregistrement. Nom dans le stockage : ${chemin}`,
      );
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(null);

    const titrePropre = titre.trim();
    const corpsPropre = corps.trim();

    if (titrePropre === '') {
      setErreur('Le titre ne peut pas être vide.');
      return;
    }
    if (corpsPropre === '') {
      setErreur('Le texte de l’annonce ne peut pas être vide.');
      return;
    }

    const valeurs = {
      titre: titrePropre,
      corps: corpsPropre,
      categorie,
      epinglee,
      image_url: imageUrl.trim() === '' ? null : imageUrl.trim(),
    };

    setEnvoiEnCours(true);
    try {
      if (enEdition === null) {
        await creerAnnonce(client, valeurs);
        setSucces('Annonce publiée. Elle est visible dans l’application.');
      } else {
        await modifierAnnonce(client, enEdition, valeurs);
        setSucces('Annonce modifiée.');
      }
      reinitialiser();
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function retirer(annonce: Annonce) {
    const confirme = window.confirm(
      `Supprimer définitivement l’annonce « ${annonce.titre} » ?\n\n` +
        'Elle disparaîtra de l’application. Cette action ne peut pas être annulée.',
    );
    if (!confirme) {
      return;
    }

    setErreur(null);
    setSucces(null);
    try {
      await supprimerAnnonce(client, annonce.id);
      if (enEdition === annonce.id) {
        reinitialiser();
      }
      setSucces('Annonce supprimée.');
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    }
  }

  /**
   * L'adresse d'où le navigateur ira chercher l'image.
   *
   * Une adresse complète est utilisée telle quelle ; un simple nom de fichier
   * est résolu dans le compartiment `annonces`. C'est la même règle que dans
   * l'application mobile, et elle permet de saisir l'un ou l'autre.
   */
  function adresseImage(valeur: string): string {
    if (/^https?:\/\//i.test(valeur)) {
      return valeur;
    }
    return client.storage.from('annonces').getPublicUrl(valeur).data.publicUrl;
  }

  return (
    <>
      <Carte
        titre={enEdition === null ? 'Publier une annonce' : 'Modifier l’annonce'}
        aide={
          enEdition === null
            ? 'Elle apparaîtra en haut de l’accueil de l’application.'
            : 'Modifiez ce qui doit l’être, puis enregistrez.'
        }
      >
        {messageErreur !== null && <Avis ton="erreur" texte={messageErreur} />}
        {succes !== null && <Avis ton="succes" texte={succes} />}

        <form onSubmit={enregistrer}>
          <Champ
            libelle="Titre"
            valeur={titre}
            onChange={setTitre}
            maxLength={BORNES.titreAnnonce.max}
            obligatoire
          />

          <ZoneTexte
            libelle="Texte de l’annonce"
            valeur={corps}
            onChange={setCorps}
            maxLength={BORNES.corpsAnnonce.max}
            lignes={9}
          />

          <div className="grille">
            <Choix
              libelle="Catégorie"
              valeur={categorie}
              onChange={setCategorie}
              options={CATEGORIES_ANNONCE}
            />
            <Case
              libelle="Épingler en tête de l’accueil"
              cochee={epinglee}
              onChange={setEpinglee}
            />
          </div>

          <div className="champ">
            <label htmlFor={idFichier}>Image d’illustration</label>
            <input
              id={idFichier}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(evenement) => {
                void envoyerImage(evenement.target.files?.[0]);
                // Le champ est vidé après l'envoi pour qu'un second choix du
                // MÊME fichier soit de nouveau signalé. Sans cela, le
                // navigateur ne déclenche aucun événement, et la personne croit
                // que rien ne s'est passé.
                evenement.target.value = '';
              }}
              disabled={envoiEnCours}
            />
            <span className="compte">
              Formats acceptés : JPEG, PNG, WebP, AVIF. L’image est déposée dans le stockage, puis
              rattachée à l’annonce à l’enregistrement.
            </span>
          </div>

          <Champ
            libelle="… ou adresse d’une image déjà en ligne"
            valeur={imageUrl}
            onChange={setImageUrl}
            maxLength={BORNES.adresseImage.max}
            aide="Laissez vide si vous avez choisi un fichier ci-dessus."
          />

          {imageUrl.trim() !== '' && (
            <p>
              <img
                src={adresseImage(imageUrl.trim())}
                alt="Aperçu de l’image de l’annonce"
                style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8 }}
              />
            </p>
          )}

          <div className="actions">
            <Bouton
              type="submit"
              desactive={envoiEnCours || titre.trim() === '' || corps.trim() === ''}
            >
              {envoiEnCours ? 'Enregistrement…' : enEdition === null ? 'Publier' : 'Enregistrer'}
            </Bouton>
            {enEdition !== null && (
              <Bouton variante="discret" onClick={reinitialiser}>
                Annuler la modification
              </Bouton>
            )}
          </div>
        </form>
      </Carte>

      <Carte titre="Annonces publiées" aide="Les plus récentes en premier.">
        {annonces === null && <p className="vide">Chargement…</p>}
        {annonces !== null && annonces.length === 0 && (
          <p className="vide">Aucune annonce pour le moment.</p>
        )}
        {annonces !== null && annonces.length > 0 && (
          <ul className="liste">
            {annonces.map((annonce) => (
              <li key={annonce.id}>
                <span>
                  <span className="titre">{annonce.titre}</span>{' '}
                  {annonce.epinglee && <span className="pastille">épinglée</span>}
                  <br />
                  <span className="details">
                    {formaterDate(annonce.publiee_le, true)} · {annonce.categorie}
                    {annonce.image_url !== null ? ' · avec image' : ''}
                  </span>
                </span>
                <span className="actions">
                  <Bouton variante="discret" onClick={() => commencerLaModification(annonce)}>
                    Modifier
                  </Bouton>
                  <Bouton variante="danger" onClick={() => void retirer(annonce)}>
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
