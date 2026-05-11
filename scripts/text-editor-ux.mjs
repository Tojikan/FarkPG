/* global foundry */

/** Prefer over global `TextEditor` (removed in Foundry V15). */
export function textEditorUx() {
  return foundry.applications.ux.TextEditor.implementation;
}
