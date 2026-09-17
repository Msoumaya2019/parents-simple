# Installer l'application sur un téléphone Android

Ce document décrit la voie la plus courte pour voir l'application tourner sur un
vrai téléphone, puis la façon de la signer pour de bon.

**Contrairement à iOS, Android accepte les applications auto-signées.** Il n'y a
donc ici ni re-signature sur votre machine, ni compte développeur, ni expiration
au bout de sept jours : l'APK produit par GitHub s'installe directement.

---

## Ce qu'est un APK

Un APK est une archive contenant l'application. Android vérifie sa signature
avant de l'installer, et exige que cette signature soit cohérente avec celle de
la version déjà installée — c'est ce qui garantit qu'une mise à jour vient bien
du même auteur.

C'est de cette règle que découle tout le reste de ce document.

---

## 1. Faire construire l'APK

Sur GitHub, dans le dépôt :

1. onglet **Actions** → **Android — APK** → **Run workflow** ;
2. laisser la branche sur `main`, puis **Run workflow**.

La compilation prend une vingtaine de minutes. Elle vérifie d'abord le code
(formatage, analyse, types, tests, schéma de la base, flux de travail), puis
**éprouve la base réelle** avec la même clé que celle embarquée dans
l'application — ce qu'un inconnu ne peut pas y faire, et ce que l'application
doit pouvoir y lire. Un binaire qui compile n'est pas un binaire juste, et un
binaire juste n'est pas encore un binaire qui affiche quelque chose.

### Les deux secrets Supabase, une seule fois

Comme pour iOS, le workflow s'arrête avec un message explicite si ces valeurs
manquent. **Settings** → **Secrets and variables** → **Actions** → **New
repository secret** :

| Nom du secret       | Valeur                                                 |
| ------------------- | ------------------------------------------------------ |
| `SUPABASE_URL`      | Project URL, par exemple `https://abcdefg.supabase.co` |
| `SUPABASE_ANON_KEY` | La clé `anon` `public`                                 |

## 2. Télécharger et installer

À la fin du workflow, en bas de la page du run, section **Artifacts** :
`android-apk`. Le fichier se télécharge sous forme d'archive ZIP — le `.apk` est
à l'intérieur.

Transférer le fichier sur le téléphone — par câble, par courriel, ou par un
service de transfert — puis l'ouvrir. Android demande d'autoriser l'installation
depuis cette source : c'est normal pour une application qui ne vient pas du Play
Store, et cela ne peut pas se faire à distance sans une action de l'utilisateur.

> Le workflow vérifie que le paquet contient bien l'adresse de la base de
> données. Sans cette vérification, un APK compilé sans les secrets s'installerait
> parfaitement et n'afficherait aucune donnée — un défaut qui ne se voit qu'après
> installation.

---

## 3. La limite de l'APK d'essai

Par défaut, et sans aucune configuration, l'APK est signé avec la **clé de
débogage** fournie par le modèle React Native. C'est ce qui le rend installable
immédiatement.

Cette clé a deux propriétés gênantes :

- elle est **publique et identique pour tout le monde**. N'importe qui peut
  produire un APK portant la même signature. Android n'installe jamais sans une
  action de l'utilisateur, mais un APK reçu hors des canaux officiels ne devrait
  pas être accepté sans vérification ;
- **elle interdit toute mise à jour ultérieure**. Passer plus tard à une vraie
  clé ferait refuser l'installation par Android, qui considère qu'il s'agit d'une
  autre application. Il faudrait désinstaller, et perdre les données locales.

Autrement dit : **cet APK sert à valider l'application, pas à la distribuer aux
familles.** Le résumé du workflow le rappelle à chaque exécution.

---

## 4. Signer avec une vraie clé

### 4.1 Créer le fichier de clé

Sur votre machine, avec `keytool`, fourni avec n'importe quel JDK :

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias freres-lumieres \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

`keytool` pose ensuite quelques questions — nom, organisation, ville, pays. Les
réponses composent le certificat, et n'ont pas d'incidence sur le
fonctionnement : elles identifient l'auteur de la signature.

La validité de 10 000 jours place l'expiration vers 2053. C'est volontaire : une
signature expirée ne peut plus publier de mise à jour, et le Play Store exige une
validité largement au-delà de 2033.

> **Selon la version de Java, `keytool` produit un fichier PKCS12 (Java 9 et
> suivants) ou JKS (Java 8).** PKCS12 n'accepte qu'**un seul mot de passe** pour
> le fichier et pour la clé : `keytool` vous préviendra s'il ignore l'option
> `-keypass`. Dans le doute, utilisez le même mot de passe dans les deux secrets
> décrits ci-dessous — c'est valable dans les deux formats.

### 4.2 Conserver ce fichier

> **Le fichier `release.keystore` et son mot de passe doivent être conservés
> ailleurs que sur cette machine** — gestionnaire de mots de passe, coffre-fort
> numérique, ou copie chiffrée. Sans eux, aucune mise à jour ne pourra plus
> jamais être installée par-dessus une version déjà distribuée. C'est la seule
> chose de ce projet qui soit réellement irremplaçable.

Le fichier ne doit **jamais** être ajouté au dépôt. `.gitignore` couvre
`*.keystore` et `*.jks`.

### 4.3 Encoder le fichier

```bash
# Linux, ou Git Bash sous Windows
base64 -w0 release.keystore

# macOS
base64 -i release.keystore
```

Copier toute la sortie. **Les retours à la ligne sont sans conséquence** : le
script les retire avant décodage. En revanche, si votre outil propose un
« base64 URL », ne l'utilisez pas — son alphabet est différent, et le script le
refuse explicitement plutôt que de produire un fichier de clé corrompu.

### 4.4 Ajouter les quatre secrets

**Settings** → **Secrets and variables** → **Actions** → **New repository
secret**, quatre fois :

| Nom du secret               | Valeur                                      |
| --------------------------- | ------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | la sortie de la commande ci-dessus          |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du fichier de clé           |
| `ANDROID_KEY_ALIAS`         | l'alias choisi, ici `freres-lumieres`       |
| `ANDROID_KEY_PASSWORD`      | le mot de passe de la clé (souvent le même) |

Relancer le workflow. Le résumé indiquera alors **« clé de release fournie »**
au lieu de l'avertissement.

### Ce qui se passe pendant la compilation

`android/` n'est pas versionné : il est régénéré à chaque compilation, et Expo y
configure la signature de release avec la clé de débogage. Une étape du workflow
corrige donc le fichier généré, via `scripts/configurer-signature-android.py`.

Ce script ne se contente pas de modifier le fichier : **il le relit ensuite et
refuse de continuer si la substitution n'a pas eu lieu.** Sans ce contrôle, un
changement dans le modèle d'Expo produirait un APK signé avec la clé de débogage,
et rien ne le signalerait avant que la mise à jour d'une application déjà
installée ne soit refusée — des mois plus tard.

Un second contrôle a lieu après la compilation : `apksigner` lit le certificat
réellement attaché à l'APK, et la compilation **échoue** si la clé détectée ne
correspond pas à celle qui était demandée. Les mots de passe, eux, sont lus
depuis l'environnement de l'exécuteur et ne sont jamais écrits dans un fichier.

---

## 5. Publier une mise à jour

Pour qu'Android accepte une mise à jour par-dessus une version déjà installée :

1. **incrémenter le numéro de version** dans `app.json` :

   ```json
   "android": { "versionCode": 2 }
   ```

   Ce numéro doit être **strictement supérieur** au précédent. C'est lui
   qu'Android compare, pas le nom de version affiché.

2. relancer le workflow **Android — APK** ;
3. installer le nouvel APK sur le téléphone : il remplace l'ancien, sans
   désinstallation, et les données locales sont conservées.

> Cela ne fonctionne que si les deux APK sont signés **avec la même clé**. Un APK
> d'essai signé avec la clé de débogage ne peut pas être mis à jour vers un APK
> signé avec votre clé : il faut désinstaller d'abord.

---

## 6. Pour aller plus loin : le Play Store

Le Play Store n'accepte pas les APK mais des **App Bundle** (`.aab`), un format
que Google découpe ensuite par appareil. Le projet est prêt pour cette étape —
il suffirait de remplacer `assembleRelease` par `bundleRelease` dans le workflow
— mais elle n'a de sens qu'avec un compte Google Play (25 $ une fois) et une
fiche d'application à rédiger.

Pour une association qui diffuse à quelques centaines de familles, l'APK
direct reste plus simple : pas de validation par Google, pas de délai, et la
possibilité de corriger un défaut en quelques minutes.

---

## En cas de problème

| Symptôme                                                  | Cause probable                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Application non installée »                             | Une version signée avec une autre clé est déjà présente. Désinstaller l'ancienne, puis réessayer.                                                 |
| Le workflow échoue à l'étape « Configurer la signature »  | Un des quatre secrets est absent ou mal nommé. Le message indique lequel.                                                                         |
| Le workflow échoue à l'étape « Vérifier la signature »    | La clé détectée sur l'APK ne correspond pas à celle demandée : la substitution n'a pas pris effet. Ne pas distribuer cet APK.                     |
| « base64 URL » dans le message d'erreur                   | Le fichier a été encodé avec un alphabet différent. Réencoder avec `base64 -w0`.                                                                  |
| « PEM, pas un fichier de clé »                            | C'est un certificat qui a été encodé, pas le fichier `.keystore`. Vérifier le fichier envoyé.                                                     |
| `./gradlew` échoue sur la version de Java                 | Gradle 9 exige Java 17 au minimum. Le workflow installe Java 21 ; en local, vérifier avec `java -version`.                                        |
| L'application s'ouvre puis affiche un écran d'explication | Les secrets `SUPABASE_URL` ou `SUPABASE_ANON_KEY` étaient absents au moment de la compilation. Le workflow le signale pourtant avant de compiler. |
| Un parent ne peut pas mettre à jour l'application         | Son APK installé est signé avec la clé de débogage. Il doit désinstaller, puis installer la version signée avec la vraie clé.                     |

---

## Voir aussi

- [`01-installer-sur-iphone.md`](01-installer-sur-iphone.md) — la voie iOS
- [`02-publier-du-contenu.md`](02-publier-du-contenu.md) — publier actualités, menus, agenda
- [`03-securite-et-donnees.md`](03-securite-et-donnees.md) — ce qui protège les données
