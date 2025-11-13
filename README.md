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
