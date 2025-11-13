/// <reference types="node" />
/// <reference types="vscode" />
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface LayoutEntry {
  name: string;
  label: string;
  usage?: string;
  // attributes can be a human string or an array of attribute objects
  // we now support { name, value?, description? } to separate example values
  attributes?:
    | string
    | Array<{ name: string; value?: string; description?: string }>;
  // globalAttributes are attributes that are common across layouts (eg data-gap)
  globalAttributes?:
    | string
    | Array<{ name: string; value?: string; description?: string }>;
  // properties: array of specific variables for this layout (e.g. data-scroll, data-split)
  properties?: Array<{ name: string; value?: string; description?: string }>;
}

export function activate(context: vscode.ExtensionContext) {
  const { layouts, rootGlobalAttributes } = loadLayouts(context.extensionPath);

  const selector: vscode.DocumentSelector = [
    { language: "html", scheme: "file" },
    { language: "vue", scheme: "file" },
    { language: "markdown", scheme: "file" },
  ];

  const provider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        console.log(
          "[bretzel] provideCompletionItems called at",
          position.line,
          position.character
        );
        const linePrefix = document
          .lineAt(position.line)
          .text.substring(0, position.character);

        // quick check: ensure the characters before the cursor end with 'data' or 'data-' (robust to hyphen)
        // also accept an immediately-typed quote after data- (e.g. data-" or data-')
        // examples matched: 'data', 'data-', 'data-layout', 'data-"'
        const dataMatch = linePrefix.match(/(?:^|\b)(data[-\w]*)(?:['"])?$/);
        if (!dataMatch) {
          return undefined;
        }
        const prefix = dataMatch[1];

        // Heuristic: only trigger inside an HTML tag (between '<' and '>') and not inside a quoted attribute value
        const docTextBefore = document.getText(
          new vscode.Range(new vscode.Position(0, 0), position)
        );
        const lastOpen = docTextBefore.lastIndexOf("<");
        const lastClose = docTextBefore.lastIndexOf(">");
        if (lastOpen === -1 || lastOpen < lastClose) {
          // not inside a tag
          return undefined;
        }

        // ensure not inside quotes between lastOpen and position
        const between = docTextBefore.substring(lastOpen);
        const singleQuotes = (between.match(/'/g) || []).length;
        const doubleQuotes = (between.match(/"/g) || []).length;
        // If the user just typed a quote (the last character before the cursor is a quote),
        // allow completion — this corresponds to typing data-" and we want suggestions immediately.
        const lastChar = linePrefix.charAt(linePrefix.length - 1);
        const justTypedQuote = lastChar === '"' || lastChar === "'";
        const insideQuotes =
          (singleQuotes % 2 === 1 || doubleQuotes % 2 === 1) && !justTypedQuote;
        if (insideQuotes) {
          // inside an attribute value
          return undefined;
        }

        const items: vscode.CompletionItem[] = [];
        console.log("[bretzel] prefix ok, layouts count=", layouts.length);
        // compute replacement range for the current prefix so the completion replaces only the 'data...' part
        const replaceRange = new vscode.Range(
          new vscode.Position(
            position.line,
            position.character - prefix.length
          ),
          position
        );

        // Try to detect the current layout value in the same tag so we can
        // propose attributes specific to that layout (with per-layout defaults).
        const layoutInTagMatch = between.match(
          /data-layout=(?:"|')?([\w-]+)(?:"|')?/u
        );
        const activeLayoutName = layoutInTagMatch
          ? layoutInTagMatch[1]
          : undefined;
        const activeLayout = activeLayoutName
          ? layouts.find((x) => x.name === activeLayoutName)
          : undefined;

        for (const l of layouts) {
          // Prepare original short label used for filtering
          const originalLabel = `data-layout="${l.name}"`;
          // Keep the completion compact: use a short detail and avoid a large
          // Markdown documentation block which increases the suggest widget height.
          // Move longer descriptions to the detail field (single line).
          // Build a single-line base detail: sanitize label and usage to remove
          // newlines and excessive whitespace (some entries in layouts.json may
          // contain multi-line descriptions). This prevents VS Code from
          // rendering a large documentation panel for the selected suggestion.
          const sanitize = (s: string) => s.replace(/\s+/g, " ").trim();
          // Keep the short detail concise: only the layout label (no usage).
          // Showing the usage inside the `documentation` Markdown is sufficient
          // and avoids duplicating the same text in the suggestion UI.
          const rawBase = l.label;
          let baseDetail = sanitize(rawBase);
          const MAX_BASE_LEN = 120;
          if (baseDetail.length > MAX_BASE_LEN) {
            baseDetail = baseDetail.slice(0, MAX_BASE_LEN - 1) + "…";
          }
          // Build summaries for specific and global attributes. The column
          // description should show only *specific* attributes; global
          // attributes will be shown in the documentation under their own
          // heading.
          let specificsSummary = "";
          if (Array.isArray(l.attributes) && l.attributes.length > 0) {
            const parts: string[] = [];
            for (const a of l.attributes) {
              if (a && typeof a === "object") {
                const name = (a as any).name || JSON.stringify(a);
                const val = (a as any).value;
                parts.push(val ? `${name}="${val}"` : `${name}`);
              } else {
                parts.push(String(a));
              }
            }
            specificsSummary = parts.join("; ");
          } else if (typeof l.attributes === "string" && l.attributes) {
            specificsSummary = String(l.attributes);
          }

          // Build effective global attributes by merging root/global definitions
          // with any per-layout overrides (backwards compatible with previous
          // format where layouts could define full `globalAttributes`).
          let globalsSummary = "";
          const effectiveGlobalsMap = new Map<string, any>();
          // start with root global attributes (if any)
          if (
            Array.isArray(rootGlobalAttributes) &&
            rootGlobalAttributes.length
          ) {
            for (const a of rootGlobalAttributes) {
              if (a && typeof a === "object" && a.name) {
                effectiveGlobalsMap.set(a.name, { ...a });
              }
            }
          }
          // If layout defines globalAttributeDefaults or legacy globalAttributes,
          // apply them as overrides (or include them if root has none).
          const perLayoutGlobalsCandidates: any[] = [];
          if (Array.isArray((l as any).globalAttributeDefaults)) {
            perLayoutGlobalsCandidates.push(
              ...(l as any).globalAttributeDefaults
            );
          }
          if (Array.isArray((l as any).globalAttributes)) {
            // legacy: treat these entries as either overrides or full definitions
            perLayoutGlobalsCandidates.push(...(l as any).globalAttributes);
          }
          for (const a of perLayoutGlobalsCandidates) {
            if (a && typeof a === "object" && a.name) {
              if (effectiveGlobalsMap.has(a.name)) {
                effectiveGlobalsMap.set(a.name, {
                  ...effectiveGlobalsMap.get(a.name),
                  ...a,
                });
              } else {
                effectiveGlobalsMap.set(a.name, { ...a });
              }
            } else if (a) {
              // fallback: non-object entry
              effectiveGlobalsMap.set(String(a), { name: String(a) });
            }
          }
          // produce summary string from effective globals map
          if (effectiveGlobalsMap.size > 0) {
            const parts: string[] = [];
            for (const [, a] of effectiveGlobalsMap) {
              const name = a.name || JSON.stringify(a);
              const val = a.value;
              const def = a.valueDefault || a.default || a.defaultValue;
              if (val) {
                parts.push(
                  def
                    ? `${name}="${val}" (défaut : ${def})`
                    : `${name}="${val}"`
                );
              } else {
                parts.push(def ? `${name} (défaut : ${def})` : `${name}`);
              }
            }
            globalsSummary = parts.join("; ");
          }

          // Ensure the summaries are single-line and reasonably short.
          specificsSummary = specificsSummary.replace(/\s+/g, " ").trim();
          globalsSummary = globalsSummary.replace(/\s+/g, " ").trim();
          const MAX_DETAIL_LEN = 100;
          if (specificsSummary.length > MAX_DETAIL_LEN) {
            specificsSummary =
              specificsSummary.slice(0, MAX_DETAIL_LEN - 1) + "…";
          }
          if (globalsSummary.length > MAX_DETAIL_LEN) {
            globalsSummary = globalsSummary.slice(0, MAX_DETAIL_LEN - 1) + "…";
          }

          // Use the CompletionItemLabel form so the summary appears as a
          // description next to the label in the main suggestion column.
          // This keeps the information inline and reduces the chance that the
          // editor will move it into a large documentation preview panel.
          const visibleLabelObj: vscode.CompletionItemLabel = {
            label: originalLabel,
            description: specificsSummary || undefined,
          };
          const item = new vscode.CompletionItem(
            visibleLabelObj,
            vscode.CompletionItemKind.Property
          );
          // Keep detail concise (usage only).
          item.detail = baseDetail;

          // Build a Markdown documentation block so the user can expand the
          // completion item to see full details. We keep the content
          // structured but reasonably short to avoid excessive size.
          const doc = new vscode.MarkdownString();
          if (l.usage) {
            doc.appendMarkdown(`**Usage:** ${sanitize(l.usage)}\n\n`);
          }

          // Debug: report which attribute collections exist for this layout
          try {
            console.log(
              `[bretzel] layout ${l.name} - globalAttributes: ${
                Array.isArray((l as any).globalAttributes)
                  ? (l as any).globalAttributes.length
                  : typeof (l as any).globalAttributes
              }, attributes: ${
                Array.isArray(l.attributes)
                  ? l.attributes.length
                  : typeof l.attributes
              }`
            );
          } catch (e) {}

          // Attributes section (specific to this layout)
          if (Array.isArray(l.attributes)) {
            if (l.attributes.length === 0) {
              doc.appendMarkdown(`**Attributs HTML spécifiques :** aucun\n\n`);
            } else {
              doc.appendMarkdown(`**Attributs HTML spécifiques :**\n\n`);
              for (const a of l.attributes) {
                if (a && typeof a === "object") {
                  const name = (a as any).name || JSON.stringify(a);
                  const val = (a as any).value;
                  const desc = (a as any).description || "";
                  if (val) {
                    doc.appendMarkdown(
                      `- \`${name}="${val}"\` — ${sanitize(desc)}\n`
                    );
                  } else {
                    doc.appendMarkdown(
                      `- \`${name}\` ${desc ? `— ${sanitize(desc)}` : ""}\n`
                    );
                  }
                } else {
                  doc.appendMarkdown(`- ${String(a)}\n`);
                }
              }
              doc.appendMarkdown(`\n`);
            }
          } else if (typeof l.attributes === "string" && l.attributes) {
            doc.appendMarkdown(
              `**Attributs HTML spécifiques :** ${sanitize(
                String(l.attributes)
              )}\n\n`
            );
          }

          // Properties (CSS variables)
          if (Array.isArray(l.properties)) {
            if (l.properties.length === 0) {
              doc.appendMarkdown(`**Variables CSS spécifiques :** aucun\n\n`);
            } else {
              doc.appendMarkdown(`**Variables CSS spécifiques :**\n\n`);
              for (const p of l.properties) {
                if (p && typeof p === "object") {
                  const pname = (p as any).name || JSON.stringify(p);
                  const pdesc = (p as any).description || "";
                  doc.appendMarkdown(
                    `- \`${pname}\` ${pdesc ? `— ${sanitize(pdesc)}` : ""}\n`
                  );
                } else {
                  doc.appendMarkdown(`- ${String(p)}\n`);
                }
              }
              doc.appendMarkdown(`\n`);
            }
          }

          // --- Attributs HTML globaux (render after specifics & properties)
          if (effectiveGlobalsMap.size === 0) {
            doc.appendMarkdown(`**Attributs HTML globaux :** aucun\n\n`);
          } else {
            doc.appendMarkdown(`**Attributs HTML globaux :**\n\n`);
            for (const [, a] of effectiveGlobalsMap) {
              const name = a.name || JSON.stringify(a);
              const val = a.value;
              const desc = a.description || "";
              const def = a.valueDefault || a.default || a.defaultValue;
              if (val) {
                if (def) {
                  doc.appendMarkdown(
                    `- \`${name}="${val}"\` — ${sanitize(
                      desc
                    )} (défaut : ${def})\n`
                  );
                } else {
                  doc.appendMarkdown(
                    `- \`${name}="${val}"\` — ${sanitize(desc)}\n`
                  );
                }
              } else {
                if (def) {
                  doc.appendMarkdown(
                    `- \`${name}\` — ${sanitize(desc)} (défaut : ${def})\n`
                  );
                } else {
                  doc.appendMarkdown(
                    `- \`${name}\` ${desc ? `— ${sanitize(desc)}` : ""}\n`
                  );
                }
              }
            }
            doc.appendMarkdown(`\n`);
          }

          item.documentation = doc;
          // Use a snippet so the user can tab through and change the layout value
          // insertText should not contain backslashes
          item.insertText = new vscode.SnippetString(
            `data-layout="${"${1:" + l.name + "}"}"`
          );
          // ensure VS Code replaces the detected prefix when applying this completion
          // (helps matching/filtering and avoids leaving 'data-' behind)
          // @ts-ignore - CompletionItem.range exists in newer API
          item.range = replaceRange;
          // help the filter algorithm: set filterText and a short label (no escapes)
          item.filterText = originalLabel;
          item.preselect = true;
          // put our suggestions first
          item.sortText = `\u0000_${l.name}`;
          items.push(item);
        }

        return items;
      },
    },
    "a",
    "d",
    "-",
    '"',
    "=" // trigger characters: include '-' so provider runs when typing data-
  );

  context.subscriptions.push(provider);

  // Listen to document changes and trigger suggest when user types `data-`.
  const changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (editor.document !== e.document) return;
      const lang = editor.document.languageId;
      if (!["html", "vue", "markdown"].includes(lang)) return;

      for (const ch of e.contentChanges) {
        // if the user just typed a hyphen or a quote, check the text before the cursor
        if (ch.text === "-" || ch.text === '"' || ch.text === "'") {
          const pos = editor.selection.active;
          const linePrefix = editor.document
            .lineAt(pos.line)
            .text.substring(0, pos.character);
          if (/\bdata-$/.test(linePrefix)) {
            console.log(
              "[bretzel] detected data- ; triggering suggest at",
              pos.line,
              pos.character
            );
            // force the suggestion widget to open and log result
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.commands.executeCommand("editor.action.triggerSuggest").then(
              () => console.log("[bretzel] triggerSuggest succeeded"),
              (err) => console.error("[bretzel] triggerSuggest failed", err)
            );
          }
        }
      }
    } catch (err) {
      console.error("[bretzel] changeListener error", err);
    }
  });

  context.subscriptions.push(changeListener);
}

function loadLayouts(extensionPath: string): {
  layouts: LayoutEntry[];
  rootGlobalAttributes?: Array<{
    name: string;
    value?: string;
    description?: string;
  }>;
} {
  try {
    const file = path.join(extensionPath, "data", "layouts.json");
    const content = fs.readFileSync(file, { encoding: "utf8" });
    const parsed = JSON.parse(content);
    // Support two formats for backwards compatibility:
    // - Old format: parsed is an array of layouts
    // - New format: parsed is an object { globalAttributes: [...], layouts: [...] }
    if (Array.isArray(parsed)) {
      return { layouts: parsed as LayoutEntry[] };
    }
    if (parsed && typeof parsed === "object") {
      const rootGlobalAttributes = Array.isArray(parsed.globalAttributes)
        ? parsed.globalAttributes
        : undefined;
      const layouts = Array.isArray(parsed.layouts) ? parsed.layouts : [];
      return { layouts: layouts as LayoutEntry[], rootGlobalAttributes };
    }
    return { layouts: [] };
  } catch (e) {
    console.error("Impossible de charger data/layouts.json", e);
    return { layouts: [] };
  }
}

export function deactivate() {}
