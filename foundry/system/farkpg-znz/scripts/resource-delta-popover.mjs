/**
 * Toggle a small numeric popover below and to the right of `trigger` for
 * applying a signed delta (e.g. HP / EXP quick adjust).
 *
 * @param {HTMLElement} anchor   Positioned wrapper (`position: relative`).
 * @param {HTMLElement} trigger  Usually a `<button>`.
 * @param {(delta: number) => void | Promise<void>} onApplyDelta
 * @param {AbortSignal} signal
 * @param {{ inputLabel?: string; applyLabel?: string }} [labels]
 */
export function bindDeltaPopover(anchor, trigger, onApplyDelta, signal, labels = {}) {
    /** @type {HTMLElement|null} */
    let pop = null;

    const close = () => {
        pop?.remove();
        pop = null;
    };

    const open = () => {
        if (pop) {
            close();
            return;
        }
        pop = document.createElement("div");
        pop.className = "farkpg-delta-popover";
        pop.setAttribute("role", "dialog");
        const inputId = `farkpg-delta-${foundry.utils.randomID()}`;
        const lbl = labels.inputLabel ?? "";
        const applyLbl = labels.applyLabel ?? game.i18n.localize("FARKPG.ResourceDelta.apply");
        pop.innerHTML = `
            <div class="farkpg-delta-popover-inner">
                ${lbl ? `<label class="farkpg-delta-popover-lbl" for="${inputId}">${lbl}</label>` : ""}
                <div class="farkpg-delta-popover-row">
                    <input type="number" step="any" class="farkpg-delta-popover-inp" id="${inputId}" value="0" />
                    <button type="button" class="farkpg-delta-popover-apply">${applyLbl}</button>
                </div>
            </div>
        `;
        anchor.appendChild(pop);

        const inp = /** @type {HTMLInputElement} */ (pop.querySelector("input"));
        const applyBtn = pop.querySelector("button");
        inp?.focus?.();
        inp?.select?.();

        const apply = async () => {
            const raw = Number(inp?.value ?? 0);
            if (!Number.isFinite(raw)) return;
            await onApplyDelta(raw);
            close();
        };

        applyBtn?.addEventListener(
            "click",
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                void apply();
            },
            { signal },
        );

        inp?.addEventListener(
            "keydown",
            (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    void apply();
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                }
            },
            { signal },
        );
    };

    trigger.addEventListener(
        "click",
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            open();
        },
        { signal },
    );

    document.addEventListener(
        "pointerdown",
        (e) => {
            if (!pop) return;
            const t = e.target;
            if (t instanceof Node && (pop.contains(t) || trigger.contains(t))) return;
            close();
        },
        { capture: true, signal },
    );
}
