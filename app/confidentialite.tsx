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
 * LES DEUX CHAMPS À COMPLÉTER SONT SIGNALÉS
 * -----------------------------------------
 * Le nom et les coordonnées du responsable de traitement ne peuvent pas être
 * devinés. Ils sont donc marqués visiblement, plutôt que remplis d'un texte
 * plausible qui serait faux — un parent qui exerce ses droits doit écrire au
 * bon endroit.
 */

import { StyleSheet, View } from 'react-native';

import { AppText, Card, Pill, Screen } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';

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
          Pour un message que vous avez envoyé au bureau, la demande se fait directement auprès de
          l’association, aux coordonnées ci-dessous.
        </AppText>
      </Section>

      <Section titre="Responsable de traitement">
        <Card style={{ borderColor: theme.colors.warning }}>
          <AppText variant="label" color="danger">
            À compléter avant la mise à disposition
          </AppText>
          <AppText variant="caption" color="muted" style={styles.espace}>
            Le nom officiel de l’association, l’adresse de son siège et l’adresse e-mail à laquelle
            un parent peut écrire pour exercer ses droits doivent être renseignés ici. Ces
            informations figurent dans les statuts de l’association.
          </AppText>
        </Card>
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
