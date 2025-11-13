"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
/// <reference types="node" />
/// <reference types="vscode" />
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
    const layouts = loadLayouts(context.extensionPath);
    const selector = [
        { language: "html", scheme: "file" },
        { language: "vue", scheme: "file" },
        { language: "markdown", scheme: "file" },
    ];
    const provider = vscode.languages.registerCompletionItemProvider(selector, {
        provideCompletionItems(document, position) {
            console.log("[bretzel] provideCompletionItems called at", position.line, position.character);
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
            const docTextBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
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
            const insideQuotes = (singleQuotes % 2 === 1 || doubleQuotes % 2 === 1) && !justTypedQuote;
            if (insideQuotes) {
                // inside an attribute value
                return undefined;
            }
            const items = [];
            console.log("[bretzel] prefix ok, layouts count=", layouts.length);
            // compute replacement range for the current prefix so the completion replaces only the 'data...' part
            const replaceRange = new vscode.Range(new vscode.Position(position.line, position.character - prefix.length), position);
            for (const l of layouts) {
                // Use normal double quotes in label/insertText (no backslashes) so VS Code filtering works correctly
                const label = `data-layout="${l.name}"`;
                const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Property);
                item.detail = `Layout : ${l.label}`;
                const doc = new vscode.MarkdownString();
                if (l.usage)
                    doc.appendMarkdown(`**Usage:** ${l.usage}\n\n`);
                // Render attributes: support array of objects, string, or empty/undefined
                if (Array.isArray(l.attributes)) {
                    if (l.attributes.length === 0) {
                        doc.appendMarkdown(`**Attributs spécifiques:** aucun\n\n`);
                    }
                    else {
                        doc.appendMarkdown(`**Attributs spécifiques:**\n\n`);
                        for (const a of l.attributes) {
                            if (a && typeof a === "object") {
                                const name = a.name || JSON.stringify(a);
                                const val = a.value;
                                const desc = a.description || "";
                                if (val) {
                                    // show as name="value" and description after an em-dash
                                    doc.appendMarkdown(`- \`${name}="${val}"\`${desc ? ` — ${desc}` : ``}\n`);
                                }
                                else if (desc) {
                                    // if no explicit value but description exists, try to split a leading value if present
                                    const m = desc.match(/^"([^"]+)"\s*—\s*(.*)$/u);
                                    if (m) {
                                        const mval = m[1];
                                        const mrest = m[2];
                                        doc.appendMarkdown(`- \`${name}="${mval}"\` — ${mrest}\n`);
                                    }
                                    else {
                                        doc.appendMarkdown(`- \`${name}\`${desc ? `: ${desc}` : ""}\n`);
                                    }
                                }
                                else {
                                    doc.appendMarkdown(`- \`${name}\`\n`);
                                }
                            }
                            else {
                                // fallback for strings or unexpected values
                                doc.appendMarkdown(`- ${String(a)}\n`);
                            }
                        }
                        doc.appendMarkdown(`\n`);
                    }
                }
                else if (typeof l.attributes === "string" && l.attributes) {
                    doc.appendMarkdown(`**Attributs spécifiques:** ${l.attributes}\n\n`);
                }
                else {
                    // no attributes provided
                    doc.appendMarkdown(`**Attributs spécifiques:** aucun\n\n`);
                }
                // Render properties (CSS variables). Always show header and 'aucun' if empty.
                if (Array.isArray(l.properties)) {
                    if (l.properties.length === 0) {
                        doc.appendMarkdown(`**Variables spécifiques:** aucun\n\n`);
                    }
                    else {
                        doc.appendMarkdown(`**Variables spécifiques:**\n\n`);
                        for (const p of l.properties) {
                            if (p && typeof p === "object") {
                                const name = p.name || JSON.stringify(p);
                                const val = p.value;
                                const desc = p.description || "";
                                if (val) {
                                    doc.appendMarkdown(`- \`${name}="${val}"\`${desc ? ` — ${desc}` : ""}\n`);
                                }
                                else {
                                    doc.appendMarkdown(`- \`${name}\`${desc ? `: ${desc}` : ""}\n`);
                                }
                            }
                            else {
                                doc.appendMarkdown(`- ${String(p)}\n`);
                            }
                        }
                        doc.appendMarkdown(`\n`);
                    }
                }
                else if (l.properties && l.properties.length > 0) {
                    // fallback if properties is truthy but not an array
                    doc.appendMarkdown(`**Variables spécifiques:** ${String(l.properties)}\n\n`);
                }
                else {
                    doc.appendMarkdown(`**Variables spécifiques:** aucun\n\n`);
                }
                item.documentation = doc;
                // Use a snippet so the user can tab through and change the layout value
                // insertText should not contain backslashes
                item.insertText = new vscode.SnippetString(`data-layout="${"${1:" + l.name + "}"}"`);
                // ensure VS Code replaces the detected prefix when applying this completion
                // (helps matching/filtering and avoids leaving 'data-' behind)
                // @ts-ignore - CompletionItem.range exists in newer API
                item.range = replaceRange;
                // help the filter algorithm: set filterText and a short label (no escapes)
                item.filterText = `data-layout="${l.name}"`;
                item.preselect = true;
                // put our suggestions first
                item.sortText = `\u0000_${l.name}`;
                items.push(item);
            }
            return items;
        },
    }, "a", "d", "-", '"', "=" // trigger characters: include '-' so provider runs when typing data-
    );
    context.subscriptions.push(provider);
    // Listen to document changes and trigger suggest when user types `data-`.
    const changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor)
                return;
            if (editor.document !== e.document)
                return;
            const lang = editor.document.languageId;
            if (!["html", "vue", "markdown"].includes(lang))
                return;
            for (const ch of e.contentChanges) {
                // if the user just typed a hyphen or a quote, check the text before the cursor
                if (ch.text === "-" || ch.text === '"' || ch.text === "'") {
                    const pos = editor.selection.active;
                    const linePrefix = editor.document
                        .lineAt(pos.line)
                        .text.substring(0, pos.character);
                    if (/\bdata-$/.test(linePrefix)) {
                        console.log("[bretzel] detected data- ; triggering suggest at", pos.line, pos.character);
                        // force the suggestion widget to open and log result
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        vscode.commands.executeCommand("editor.action.triggerSuggest").then(() => console.log("[bretzel] triggerSuggest succeeded"), (err) => console.error("[bretzel] triggerSuggest failed", err));
                    }
                }
            }
        }
        catch (err) {
            console.error("[bretzel] changeListener error", err);
        }
    });
    context.subscriptions.push(changeListener);
}
function loadLayouts(extensionPath) {
    try {
        const file = path.join(extensionPath, "data", "layouts.json");
        const content = fs.readFileSync(file, { encoding: "utf8" });
        const parsed = JSON.parse(content);
        return parsed;
    }
    catch (e) {
        console.error("Impossible de charger data/layouts.json", e);
        return [];
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map