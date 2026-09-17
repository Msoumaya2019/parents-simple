/**
 * Thème et préférence d'affichage.
 *
 * Le mode système est suivi par défaut, mais un parent peut le forcer. Le
 * choix est conservé sur l'appareil : le refaire à chaque ouverture serait
 * pénible, et c'est exactement le genre de détail qui fait qu'on n'utilise plus
 * une application.
 *
 * La préférence est lue une fois au démarrage. Tant qu'elle ne l'est pas, on
 * affiche le thème système : c'est la valeur la plus probable, et elle évite un
 * scintillement du clair au sombre au lancement.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { themeFor, type Theme, type ThemeMode } from '@/theme';

const CLE_PREFERENCE = 'freres-lumieres.theme';

/** `auto` suit le réglage du téléphone. */
export type PreferenceTheme = 'auto' | ThemeMode;

interface ThemeContextValue {
  readonly theme: Theme;
  /** Mode réellement appliqué, une fois `auto` résolu. */
  readonly mode: ThemeMode;
  readonly preference: PreferenceTheme;
  readonly definirPreference: (preference: PreferenceTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function estPreference(valeur: string): valeur is PreferenceTheme {
  return valeur === 'auto' || valeur === 'light' || valeur === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const systeme = useColorScheme();
  const [preference, setPreference] = useState<PreferenceTheme>('auto');

  useEffect(() => {
    let actif = true;

    void (async () => {
      try {
        const stockee = await AsyncStorage.getItem(CLE_PREFERENCE);
        // `actif` évite d'écrire dans un composant déjà démonté si la lecture
        // se termine après la fermeture de l'écran.
        if (actif && stockee !== null && estPreference(stockee)) {
          setPreference(stockee);
        }
      } catch {
        // Une préférence illisible n'est pas un problème : on garde `auto`.
      }
    })();

    return () => {
      actif = false;
    };
  }, []);

  const definirPreference = useCallback((nouvelle: PreferenceTheme) => {
    setPreference(nouvelle);
    void AsyncStorage.setItem(CLE_PREFERENCE, nouvelle).catch(() => {
      // Échec d'écriture sans conséquence immédiate : le choix s'applique pour
      // cette session, il ne sera simplement pas conservé.
    });
  }, []);

  const mode: ThemeMode =
    preference === 'auto' ? (systeme === 'dark' ? 'dark' : 'light') : preference;

  const valeur = useMemo<ThemeContextValue>(
    () => ({
      theme: themeFor(mode),
      mode,
      preference,
      definirPreference,
    }),
    [mode, preference, definirPreference],
  );

  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const contexte = useContext(ThemeContext);
  if (contexte === null) {
    throw new Error("useTheme doit être utilisé à l'intérieur de ThemeProvider.");
  }
  return contexte;
}
