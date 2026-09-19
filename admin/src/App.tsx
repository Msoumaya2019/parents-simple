import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { Avis, Bouton, Carte } from './components/ui';
import { Agenda } from './ecrans/Agenda';
import { Annonces } from './ecrans/Annonces';
import { Cantine } from './ecrans/Cantine';
import { Connexion } from './ecrans/Connexion';
import { Documents } from './ecrans/Documents';
import { Messages } from './ecrans/Messages';
import { creerClient, estMembreBureau, type Client } from './lib/client';
import type { ConfigLue, ConfigSupabase } from './lib/config';
import { messageDe } from './lib/erreurs';

/**
 * L'assemblage de la page.
 *
 * `App` ne fait qu'une chose : décider s'il y a lieu d'afficher autre chose que
 * l'administration. Si la configuration est refusée — une clé à privilèges,
 * une adresse mal formée —, il n'y a pas de client à construire, et surtout
 * pas de crochets à appeler. Séparer les deux composants n'est donc pas une
 * coquetterie de structure : appeler un crochet après un `return` conditionnel
 * est une faute que React signale à l'exécution, et jamais à la compilation.
 */
export function App({ config }: { readonly config: ConfigLue }) {
  if (config.supabase === null) {
    return <EcranConfiguration erreur={config.erreur ?? 'La configuration est incomplète.'} />;
  }

  return <Administration config={config.supabase} />;
}

const ONGLETS = [
  { cle: 'annonces', libelle: 'Annonces' },
  { cle: 'cantine', libelle: 'Cantine' },
  { cle: 'agenda', libelle: 'Agenda' },
  { cle: 'documents', libelle: 'Documents' },
  { cle: 'messages', libelle: 'Messages' },
] as const;

type CleOnglet = (typeof ONGLETS)[number]['cle'];

/**
 * Ce que la base a répondu sur cette personne, et POUR QUI elle l'a répondu.
 *
 * Le champ `pour` porte l'identifiant du compte concerné. C'est ce qui permet
 * de dériver l'état d'attente au lieu de le pousser : tant que le verdict
 * mémorisé ne concerne pas la personne connectée à cet instant, on ne sait pas
 * encore, et l'écran doit le dire. Sans cette empreinte, il faudrait écrire
 * « vérification en cours » de façon synchrone au début de l'effet — ce que la
 * règle `react-hooks/set-state-in-effect` refuse, à raison : cet état est la
 * conséquence d'un rendu, pas une information nouvelle.
 */
type Verdict =
  | { readonly pour: string; readonly statut: 'membre' }
  | { readonly pour: string; readonly statut: 'refuse' }
  | { readonly pour: string; readonly statut: 'panne'; readonly message: string };

function Administration({ config }: { readonly config: ConfigSupabase }) {
  // Le client est construit une seule fois : `useState` avec une fonction
  // d'initialisation, et non un appel direct, qui en créerait un nouveau à
  // chaque rendu — chaque rendu ouvrant alors une connexion de plus.
  const [client] = useState<Client>(() => creerClient(config));

  const [session, setSession] = useState<Session | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [onglet, setOnglet] = useState<CleOnglet>('annonces');

  // La session, et ses changements — connexion, déconnexion, jeton rafraîchi.
  useEffect(() => {
    let vivant = true;

    void client.auth.getSession().then(({ data }) => {
      if (vivant) {
        setSession(data.session);
      }
    });

    const { data: abonnement } = client.auth.onAuthStateChange((_evenement, nouvelle) => {
      if (vivant) {
        setSession(nouvelle);
      }
    });

    return () => {
      vivant = false;
      abonnement.subscription.unsubscribe();
    };
  }, [client]);

  // L'appartenance au bureau, redemandée à chaque changement de session.
  // Aucune écriture d'état n'a lieu de façon synchrone ici : la seule écriture
  // est dans les rappels de la promesse, donc après la réponse de la base.
  useEffect(() => {
    if (session === null) {
      return;
    }

    const identifiant = session.user.id;
    let vivant = true;

    void estMembreBureau(client)
      .then((membre) => {
        if (vivant) {
          setVerdict({ pour: identifiant, statut: membre ? 'membre' : 'refuse' });
        }
      })
      .catch((inattendu: unknown) => {
        if (vivant) {
          setVerdict({ pour: identifiant, statut: 'panne', message: messageDe(inattendu) });
        }
      });

    return () => {
      vivant = false;
    };
  }, [client, session]);

  if (session === null) {
    return <Connexion client={client} />;
  }

  const identifiant = session.user.id;
  const verdictCourant = verdict !== null && verdict.pour === identifiant ? verdict : null;

  if (verdictCourant === null) {
    return (
      <div className="page">
        <Carte titre="Vérification de l’accès" aide="Un instant…">
          <p className="vide">Vérification auprès de la base de données.</p>
        </Carte>
      </div>
    );
  }

  if (verdictCourant.statut === 'panne') {
    return (
      <div className="page">
        <Carte titre="La base n’a pas répondu">
          <Avis ton="erreur" texte={verdictCourant.message} />
          <p className="aide">
            Si ce message apparaît juste après la mise en service, la migration des membres du
            bureau n’a probablement pas encore été appliquée. Voir docs/05-administration.md.
          </p>
          <Bouton onClick={() => void client.auth.signOut()}>Se déconnecter</Bouton>
        </Carte>
      </div>
    );
  }

  if (verdictCourant.statut === 'refuse') {
    return (
      <div className="page">
        <Carte titre="Ce compte ne peut pas publier">
          <Avis
            ton="erreur"
            texte={`Le compte ${session.user.email ?? ''} est bien connecté, mais il ne figure pas dans la liste des membres du bureau.`}
          />
          <p className="aide">
            La liste des personnes autorisées se trouve dans la base. Pour y ajouter ce compte, le
            bureau doit exécuter la commande indiquée dans docs/05-administration.md.
          </p>
          <Bouton onClick={() => void client.auth.signOut()}>Se déconnecter</Bouton>
        </Carte>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="entete">
        <div>
          <h1>Administration — Frères Lumières</h1>
          <p>
            Connecté en tant que {session.user.email ?? 'compte inconnu'}. Les publications
            apparaissent immédiatement dans l’application des familles.
          </p>
        </div>
        <Bouton variante="discret" onClick={() => void client.auth.signOut()}>
          Se déconnecter
        </Bouton>
      </header>

      <nav className="onglets" aria-label="Sections">
        {ONGLETS.map((element) => (
          <button
            key={element.cle}
            type="button"
            className="onglet"
            aria-current={onglet === element.cle}
            onClick={() => setOnglet(element.cle)}
          >
            {element.libelle}
          </button>
        ))}
      </nav>

      {onglet === 'annonces' && <Annonces client={client} />}
      {onglet === 'cantine' && <Cantine client={client} />}
      {onglet === 'agenda' && <Agenda client={client} />}
      {onglet === 'documents' && <Documents client={client} />}
      {onglet === 'messages' && <Messages client={client} />}
    </div>
  );
}

/**
 * Ce qui s'affiche quand la configuration est refusée.
 *
 * Une phrase, et rien d'autre : pas de formulaire, pas de bouton. La personne
 * qui voit cet écran est celle qui déploie la page, et ce qu'elle doit faire
 * est dans le texte.
 */
function EcranConfiguration({ erreur }: { readonly erreur: string }) {
  return (
    <div className="page connexion">
      <Carte titre="Configuration à terminer">
        <Avis ton="erreur" texte={erreur} />
      </Carte>
    </div>
  );
}
