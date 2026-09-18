import { useState, type FormEvent } from 'react';

import { Avis, Bouton, Champ } from '../components/ui';
import type { Client } from '../lib/client';

/**
 * L'écran de connexion.
 *
 * Il n'y a pas d'inscription, et ce n'est pas un oubli : les comptes du bureau
 * sont créés à la main depuis le tableau de bord Supabase, puis inscrits dans
 * la liste des membres. Une page d'administration qui laisserait créer un
 * compte serait une page qui laisse entrer n'importe qui — la liste des membres
 * arrêterait bien l'écriture, mais l'écran suivant serait un refus, ce qui est
 * une expérience absurde à offrir.
 *
 * Le message d'erreur est traduit : Supabase répond « Invalid login
 * credentials », et une personne du bureau qui lit cela ne sait pas si elle
 * s'est trompée de mot de passe ou si son compte n'existe pas.
 */
export function Connexion({ client }: { readonly client: Client }) {
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function connecter(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const { error } = await client.auth.signInWithPassword({
        email: courriel.trim(),
        password: motDePasse,
      });

      if (error !== null) {
        setErreur(traduire(error.message));
      }
      // En cas de succès, il n'y a rien à faire ici : la session est posée, et
      // c'est l'écouteur de `App` qui fait changer d'écran. Rediriger depuis ce
      // formulaire produirait deux sources de vérité pour la même question.
    } catch (inattendu) {
      setErreur(
        inattendu instanceof Error
          ? `La connexion a échoué : ${inattendu.message}`
          : 'La connexion a échoué pour une raison inconnue.',
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="page connexion">
      <section className="carte">
        <h2>Administration</h2>
        <p className="aide">
          École maternelle et élémentaire Frères Lumières, Montmagny. Cet accès est réservé aux
          personnes inscrites par le bureau.
        </p>

        {erreur !== null && <Avis ton="erreur" texte={erreur} />}

        <form onSubmit={connecter}>
          <Champ
            libelle="Adresse électronique"
            valeur={courriel}
            onChange={setCourriel}
            type="text"
            obligatoire
          />
          <Champ
            libelle="Mot de passe"
            valeur={motDePasse}
            onChange={setMotDePasse}
            type="password"
            obligatoire
          />
          <div className="actions">
            <Bouton
              type="submit"
              desactive={enCours || courriel.trim() === '' || motDePasse === ''}
            >
              {enCours ? 'Connexion…' : 'Se connecter'}
            </Bouton>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Traduit les messages d'erreur de Supabase.
 *
 * Seuls les cas qu'une personne du bureau peut réellement rencontrer sont
 * traduits. Les autres sont laissés tels quels plutôt que résumés en « une
 * erreur est survenue » : un message anglais mais précis vaut mieux qu'un
 * message français qui ne dit rien, et il est reconnaissable dans une
 * recherche.
 */
function traduire(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'Adresse ou mot de passe incorrect. Vérifiez la saisie ; si le doute persiste, le mot de passe peut être réinitialisé depuis le tableau de bord Supabase.';
  }

  if (/email not confirmed/i.test(message)) {
    return "Ce compte n'a pas été confirmé. Dans le tableau de bord Supabase, la personne doit être créée avec l'option « Auto Confirm User ».";
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "La base de données n'a pas répondu. Vérifiez la connexion, et que le projet Supabase n'est pas en pause.";
  }

  return `La connexion a été refusée : ${message}`;
}
