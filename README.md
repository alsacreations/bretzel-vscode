<!--
  README en français pour la page Marketplace et le dépôt
  Contenu concis : installation, usage, contribution et badge Marketplace
-->

# Bretzel layouts autocomplete

Autocomplétion des layouts Bretzel (data-layout) pour HTML / Vue / Markdown.

Cette extension facilite l'intégration des layouts : il suffit de commencer à rédiger l'attribut `data-l…` et de choisir la valeur suggérée.

Documentation et liste des layouts : <https://bretzel.alsacreations.com/>

## Installation

Installez l'extension depuis le Visual Studio Marketplace en recherchant « Bretzel layouts autocomplete », ou installez manuellement le fichier `.vsix` via l'interface Extensions de VS Code.

## Principales fonctionnalités

- Suggestions pour la valeur `data-layout`.
- Suggestions pour certains attributs associés (ex. `data-split`, `data-scroll`).
- Aide pour les variables CSS de layout quand elles sont disponibles.

## Utilisation rapide

1. Ouvrez un fichier HTML / Vue / Markdown.
2. Dans une balise, commencez à taper `data-l` : l'extension proposera les valeurs disponibles.

Exemples :

```html
<section data-layout="stack">
  <h2>Titre</h2>
  <p>Paragraphes empilés...</p>
</section>

<div data-layout="autogrid" style="--col-min-size:12rem;">
  <article>Carte 1</article>
  <article>Carte 2</article>
  <article>Carte 3</article>
</div>

<div data-layout="duo" data-split="2-1">
  <main>Contenu principal</main>
  <aside>Barre latérale</aside>
</div>
```

## Layouts disponibles

Voici les layouts proposés par l'extension (nom technique, label, usage, attributs et propriétés utiles) :

| name     | label    | usage                                                                    | attributs                                                             | propriétés CSS utiles           |
| -------- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------- |
| stack    | Stack    | Empilement vertical de blocs (formulaire, liste, sections)               | —                                                                     | —                               |
| cluster  | Cluster  | Disposition horizontale avec retour à la ligne automatique               | —                                                                     | —                               |
| autogrid | Autogrid | Grille automatique avec colonnes de même largeur (responsive)            | —                                                                     | `--col-min-size`, `--grid-fill` |
| switcher | Switcher | Bascule entre affichage horizontal et vertical selon l'espace disponible | —                                                                     | `--switcher-min-size`           |
| repel    | Repel    | Écarte les éléments aux extrémités                                       | —                                                                     | —                               |
| reel     | Reel     | Défilement horizontal avec scroll‑snap                                   | `data-scroll` (start&#124;end&#124;center), `data-scrollbar` (hidden) | `--item-size`                   |
| duo      | Duo      | Deux colonnes avec rapports personnalisables                             | `data-split` (ex: 1-1, 2-1, reverse, use `reverse`)                   | —                               |
| boxed    | Boxed    | Conteneur centré avec largeur maximale                                   | `data-boxed` (small)                                                  | `--boxed-max`                   |

> Les propriétés CSS indiquées peuvent être définies inline ou dans vos fichiers CSS.

## FAQ courte

- Où sont définis ces layouts ?

  Ils proviennent du fichier embarqué `data/layouts.json` de l'extension. Les nouvelles versions peuvent enrichir cette liste.

- Est‑ce que l'extension modifie mon code ?

  Non. Elle ne fait que proposer des complétions et des aides à l'édition.

## Feedback

Pour signaler un bug, demander un nouveau layout ou proposer une amélioration, ouvrez une issue sur le dépôt :

[https://github.com/alsacreations/bretzel-vscode](https://github.com/alsacreations/bretzel-vscode)
