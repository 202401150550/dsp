/**
 * Client plugin styling: one injected `<style>` tag (scoped class names),
 * following the dsh design tokens (`--dsw-*`) so the button and popover blend
 * with the conversation chrome.
 *
 * @module dsh-rewind/client/styles
 */
/** Class names shared between the injected DOM and the stylesheet. */
export declare const CLASS: {
    readonly button: 'dsh-rewind-btn';
    readonly popover: 'dsh-rewind-popover';
    readonly popoverTitle: 'dsh-rewind-popover-title';
    readonly popoverTarget: 'dsh-rewind-popover-target';
    readonly popoverOption: 'dsh-rewind-popover-option';
    readonly popoverOptionLabel: 'dsh-rewind-popover-option-label';
    readonly popoverOptionHint: 'dsh-rewind-popover-option-hint';
    readonly popoverImpact: 'dsh-rewind-popover-impact';
    readonly popoverActions: 'dsh-rewind-popover-actions';
    readonly popoverPrimary: 'dsh-rewind-popover-primary';
    readonly popoverGhost: 'dsh-rewind-popover-ghost';
    readonly guardHint: 'dsh-rewind-guard-hint';
};
/** The ↶ glyph, drawn inline so the bundle stays dependency-free. */
export declare const REWIND_ICON_SVG: string;
/** One injected stylesheet (scoped under `.dsh-rewind-*`). */
export declare const STYLE = "\n.dsh-rewind-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  padding: 6px;\n  border: none;\n  border-radius: 28px;\n  background: transparent;\n  color: var(--dsw-alias-label-tertiary);\n  cursor: pointer;\n}\n.dsh-rewind-btn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dsh-rewind-popover {\n  position: fixed;\n  z-index: 1000;\n  width: 288px;\n  padding: 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3));\n  box-shadow: var(--dsw-shadow-lv3);\n  font-size: 14px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n.dsh-rewind-popover-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 20px;\n}\n.dsh-rewind-popover-target {\n  margin: 4px 0 10px;\n  font-size: 12px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-tertiary);\n  word-break: break-all;\n}\n.dsh-rewind-popover-option {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  width: 100%;\n  margin: 0 0 6px;\n  padding: 8px 10px;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.dsh-rewind-popover-option:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dsh-rewind-popover-option:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n.dsh-rewind-popover-option-label {\n  font-weight: 500;\n}\n.dsh-rewind-popover-option-hint {\n  font-size: 12px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-tertiary);\n}\n.dsh-rewind-popover-impact {\n  margin: 4px 0 10px;\n  padding: 8px 10px;\n  border-radius: 8px;\n  background: var(--dsw-alias-interactive-bg-hover);\n  font-size: 12px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-secondary);\n  white-space: pre-wrap;\n  max-height: 160px;\n  overflow: auto;\n}\n.dsh-rewind-popover-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n}\n.dsh-rewind-popover-primary,\n.dsh-rewind-popover-ghost {\n  padding: 5px 12px;\n  border: none;\n  border-radius: 8px;\n  font: inherit;\n  font-size: 13px;\n  line-height: 18px;\n  cursor: pointer;\n}\n.dsh-rewind-popover-primary {\n  background: var(--dsw-alias-button-primary-fill);\n  color: var(--dsw-alias-label-primary-foreground);\n}\n.dsh-rewind-popover-primary:hover:not(:disabled) {\n  background: var(--dsw-alias-button-primary-hover);\n}\n.dsh-rewind-popover-primary:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n.dsh-rewind-popover-ghost {\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n}\n.dsh-rewind-popover-ghost:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dsh-rewind-guard-hint {\n  position: fixed;\n  z-index: 1000;\n  max-width: min(440px, calc(100vw - 24px));\n  padding: 8px 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3));\n  box-shadow: var(--dsw-shadow-lv3);\n  font-size: 13px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-primary);\n  pointer-events: none;\n}\n";
