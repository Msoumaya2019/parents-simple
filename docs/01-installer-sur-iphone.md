# Installer l'application sur un iPhone

Ce document décrit la seule voie qui ne demande **ni Mac, ni compte développeur
Apple** : faire construire un IPA par GitHub, puis le signer soi-même sur son
propre appareil.

---

## Ce qu'est un IPA non signé, et ce qu'il n'est pas

Un IPA est une archive contenant l'application. « Non signé » signifie qu'aucun
certificat Apple n'y est attaché.

**Un iPhone refuse d'installer un IPA non signé.** iOS vérifie la signature au
moment de l'installation, et il n'existe aucun réglage pour contourner cette
vérification sur un appareil non modifié.

L'IPA non signé est donc un **produit intermédiaire** : il faut le signer, et
cette signature se fait sur votre machine, avec votre identifiant Apple. C'est
précisément ce qui permet au dépôt de rester public : aucun certificat, aucun
profil, aucun mot de passe n'y est stocké.

|                           | Compte Apple gratuit | Compte développeur (99 €/an) |
| ------------------------- | -------------------- | ---------------------------- |
| Validité de l'application | **7 jours**          | 1 an                         |
| Applications simultanées  | 3                    | Illimité                     |
| Réinstallation nécessaire | Toutes les semaines  | Tous les ans                 |
| TestFlight et App Store   | Non                  | Oui                          |

> Pour une association qui souhaite distribuer l'application aux familles, le
> compte développeur est la seule option confortable. Un parent qui doit
> réinstaller l'application chaque semaine ne le fera pas.

---

## 1. Obtenir l'IPA

### Si une compilation a déjà eu lieu

Le fichier est à la racine du projet, sous le nom
`freres-lumieres-parents-non-signe.ipa` — environ 14 Mo. Dans ce cas, **passer
directement à l'étape 3** : relancer une compilation produirait un fichier
identique, au prix d'un quart d'heure.

### Sinon, la faire construire par GitHub

Sur GitHub, dans le dépôt :

1. onglet **Actions** → **iOS — IPA non signé** → **Run workflow** ;
2. laisser la branche sur `main`, puis **Run workflow**.

La compilation prend une quinzaine de minutes. Elle vérifie d'abord le code
(formatage, analyse, types, tests, schéma de la base), puis **éprouve la base
réelle** avec la même clé que celle embarquée dans l'application — ce qu'un
inconnu ne peut pas y faire, et ce que l'application doit pouvoir y lire. Un
binaire qui compile n'est pas un binaire juste, et un binaire juste n'est pas
encore un binaire qui affiche quelque chose.

### Configurer les deux secrets, une seule fois

Le workflow s'arrête avec un message explicite si ces valeurs manquent.

**Settings** → **Secrets and variables** → **Actions** → **New repository
secret**, deux fois :

| Nom du secret       | Valeur                                                 |
| ------------------- | ------------------------------------------------------ |
| `SUPABASE_URL`      | Project URL, par exemple `https://abcdefg.supabase.co` |
| `SUPABASE_ANON_KEY` | La clé `anon` `public`                                 |

Ces valeurs se trouvent dans le tableau de bord Supabase, section **Project
Settings** → **API**.

> La clé `anon` n'est pas un secret au sens strict : elle finit en clair dans
> l'application compilée, et c'est normal. Elle est tout de même placée ici pour
> que le dépôt reste vierge de toute valeur. **Ne jamais placer la clé
> `service_role`** : elle contourne les politiques de sécurité et donnerait à
> quiconque l'extrait le droit de lire les messages adressés au bureau.

## 2. Télécharger l'IPA

À la fin du workflow, en bas de la page du run, section **Artifacts** :
`ios-ipa-non-signe`. Le fichier se télécharge sous forme d'archive ZIP —
le `.ipa` est à l'intérieur.

## 3. Signer et installer

### Avec Sideloadly (Windows ou macOS)

**Deux préparatifs avant la première tentative.** Les sauter produit des messages
d'erreur qui ne disent pas ce qui manque.

**Sous Windows** — Sideloadly a besoin des pilotes « Apple Mobile Device », que
la version du Microsoft Store **ne fournit pas** :

1. désinstaller iTunes s'il vient du Microsoft Store ;
2. installer la version du site d'Apple —
   [Windows 64 bits](https://www.apple.com/itunes/download/win64) — puis
   redémarrer ;
3. brancher l'iPhone, l'ouvrir une fois dans iTunes, et accepter **Faire
   confiance** sur le téléphone.

**Sur l'iPhone** — depuis iOS 16, Apple exige le **mode développeur** pour
installer une application hors App Store, et celle-ci demande iOS 16.4 :

4. **Réglages** → **Confidentialité et sécurité** → descendre jusqu'à **Mode
   développeur** → l'activer, puis redémarrer le téléphone.

Puis :

5. installer [Sideloadly](https://sideloadly.io/) ;
6. glisser le `.ipa` dans Sideloadly ;
7. saisir son identifiant Apple dans le champ _Apple ID_ — **le mot de passe
   normal, pas un mot de passe d'application** : un mot de passe d'application
   ne fonctionne qu'avec un compte développeur payant, et sera refusé ici. Si la
   double authentification est active, Apple envoie un code à six chiffres sur
   vos autres appareils : le saisir dans Sideloadly ;
8. **Start**.

Sideloadly signe l'application avec votre identifiant, l'installe, et affiche
la date d'expiration.

> Pour éviter de resigner à la main chaque semaine, cocher l'option de
> **rafraîchissement automatique** au moment de l'installation. Le démon de
> Sideloadly s'en charge ensuite dès qu'il détecte le téléphone — en USB, ou en
> Wi-Fi si le téléphone est appairé à l'ordinateur. Le rafraîchissement en
> Wi-Fi se règle dans iTunes : _Appareil connecté_ → _Résumé_ → _Synchroniser
> avec cet iPhone en Wi-Fi_.

### Avec AltStore (macOS ou Windows)

AltStore fait la même chose, mais rafraîchit la signature automatiquement tant
que l'ordinateur et le téléphone sont sur le même réseau. C'est plus confortable
pour un usage prolongé.

### Après l'installation

Sur l'iPhone : **Réglages** → **Général** → **VPN et gestion de
l'appareil** → sélectionner votre identifiant Apple → **Faire confiance**.

Sans cette étape, l'application refuse de s'ouvrir, avec un message peu
explicite.

---

## 4. Essayer sans rien installer

Pour valider l'application avant tout ce parcours :

```bash
npm start
```

Puis installer **Expo Go** sur le téléphone et scanner le QR code affiché. C'est
immédiat, réversible, et suffisant pour vérifier l'affichage et la navigation.

Les deux limites : Expo Go ne permet pas de tester le comportement réel d'une
application installée — nom, icône, écran de démarrage — et une version future
d'Expo pourrait ne plus prendre en charge un module natif utilisé ici.

---

## En cas de problème

| Symptôme                                                         | Cause probable                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Unable to install » dans Sideloadly                            | Un profil de développeur existe déjà pour cette application, avec un autre identifiant Apple. Le supprimer dans Réglages → VPN et gestion de l'appareil.                                                                                                                                                                                       |
| Sideloadly ne détecte pas l'iPhone (`No devices detected`)       | iTunes vient du Microsoft Store, qui n'installe pas les pilotes Apple Mobile Device. Désinstaller cette version, installer celle du [site d'Apple](https://www.apple.com/itunes/download/win64), redémarrer, puis accepter **Faire confiance** sur le téléphone. Un autre câble ou un autre port USB règle parfois la chose.                   |
| L'installation échoue, ou l'application s'installe sans s'ouvrir | Le **mode développeur** n'est pas activé sur l'iPhone : Réglages → Confidentialité et sécurité → Mode développeur. Obligatoire depuis iOS 16, et cette application demande iOS 16.4.                                                                                                                                                           |
| Sideloadly refuse le mot de passe d'application                  | Attendu avec un compte Apple gratuit : les mots de passe d'application ne fonctionnent qu'avec un compte développeur payant. Utiliser le mot de passe principal de l'identifiant Apple, puis saisir le code à six chiffres de la double authentification.                                                                                      |
| `Your maximum App ID limit has been reached`                     | Un compte Apple gratuit ne peut créer que 10 identifiants d'application par tranche de 7 jours. Attendre, ou utiliser un autre identifiant Apple.                                                                                                                                                                                              |
| L'installation réussit mais aucune icône n'apparaît              | Redémarrer le téléphone.                                                                                                                                                                                                                                                                                                                       |
| L'application s'ouvre puis affiche un écran d'explication        | Les secrets `SUPABASE_URL` ou `SUPABASE_ANON_KEY` étaient absents au moment de la compilation. Le workflow le signale pourtant avant de compiler.                                                                                                                                                                                              |
| L'application cesse de fonctionner après une semaine             | Comportement normal d'un compte Apple gratuit. Re-signer avec Sideloadly, sans réinstaller.                                                                                                                                                                                                                                                    |
| Le workflow échoue à `xcodebuild`                                | Vérifier que `runs-on` vaut `macos-26`. Expo SDK 57 tire `expo-modules-jsi`, qui déclare `swift-tools-version: 6.2` dans son `apple/Package.swift` : cette version de Swift n'arrive qu'avec Xcode 26. `macos-15` — Xcode 16.4, Swift 6.1 — échoue à la résolution des dépendances. Le workflow vérifie la chaîne d'outils et le dit lui-même. |
| Tous les onglets sont vides                                      | La base ne contient encore aucun contenu. Les écrans affichent alors un message explicite (« Aucune actualité pour le moment »), et non une erreur. Voir [`02-publier-du-contenu.md`](02-publier-du-contenu.md).                                                                                                                               |
| L'écran Confidentialité est vide                                 | Les variables d'environnement n'ont pas été prises en compte. Voir la table ci-dessus.                                                                                                                                                                                                                                                         |
