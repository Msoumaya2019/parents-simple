/**
 * Champ de saisie.
 *
 * Le libellé est TOUJOURS au-dessus du champ, jamais en texte d'indication à
 * l'intérieur. Un libellé placé à l'intérieur disparaît dès que l'on commence à
 * écrire : un parent qui remplit un formulaire en plusieurs fois ne sait plus
 * ce qu'il est en train de saisir, et les lecteurs d'écran n'ont plus rien à
 * annoncer.
 *
 * Le compteur de caractères n'apparaît qu'à partir de 80 % de la limite. Un
 * compteur affiché en permanence inquiète sans raison sur un champ qu'on
 * remplira de toute façon.
 */

import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/theme-provider';

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (valeur: string) => void;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly maxLength?: number;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly erreur?: string | null;
  readonly aide?: string;
  readonly obligatoire?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLength,
  keyboardType,
  autoCapitalize = 'sentences',
  erreur = null,
  aide,
  obligatoire = false,
}: TextFieldProps): React.JSX.Element {
  const { theme } = useTheme();

  const restants = maxLength === undefined ? null : maxLength - value.length;
  const afficherCompteur =
    maxLength !== undefined && restants !== null && restants <= maxLength * 0.2;
  const pluriel = restants !== null && Math.abs(restants) > 1 ? 's' : '';

  const bordure = erreur === null ? theme.colors.border : theme.colors.danger;

  return (
    <View>
      <View style={styles.ligneLibelle}>
        <AppText variant="label" color="secondary">
          {label}
          {obligatoire ? '' : ' (facultatif)'}
        </AppText>
        {afficherCompteur ? (
          <AppText variant="caption" color={restants <= 0 ? 'danger' : 'muted'}>
            {restants} caractère{pluriel} restant{pluriel}
          </AppText>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        // La correction automatique suit `multiline`, et c'est une décision
        // plutôt qu'un héritage : `autoCorrect` vaut `true` par défaut dans
        // React Native, donc un champ d'une ligne — un sujet, une adresse —
        // reçoit des remplacements indésirables si l'on ne dit rien. Elle reste
        // active là où elle aide vraiment, sur le message qu'on écrit vite.
        autoCorrect={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        style={[
          styles.champ,
          {
            backgroundColor: theme.colors.surface,
            borderColor: bordure,
            borderRadius: theme.radii.md,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.size.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: multiline ? theme.spacing.md : theme.spacing.sm,
            minHeight: multiline ? 132 : 48,
          },
        ]}
      />

      {erreur !== null ? (
        <AppText variant="caption" color="danger" style={styles.aide}>
          {erreur}
        </AppText>
      ) : aide !== undefined ? (
        <AppText variant="caption" color="muted" style={styles.aide}>
          {aide}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligneLibelle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  champ: {
    borderWidth: 1,
  },
  aide: {
    marginTop: 4,
  },
});
