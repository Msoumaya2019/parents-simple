/**
 * Politique de confidentialité.
 *
 * Écrite dans l'application, et non derrière un lien vers un site : un parent
 * qui se demande ce que l'application retient de lui doit pouvoir le lire sans
 * quitter l'écran, et sans réseau.
 *
 * Le texte décrit ce que le code fait réellement, fonction par fonction. Il
 * doit être relu à chaque fois qu'une donnée est ajoutée : une politique qui
 * décrit autre chose que le code est pire que pas de politique du tout, parce
 * qu'elle donne une garantie fausse.
 *
 * LES TROIS VALEURS À COMPLÉTER SONT SIGNALÉES
 * --------------------------------------------
 * Le nom, le siège et l'adresse de contact du responsable de traitement ne
 * peuvent pas être devinés. Tant qu'ils manquent, la page affiche un
 * avertissement à leur place, plutôt qu'un texte plausible qui serait faux — un
 * parent qui exerce ses droits doit écrire au bon endroit, et une adresse
 * inventée est pire que pas d'adresse.
 *
 * Une seule chose à faire : remplir l'objet `RESPONSABLE`, plus bas.
 */

import { StyleSheet, View } from 'react-native';

import { AppText, Card, Pill, Screen } from '@/components/ui';
import { responsableIncomplet } from '@/lib/responsable';
import { useTheme } from '@/providers/theme-provider';

/**
 * Les coordonnées du responsable de traitement.
 *
 * À remplir avant de distribuer l'application. Ces trois valeurs figurent dans
 * les statuts de l'association et ne peuvent pas être devinées : tant qu'une
 * seule manque, la page affiche l'avertissement plutôt qu'un texte à moitié
 * rempli, qui aurait l'air complet sans l'être.
 *
 * Aucun autre endroit du code n'a besoin d'être touché : la page choisit
 * d'elle-même entre l'avertissement et les coordonnées.
 */
const RESPONSABLE = {
  nom: '',
  siege: '',
  courriel: '',
} as const;

/**
 * Vrai tant qu'il manque au moins une des trois valeurs.
 *
 * La règle est dans `@/lib/responsable`, et non recopiée ici : c'est ce qui la
 * rend éprouvable — un banc ne peut pas charger cet écran, qui importe React
 * Native — et c'est ce qui empêche une seconde version de la même question
 * d'apparaître ailleurs dans le code.
 */
const RESPONSABLE_INCOMPLET = responsableIncomplet(RESPONSABLE);

interface SectionProps {
  readonly titre: string;
  readonly children: React.ReactNode;
}

function Section({ titre, children }: SectionProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <AppText variant="title">{titre}</AppText>
      <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>{children}</View>
    </View>
  );
}

export default function ConfidentialiteScreen(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Screen edges={[]} scrollable>
      <View style={{ paddingTop: theme.spacing.lg }}>
        <Pill libelle="Aucun compte requis" ton="succes" />
        <AppText variant="body" color="secondary" style={{ marginTop: theme.spacing.md }}>
          Cette application a été conçue pour demander le moins de données possible. Aucune
          inscription n’est nécessaire, et rien ne permet de vous identifier si vous ne le faites
          pas vous-même.
        </AppText>
      </View>

      <Section titre="Ce qui est conservé sur votre téléphone">
        <AppText variant="body" color="secondary">
          Trois informations sont enregistrées dans la mémoire de l’application, et ne quittent
          votre appareil que dans les cas décrits plus bas :
        </AppText>
        <Card>
          <AppText variant="label">Un identifiant de vote</AppText>
          <AppText variant="caption" color="muted" style={styles.espace}>
            Un code tiré au hasard à la première ouverture, qui permet d’éviter qu’un même téléphone
            vote plusieurs fois au même sondage. Il n’est lié à aucun élément de votre appareil.
          </AppText>

          <View style={{ height: theme.spacing.md }} />

          <AppText variant="label">Un identifiant d’appareil</AppText>
          <AppText variant="caption" color="muted" style={styles.espace}>
            Un second code, distinct du premier, qui limite le nombre de messages qu’une même
            installation peut envoyer en peu de temps. Il est volontairement séparé de l’identifiant
            de vote : il serait sinon possible de relier un message signé au vote du même téléphone.
          </AppText>

          <View style={{ height: theme.spacing.md }} />

          <AppText variant="caption" color="muted" style={styles.espace}>
            Ces deux codes sont des données pseudonymes au sens du règlement européen sur la
            protection des données (RGPD) : ils distinguent une installation d’une autre sans jamais
            identifier personne.
          </AppText>

          <View style={{ height: theme.spacing.md }} />

          <AppText variant="label">Vos préférences et vos réponses</AppText>
          <AppText variant="caption" color="muted" style={styles.espace}>
            Le thème choisi, et le souvenir du choix que vous avez retenu à chaque sondage — ce
            dernier uniquement pour vous indiquer ce que vous avez répondu.
          </AppText>
        </Card>
      </Section>

      <Section titre="Ce qui est transmis, et quand">
        <AppText variant="body" color="secondary">
          Rien n’est transmis tant que vous ne faites pas une action. Aucune donnée n’est envoyée en
          arrière-plan, et l’application ne mesure pas votre usage.
        </AppText>
        <Card>
          <AppText variant="label">Lorsque vous répondez à un sondage</AppText>
          <AppText variant="caption" color="muted" style={styles.espace}>
            Votre réponse est enregistrée avec l’identifiant de vote. Personne ne peut savoir quel
            choix a été fait par quel téléphone : le bureau ne voit que des totaux.
          </AppText>

          <View style={{ height: theme.spacing.md }} />

          <AppText variant="label">Lorsque vous écrivez au bureau</AppText>
          <AppText variant="caption" color="muted" style={styles.espace}>
            Le texte de votre message, la catégorie choisie, l’identifiant d’appareil, et —
            seulement si vous le renseignez — l’adresse e-mail à laquelle répondre. Le message est
            lisible par les membres du bureau de l’association, et par personne d’autre.
          </AppText>
        </Card>
      </Section>

      <Section titre="Ce qui n’est jamais collecté">
        <AppText variant="body" color="secondary">
          Cette application ne demande et ne conserve : ni votre nom, ni votre adresse, ni votre
          numéro de téléphone, ni votre position, ni l’accès à vos contacts, à vos photos ou à vos
          fichiers. Elle ne contient aucun outil de mesure d’audience, aucune publicité, et ne
          communique rien à des tiers.
        </AppText>
      </Section>

      <Section titre="Combien de temps">
        <AppText variant="body" color="secondary">
          Les messages adressés au bureau sont conservés le temps nécessaire à leur traitement, puis
          supprimés. Les votes sont conservés sous forme de totaux ; les identifiants de vote et
          d’appareil cessent d’être utilisés dès que le sondage est clôturé. Les actualités, menus,
          dates et documents publiés sont conservés tant qu’ils restent utiles aux familles.
        </AppText>
      </Section>

      <Section titre="Vos droits">
        <AppText variant="body" color="secondary">
          Vous pouvez demander à consulter les informations vous concernant et à les faire effacer.
          Désinstaller l’application efface immédiatement les trois informations conservées sur
          votre téléphone.
        </AppText>
        <AppText variant="body" color="secondary">
          Effacer ces codes a une conséquence qu’il faut connaître : après une réinstallation, le
          même téléphone peut voter une seconde fois au même sondage. C’est la limite d’une
          application sans compte, et nous préférons la dire plutôt que de la laisser découvrir.
        </AppText>
        <AppText variant="body" color="secondary">
          Pour un message que vous avez envoyé au bureau, la demande se fait directement auprès de
          l’association, aux coordonnées ci-dessous.
        </AppText>
      </Section>

      <Section titre="Responsable de traitement">
        {RESPONSABLE_INCOMPLET ? (
          <Card style={{ borderColor: theme.colors.warning }}>
            <AppText variant="label" color="danger">
              À compléter avant la mise à disposition
            </AppText>
            <AppText variant="caption" color="muted" style={styles.espace}>
              Le nom officiel de l’association, l’adresse de son siège et l’adresse e-mail à
              laquelle un parent peut écrire pour exercer ses droits ne sont pas encore renseignés.
              Ces informations figurent dans les statuts de l’association.
            </AppText>
            <AppText variant="caption" color="muted" style={styles.espace}>
              Pour les compléter : remplir l’objet `RESPONSABLE` en tête de ce fichier. Cette page
              basculera d’elle-même sur les coordonnées réelles.
            </AppText>
          </Card>
        ) : (
          <Card>
            <AppText variant="label">{RESPONSABLE.nom}</AppText>
            <AppText variant="caption" color="muted" style={styles.espace}>
              {RESPONSABLE.siege}
            </AppText>
            <AppText variant="caption" color="muted" style={styles.espace}>
              {RESPONSABLE.courriel}
            </AppText>
          </Card>
        )}
      </Section>

      <View style={{ height: theme.spacing.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  espace: {
    marginTop: 4,
    lineHeight: 19,
  },
});
