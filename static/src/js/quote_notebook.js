/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { _t } from "@web/core/l10n/translation";

function initQuoteTabs(controller) {
    if (!controller.model || controller.model.name !== "ccn.service.quote") {
        return;
    }
    const notebook = controller.el.querySelector("div.o_notebook");
    if (!notebook) {
        return;
    }
    const tabs = notebook.querySelectorAll(":scope > ul.nav-tabs > li");
    tabs.forEach((li, index) => {
        li.classList.add("ccn-tab-angle");
        const a = li.querySelector("a");
        const pane = notebook.querySelector(a.getAttribute("href"));
        if (!pane || pane.querySelector(".ccn-skip")) {
            return;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary ccn-skip";
        btn.textContent = _t("No Aplica");
        pane.prepend(btn);
        btn.addEventListener("click", () => {
            li.classList.remove("ccn-tab-empty");
            li.classList.add("ccn-tab-skip");
        });
        if (!pane.querySelector("table tbody tr")) {
            li.classList.add("ccn-tab-empty");
        } else {
            li.classList.add("ccn-tab-complete");
        }
        li.addEventListener(
            "click",
            (ev) => {
                const prev = Array.from(tabs).slice(0, index);
                const ok = prev.every(
                    (p) =>
                        p.classList.contains("ccn-tab-complete") ||
                        p.classList.contains("ccn-tab-skip")
                );
                if (!ok) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    controller.displayNotification({
                        title: _t("Atención"),
                        message: _t("Completa el paso anterior."),
                        type: "warning",
                    });
                }
            },
            true
        );
        const observer = new MutationObserver(() => {
            if (pane.querySelector("table tbody tr")) {
                li.classList.remove("ccn-tab-empty");
                li.classList.add("ccn-tab-complete");
            }
        });
        observer.observe(pane, { childList: true, subtree: true });
    });
}

patch(FormController.prototype, "ccn_quote_notebook", {
    async onMounted() {
        await this._super(...arguments);
        initQuoteTabs(this);
    },
    async onWillUpdateProps() {
        await this._super(...arguments);
        initQuoteTabs(this);
    },
});
