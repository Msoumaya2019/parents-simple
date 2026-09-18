import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuration Vite.
 *
 * `base: './'` produit des chemins relatifs plutôt qu'absolus. C'est ce qui
 * permet de déposer le dossier `dist/` aussi bien à la racine d'un domaine que
 * dans un sous-dossier — `…/admin/` sur GitHub Pages, par exemple — sans
 * reconstruire quoi que ce soit.
 *
 * Il n'y a pas de routeur : l'application tient sur un écran et change
 * d'onglet en mémoire. Aucune adresse n'est donc partagée ni mise en favori,
 * et les chemins relatifs ne cassent rien.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      // Rolldown signale que ses greffons ont occupé plus de la moitié du temps
      // de construction. C'est exact et sans intérêt ici : la construction
      // prend trois secondes. Laissé actif, ce message s'afficherait à chaque
      // compilation, y compris dans les journaux d'intégration continue, où il
      // noierait la seule ligne qui compte — celle qui dit si ça a marché.
      checks: { pluginTimings: false },
    },
  },
});
