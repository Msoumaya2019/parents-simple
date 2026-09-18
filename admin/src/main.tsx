import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { construire, type VariablesAdmin } from './lib/config';
import './styles.css';

/**
 * Point d'entrée de la page.
 *
 * La configuration est lue ici, une fois, et passée à `App`. `import.meta.env`
 * est remplacé statiquement par Vite à la compilation : seules les variables
 * préfixées `VITE_` sont insérées, et c'est voulu — une variable mal nommée
 * serait absente de la page sans qu'on s'en aperçoive.
 *
 * Le refus d'une clé à privilèges se produit donc avant tout rendu, et l'écran
 * qui s'affiche est une phrase, jamais une page blanche.
 */
const variables: VariablesAdmin = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const racine = document.getElementById('racine');
if (racine === null) {
  throw new Error("L'élément « racine » est absent de index.html.");
}

createRoot(racine).render(
  <StrictMode>
    <App config={construire(variables)} />
  </StrictMode>,
);
