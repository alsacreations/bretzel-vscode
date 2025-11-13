<!--
  README en français pour la page Marketplace et le dépôt
  Contenu concis : installation, usage, contribution et badge Marketplace
-->

# Bretzel layouts autocomplete

Autocomplétion des layouts Bretzel (data-layout) pour HTML / Vue / Markdown.

## Installation

Installez depuis le Visual Studio Marketplace : recherchez « Bretzel layouts autocomplete » ou utilisez le `.vsix` généré.

## Utilisation

- Ouvrez un fichier HTML, Vue ou Markdown.
- Dans vos éléments, tapez `data-layout` et l'autocomplétion proposera les layouts disponibles définis dans `data/layouts.json`.

## Développement

Compiler :

```bash
pnpm install
pnpm run compile
```

Générer le package local :

```bash
npx @vscode/vsce package
```

Pour publier manuellement :

```bash
export VSCE_PAT="votre_token"
npx @vscode/vsce publish patch --pat "$VSCE_PAT"
```

## Changelog

Voir `CHANGELOG.md`.

## Licence

Licence à préciser (ajoutez un fichier `LICENSE` ou `LICENSE.md`).

## Badge Marketplace

Après publication, ajoutez le badge suivant en remplaçant `<publisher>` et `<extension>` :

`[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/<publisher>.<extension>.svg)](https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension>)`

---

Documenté et maintenu par Alsacreations.

# Bretzel VSCode — Autocomplétion des layouts

Extension minimale fournie pour proposer des attributs `data-layout` de Bretzel.

Comportement actuel :

- Dans les fichiers HTML, Vue ou Markdown, quand le mot en cours commence par `data`, la complétion propose des entrées du fichier `data/layouts.json`.

Comment tester localement :

1. Ouvrir le dossier racine du workspace dans VS Code (contenant `bretzel-vscode`).
2. Aller dans l'explorateur sur `bretzel-vscode` et ouvrir le panneau Run (Debug).
3. Lancer la configuration "Run Extension" (F5). Une nouvelle fenêtre VS Code en développement s'ouvrira.
4. Dans un fichier `.html`, commencer à écrire `data` et vérifier les propositions.

Prochaines étapes : remplir `data/layouts.json` avec la liste complète des layouts Bretzel, ajouter snippets, et améliorer le trigger/context.
