import { useId, useState, type FormEvent } from 'react';

import { Avis, Bouton, Carte, Champ, Choix, ZoneTexte } from '../components/ui';
import { BORNES } from '../lib/bornes';
import { useChargement } from '../lib/chargement';
import type { Client } from '../lib/client';
import {
  anneeScolaire,
  creerDocument,
  listerDocuments,
  supprimerDocument,
  televerserDocument,
} from '../lib/contenu';
import { formaterDate } from '../lib/dates';
import { messageDe } from '../lib/erreurs';
import { CATEGORIES_DOCUMENT, type CategorieDocument, type DocumentPublie } from '../lib/types';

/**
 * Les documents mis à disposition des familles.
 *
 * Deux étapes, dans cet ordre : le fichier est d'abord déposé dans le
 * compartiment de stockage, puis une ligne décrit ce fichier et porte son
 * chemin. Si l'envoi échoue, aucune ligne n'est créée — et l'application ne
 * montre donc jamais un document introuvable.
 *
 * Le titre est prérempli avec le nom du fichier au moment du choix, parce que
 * c'est presque toujours ce qu'on veut écrire. Il reste modifiable.
 */
export function Documents({ client }: { readonly client: Client }) {
  const { etat, recharger } = useChargement('documents', () => listerDocuments(client));
  const documents = etat.statut === 'succes' ? etat.donnees : null;

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [fichier, setFichier] = useState<File | null>(null);
  const [dossier, setDossier] = useState(anneeScolaire());
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState<CategorieDocument>('administratif');
  const [enCours, setEnCours] = useState(false);

  const idFichier = useId();

  const messageErreur = erreur ?? (etat.statut === 'erreur' ? etat.message : null);

  function reinitialiser() {
    setFichier(null);
    setTitre('');
    setDescription('');
    setCategorie('administratif');
  }

  async function publier(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(null);

    if (fichier === null) {
      setErreur('Choisissez d’abord un fichier.');
      return;
    }

    const titrePropre = titre.trim();
    if (titrePropre === '') {
      setErreur('Le titre ne peut pas être vide.');
      return;
    }

    setEnCours(true);
    try {
      const chemin = await televerserDocument(client, fichier, dossier);
      await creerDocument(client, {
        titre: titrePropre,
        description: description.trim() === '' ? null : description.trim(),
        categorie,
        storage_path: chemin,
        taille_octets: fichier.size,
      });

      setSucces(`« ${titrePropre} » est publié. Les familles peuvent le télécharger.`);
      reinitialiser();
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    } finally {
      setEnCours(false);
    }
  }

  async function retirer(document: DocumentPublie) {
    const confirme = window.confirm(
      `Retirer « ${document.titre} » de la liste ?\n\n` +
        'La ligne disparaîtra. Le fichier lui-même reste dans le stockage, ' +
        'et pourra être supprimé depuis le tableau de bord Supabase si besoin.',
    );
    if (!confirme) {
      return;
    }

    setErreur(null);
    setSucces(null);
    try {
      await supprimerDocument(client, document.id);
      setSucces('Document retiré de la liste.');
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    }
  }

  return (
    <>
      <Carte
        titre="Publier un document"
        aide="Le fichier est déposé dans le stockage, puis une fiche le rend visible dans l’application."
      >
        {messageErreur !== null && <Avis ton="erreur" texte={messageErreur} />}
        {succes !== null && <Avis ton="succes" texte={succes} />}

        <form onSubmit={publier}>
          <div className="champ">
            <label htmlFor={idFichier}>Fichier</label>
            <input
              id={idFichier}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(evenement) => {
                const choisi = evenement.target.files?.[0] ?? null;
                setFichier(choisi);
                if (choisi !== null && titre.trim() === '') {
                  // Le nom du fichier, sans son extension : c'est presque
                  // toujours ce que le bureau aurait écrit.
                  const point = choisi.name.lastIndexOf('.');
                  setTitre(point > 0 ? choisi.name.slice(0, point) : choisi.name);
                }
              }}
            />
            <span className="compte">
              Formats acceptés : PDF, JPEG, PNG, WebP. 20 Mo au maximum.
            </span>
          </div>

          <Champ
            libelle="Ranger dans le dossier"
            valeur={dossier}
            onChange={setDossier}
            maxLength={BORNES.cheminDocument.max}
            aide="Un sous-dossier du compartiment, par exemple 2026-2027."
          />

          <Champ
            libelle="Titre affiché aux familles"
            valeur={titre}
            onChange={setTitre}
            maxLength={BORNES.titreDocument.max}
            obligatoire
          />

          <Choix
            libelle="Catégorie"
            valeur={categorie}
            onChange={setCategorie}
            options={CATEGORIES_DOCUMENT}
          />

          <ZoneTexte
            libelle="Description"
            valeur={description}
            onChange={setDescription}
            lignes={3}
          />

          <div className="actions">
            <Bouton type="submit" desactive={enCours || fichier === null || titre.trim() === ''}>
              {enCours ? 'Envoi en cours…' : 'Publier le document'}
            </Bouton>
          </div>
        </form>
      </Carte>

      <Carte titre="Documents publiés" aide="Les plus récents en premier.">
        {documents === null && <p className="vide">Chargement…</p>}
        {documents !== null && documents.length === 0 && (
          <p className="vide">Aucun document publié pour le moment.</p>
        )}
        {documents !== null && documents.length > 0 && (
          <ul className="liste">
            {documents.map((document) => (
              <li key={document.id}>
                <span>
                  <span className="titre">{document.titre}</span>{' '}
                  <span className="pastille">{document.categorie}</span>
                  <br />
                  <span className="details">
                    {formaterDate(document.publie_le)}
                    {document.taille_octets !== null
                      ? ` · ${tailleLisible(document.taille_octets)}`
                      : ''}
                    {` · ${document.storage_path}`}
                  </span>
                </span>
                <span className="actions">
                  <Bouton
                    variante="discret"
                    onClick={() =>
                      window.open(
                        client.storage.from('documents').getPublicUrl(document.storage_path).data
                          .publicUrl,
                        '_blank',
                        'noopener',
                      )
                    }
                  >
                    Ouvrir
                  </Bouton>
                  <Bouton variante="danger" onClick={() => void retirer(document)}>
                    Retirer
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

/**
 * Écrit une taille en octets de façon lisible.
 *
 * Un parent lit « 1,2 Mo » et comprend tout de suite s'il peut le télécharger
 * sur son forfait ; « 1258291 » ne dit rien à personne.
 */
function tailleLisible(octets: number): string {
  if (octets < 1024) {
    return `${octets} o`;
  }
  if (octets < 1024 * 1024) {
    return `${(octets / 1024).toFixed(0)} ko`;
  }
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
