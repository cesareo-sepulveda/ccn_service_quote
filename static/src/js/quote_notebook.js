/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { _t } from "@web/core/l10n/translation";

function panelCode(pane) {
    const name = pane.getAttribute("name") || "";
    const m = name.match(/^page_(.+)$/);
    return m ? m[1] : null;
}

export function initQuoteTabs(controller) {
    if (!controller.model || controller.model.name !== "ccn.service.quote") {
        return;
    }
    const notebook = controller.el.querySelector("div.o_notebook");
    if (!notebook) {
        return;
    }
    notebook.querySelectorAll(".o_notebook_page").forEach((pane) => {
        if (pane.querySelector(".ccn-skip")) {
            return;
        }
        const code = panelCode(pane);
        if (!code) {
            return;
        }
        // Estado inicial desde campos rubro_state_*
        const stateField = `rubro_state_${code}`;
        const state = controller.model.root.data[stateField];
        if (state === "yellow") {
            pane.dataset.ccnAck = "1";
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary ccn-skip";
        btn.textContent = pane.dataset.ccnAck === "1" ? _t("Quitar No Aplica") : _t("No Aplica");
        pane.prepend(btn);
        btn.addEventListener("click", async () => {
            const ack = pane.dataset.ccnAck === "1";
            const method = ack ? "action_unmark_rubro_empty" : "action_mark_rubro_empty";
            const orm = controller.model.orm || controller.orm;
            await orm.call(
                "ccn.service.quote",
                method,
                [[controller.model.root.data.id]],
                { context: { rubro_code: code } }
            );
            pane.dataset.ccnAck = ack ? "0" : "1";
            btn.textContent = pane.dataset.ccnAck === "1" ? _t("Quitar No Aplica") : _t("No Aplica");
            if (window.__ccnTabsDebug && window.__ccnTabsDebug.applyAll) {
                window.__ccnTabsDebug.applyAll();
            }
        });
    });
    if (window.__ccnTabsDebug && window.__ccnTabsDebug.applyAll) {
        window.__ccnTabsDebug.applyAll();
    }
}

patch(FormController.prototype, {
    patchName: "ccn_quote_notebook",
    async onMounted() {
        if (this._super) {
            await this._super(...arguments);
        }
        initQuoteTabs(this);
    },
    async onWillUpdateProps() {
        if (this._super) {
            await this._super(...arguments);
        }
        initQuoteTabs(this);
    },
});
