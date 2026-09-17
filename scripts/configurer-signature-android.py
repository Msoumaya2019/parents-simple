#!/usr/bin/env python3
"""
Configure la signature de release d'un projet Android généré par Expo.

POURQUOI CE SCRIPT EXISTE
-------------------------
Expo configure le type de compilation `release` pour qu'il soit signé avec la
clé de DÉBOGAGE du modèle React Native. C'est commode — l'APK est installable
immédiatement — mais cette clé est publique et identique pour tout le monde.
Un APK signé avec elle ne pourra JAMAIS être mis à jour vers une vraie clé :
Android considère qu'une signature différente désigne une autre application.

Ce script bascule le projet vers une vraie clé de signature, fournie par
l'environnement.

POURQUOI UN SCRIPT VERSIONNÉ PLUTÔT QUE DU `sed` DANS LE FLUX DE TRAVAIL
-----------------------------------------------------------------------
`android/` est régénéré à chaque compilation : la modification doit donc être
refaite à chaque fois, et elle porte sur un fichier qu'on ne versionne pas. Une
substitution écrite à même le YAML serait invérifiable — et si le modèle d'Expo
change, elle ne ferait plus rien, silencieusement. On livrerait alors un APK
signé avec la clé de débogage en croyant l'avoir signé correctement.

Ce script vérifie donc son propre travail : il relit le fichier après écriture
et refuse de continuer si les deux substitutions n'ont pas eu lieu.

POURQUOI LES MOTS DE PASSE VIENNENT DE L'ENVIRONNEMENT
-----------------------------------------------------
`System.getenv` est utilisé dans le script Gradle plutôt qu'un fichier
`gradle.properties`. Le fichier serait écrit sur le disque de l'exécuteur et
pourrait se retrouver dans une archive d'artefacts ; l'environnement, lui,
disparaît avec la machine.

Usage :
    python3 scripts/configurer-signature-android.py [chemin-vers-android]

Variables d'environnement attendues :
    ANDROID_KEYSTORE_BASE64      le fichier de clé, encodé en base64
    ANDROID_KEYSTORE_PASSWORD    mot de passe du fichier
    ANDROID_KEY_ALIAS            nom de la clé dans le fichier
    ANDROID_KEY_PASSWORD         mot de passe de la clé

Le base64 peut contenir des retours à la ligne : `base64` sans l'option `-w0`
coupe sa sortie en lignes de 76 caractères, et c'est le comportement par défaut.
Ces blancs sont retirés avant décodage. En revanche le base64 « URL » (alphabet
`-` et `_`) est refusé avec un message explicite : le décoder de force
produirait un fichier de clé corrompu, et l'erreur n'apparaîtrait qu'à la
signature.
"""

from __future__ import annotations

import base64
import binascii
import os
import pathlib
import sys

# Variables attendues, avec la façon de les renseigner.
VARIABLES = {
    "ANDROID_KEYSTORE_BASE64": "le fichier de clé encodé en base64",
    "ANDROID_KEYSTORE_PASSWORD": "le mot de passe du fichier de clé",
    "ANDROID_KEY_ALIAS": "le nom de la clé dans le fichier",
    "ANDROID_KEY_PASSWORD": "le mot de passe de la clé",
}

# Le bloc ajouté dans `signingConfigs`. L'indentation reprend celle du modèle.
BLOC_RELEASE = """        release {
            // Les valeurs sont lues dans l'environnement : aucun mot de passe
            // n'est écrit dans un fichier, et rien n'est versionné.
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
"""


def erreur(message: str) -> None:
    print(f"::error::{message}")
    sys.exit(1)


def verifier_environnement() -> dict[str, str]:
    """Lit les variables attendues, ou explique précisément ce qui manque."""
    valeurs: dict[str, str] = {}
    manquantes: list[str] = []

    for nom, description in VARIABLES.items():
        valeur = os.environ.get(nom, "").strip()
        if valeur == "":
            manquantes.append(f"  - {nom} — {description}")
        else:
            valeurs[nom] = valeur

    if manquantes:
        print("::error::La clé de signature est incomplète.")
        print("")
        print("Variables absentes :")
        print("\n".join(manquantes))
        print("")
        print("La procédure de création est décrite dans docs/04-installer-sur-android.md.")
        sys.exit(1)

    return valeurs


def ecrire_keystore(dossier_android: pathlib.Path, valeurs: dict[str, str]) -> pathlib.Path:
    """Décode le fichier de clé depuis le base64 et l'écrit dans le projet."""
    brut = valeurs["ANDROID_KEYSTORE_BASE64"]

    # `base64` sans `-w0` coupe sa sortie en lignes : ces blancs ne sont pas
    # une erreur de l'utilisateur, et `b64decode` les refuserait.
    compact = "".join(brut.split())

    # Le base64 « URL » utilise `-` et `_` là où le base64 standard utilise `+`
    # et `/`. Le décoder de force donnerait un fichier de clé corrompu, et
    # l'erreur n'apparaîtrait qu'au moment de la signature.
    if "-" in compact or "_" in compact:
        erreur(
            "ANDROID_KEYSTORE_BASE64 utilise l'alphabet base64 « URL » (caractères "
            "« - » ou « _ »). Régénérez-le avec l'option standard, par exemple : "
            "base64 -w0 release.keystore"
        )

    try:
        contenu = base64.b64decode(compact, validate=True)
    except (binascii.Error, ValueError) as cause:
        erreur(f"ANDROID_KEYSTORE_BASE64 n'est pas du base64 valide ({cause}).")

    if len(contenu) == 0:
        erreur("Le fichier de clé décodé est vide.")

    # Un fichier de clé est un conteneur binaire, jamais du texte. Ce contrôle
    # attrape l'erreur la plus fréquente : avoir encodé un chemin, ou le contenu
    # d'un fichier texte, au lieu du fichier lui-même.
    if contenu.lstrip().startswith(b"-----BEGIN"):
        erreur(
            "Le contenu décodé est un certificat au format PEM, pas un fichier de clé "
            "PKCS12 ou JKS. Vérifiez que c'est bien le fichier .keystore qui a été encodé."
        )

    chemin = dossier_android / "app" / "release.keystore"
    chemin.write_bytes(contenu)
    print(f"Fichier de clé écrit : {chemin} ({len(contenu)} octets)")
    return chemin


def ajouter_bloc_release(source: str) -> str:
    """Ajoute `signingConfigs.release` avant `signingConfigs.debug`."""
    motif = "signingConfigs {\n        debug {"
    occurrences = source.count(motif)

    if occurrences != 1:
        erreur(
            f"Motif « signingConfigs » trouvé {occurrences} fois dans app/build.gradle "
            "(1 attendu). Le modèle d'Expo a changé : adapter ce script plutôt que "
            "de signer avec la clé de débogage sans s'en apercevoir."
        )

    return source.replace(motif, "signingConfigs {\n" + BLOC_RELEASE + "        debug {")


def basculer_le_type_release(source: str) -> str:
    """Fait pointer `buildTypes.release` vers la nouvelle configuration."""
    index_build_types = source.find("buildTypes {")
    if index_build_types == -1:
        erreur("Bloc « buildTypes » introuvable dans app/build.gradle.")

    index_release = source.find("release {", index_build_types)
    if index_release == -1:
        erreur("Bloc « release » introuvable dans « buildTypes ».")

    motif = "signingConfig signingConfigs.debug"
    index_signing = source.find(motif, index_release)
    if index_signing == -1:
        erreur(
            "Aucune ligne « signingConfig signingConfigs.debug » dans le bloc « release ». "
            "Le modèle d'Expo a changé."
        )

    return (
        source[:index_signing]
        + "signingConfig signingConfigs.release"
        + source[index_signing + len(motif) :]
    )


def main() -> int:
    dossier = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "android")
    fichier = dossier / "app" / "build.gradle"

    if not fichier.is_file():
        erreur(
            f"Fichier introuvable : {fichier}. Le projet Android n'a pas été généré, "
            "ou le chemin passé en argument est faux."
        )

    valeurs = verifier_environnement()
    keystore = ecrire_keystore(dossier, valeurs)

    source = fichier.read_text(encoding="utf-8")
    modifie = basculer_le_type_release(ajouter_bloc_release(source))
    fichier.write_text(modifie, encoding="utf-8")

    # Relecture : c'est le seul contrôle qui compte. Une substitution qui n'a
    # pas eu lieu produit un APK signé avec la clé de débogage, et rien ne le
    # signale avant que la mise à jour d'une application installée ne soit
    # refusée, des mois plus tard.
    relu = fichier.read_text(encoding="utf-8")

    if "signingConfig signingConfigs.release" not in relu:
        erreur("La bascule vers signingConfigs.release n'a pas été écrite.")

    if "System.getenv(\"ANDROID_KEYSTORE_PATH\")" not in relu:
        erreur("Le bloc signingConfigs.release n'a pas été écrit.")

    index_build_types = relu.find("buildTypes {")
    index_release = relu.find("release {", index_build_types)
    extrait = relu[index_release : index_release + 400]

    if "signingConfig signingConfigs.debug" in extrait:
        erreur(
            "Le bloc « release » référence encore la clé de débogage : "
            "la substitution a touché le mauvais bloc."
        )

    print("")
    print("Signature configurée :")
    print(f"  fichier de clé : {keystore}")
    print(f"  alias          : {valeurs['ANDROID_KEY_ALIAS']}")
    print("  le type « release » utilise désormais signingConfigs.release")
    print("")
    print("Extrait du bloc « release » :")
    for ligne in extrait.splitlines()[:8]:
        print(f"  {ligne}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
