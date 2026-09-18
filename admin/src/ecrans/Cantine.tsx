import { useState, type FormEvent } from 'react';

import { Avis, Bouton, Carte, Champ, ZoneTexte } from '../components/ui';
import { menuRenseigne } from '../lib/bornes';
import { useChargement } from '../lib/chargement';
import type { Client } from '../lib/client';
import { enregistrerMenu, listerMenus, supprimerMenu } from '../lib/contenu';
import { formaterJour, jourValide } from '../lib/dates';
import { messageDe } from '../lib/erreurs';
import type { MenuCantine } from '../lib/types';

/**
 * Les menus de cantine.
 *
 * Un menu est identifié par son JOUR, pas par un titre : il n'y a qu'un menu
 * par jour de service, et la base le garantit par une contrainte d'unicité sur
 * `service_date`. Enregistrer un jour déjà saisi corrige donc le menu existant
 * au lieu d'en créer un second — c'est ce que fait `enregistrerMenu`.
 */
export function Cantine({ client }: { readonly client: Client }) {
  const { etat, recharger } = useChargement('menus', () => listerMenus(client));
  const menus = etat.statut === 'succes' ? etat.donnees : null;

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [jour, setJour] = useState('');
  const [entree, setEntree] = useState('');
  const [plat, setPlat] = useState('');
  const [dessert, setDessert] = useState('');
  const [notes, setNotes] = useState('');
  const [enCours, setEnCours] = useState(false);

  const messageErreur = erreur ?? (etat.statut === 'erreur' ? etat.message : null);

  function reinitialiser() {
    setJour('');
    setEntree('');
    setPlat('');
    setDessert('');
    setNotes('');
  }

  function charger(menu: MenuCantine) {
    setJour(menu.service_date);
    setEntree(menu.entree ?? '');
    setPlat(menu.plat ?? '');
    setDessert(menu.dessert ?? '');
    setNotes(menu.notes ?? '');
    setSucces(null);
    setErreur(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(null);

    if (!jourValide(jour)) {
      setErreur('Choisissez le jour du menu.');
      return;
    }

    if (!menuRenseigne(entree, plat, dessert)) {
      setErreur(
        'Renseignez au moins un des trois services — entrée, plat ou dessert. ' +
          'Un menu vide occuperait un jour du calendrier sans rien apprendre aux familles.',
      );
      return;
    }

    const videOuTexte = (valeur: string) => {
      const propre = valeur.trim();
      return propre === '' ? null : propre;
    };

    setEnCours(true);
    try {
      await enregistrerMenu(client, {
        service_date: jour,
        entree: videOuTexte(entree),
        plat: videOuTexte(plat),
        dessert: videOuTexte(dessert),
        notes: videOuTexte(notes),
      });
      setSucces(`Menu du ${formaterJour(jour)} enregistré.`);
      reinitialiser();
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    } finally {
      setEnCours(false);
    }
  }

  async function retirer(menu: MenuCantine) {
    const confirme = window.confirm(
      `Supprimer le menu du ${formaterJour(menu.service_date)} ?\n\n` +
        'Ce jour disparaîtra du calendrier de la cantine.',
    );
    if (!confirme) {
      return;
    }

    setErreur(null);
    setSucces(null);
    try {
      await supprimerMenu(client, menu.id);
      setSucces('Menu supprimé.');
      recharger();
    } catch (inattendu) {
      setErreur(messageDe(inattendu));
    }
  }

  return (
    <>
      <Carte
        titre="Menu de cantine"
        aide="Un menu par jour de service. Enregistrer un jour déjà saisi corrige le menu existant."
      >
        {messageErreur !== null && <Avis ton="erreur" texte={messageErreur} />}
        {succes !== null && <Avis ton="succes" texte={succes} />}

        <form onSubmit={enregistrer}>
          <Champ
            libelle="Jour du service"
            valeur={jour}
            onChange={setJour}
            type="date"
            obligatoire
          />

          <div className="grille">
            <Champ libelle="Entrée" valeur={entree} onChange={setEntree} />
            <Champ libelle="Plat" valeur={plat} onChange={setPlat} />
            <Champ libelle="Dessert" valeur={dessert} onChange={setDessert} />
          </div>

          <ZoneTexte
            libelle="Notes"
            valeur={notes}
            onChange={setNotes}
            lignes={3}
            aide="Allergènes, changement de service, information aux familles."
          />

          <div className="actions">
            <Bouton type="submit" desactive={enCours || !jourValide(jour)}>
              {enCours ? 'Enregistrement…' : 'Enregistrer le menu'}
            </Bouton>
            <Bouton variante="discret" onClick={reinitialiser}>
              Vider le formulaire
            </Bouton>
          </div>
        </form>
      </Carte>

      <Carte titre="Menus enregistrés" aide="Les jours les plus récents en premier.">
        {menus === null && <p className="vide">Chargement…</p>}
        {menus !== null && menus.length === 0 && (
          <p className="vide">Aucun menu enregistré pour le moment.</p>
        )}
        {menus !== null && menus.length > 0 && (
          <ul className="liste">
            {menus.map((menu) => (
              <li key={menu.id}>
                <span>
                  <span className="titre">{formaterJour(menu.service_date)}</span>
                  <br />
                  <span className="details">
                    {[menu.entree, menu.plat, menu.dessert]
                      .filter((service) => service !== null)
                      .join(' · ') || 'Aucun service renseigné'}
                  </span>
                </span>
                <span className="actions">
                  <Bouton variante="discret" onClick={() => charger(menu)}>
                    Corriger
                  </Bouton>
                  <Bouton variante="danger" onClick={() => void retirer(menu)}>
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
