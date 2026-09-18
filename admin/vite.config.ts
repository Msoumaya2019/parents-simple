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
 * LA CLÉ AVAIT DISPARU, ET LE COMMENTAIRE ÉTAIT RESTÉ
 * ---------------------------------------------------
 * Le commentaire ci-dessus a longtemps décrit une configuration qui n'existait
 * plus : `base` n'était plus qu'un mot dans ce texte, jamais une clé. Vite
 * prenait donc sa valeur par défaut, `/`, et le `index.html` produit référençait
 * `/assets/…` — mesuré, pas supposé. La page fonctionnait à la racine d'un
 * domaine, ce qui est le cas du déploiement prévu, et aurait échoué partout
 * ailleurs, en silence.
 *
 * C'est le piège que ce commentaire ne peut pas éviter : **une intention
 * écrite n'est pas un réglage**, et rien dans le code ne relie les deux. La
 * valeur est donc tenue par un contrôle — `scripts/check-admin.mjs` la relit
 * comme une valeur et refuse son absence —, pas par cette prose.
 *
 * Il n'y a pas de routeur : l'application tient sur un écran et change
 * d'onglet en mémoire. Aucune adresse n'est donc partagée ni mise en favori,
 * et les chemins relatifs ne cassent rien.
 */
export default defineConfig({
  base: './',
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
