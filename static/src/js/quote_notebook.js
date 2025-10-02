/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

function normalizeCode(code) {
    return code === "herr_menor_jardineria" ? "herramienta_menor_jardineria" : code;
}

function ensureCurrentSite(controller) {
    try {
        if (!controller?.model || controller.model.name !== "ccn.service.quote") return;
        const root = controller.model.root;
        const data = root?.data || {};
        if (data.current_site_id) return;
        const sites = data.site_ids || [];
        if (!Array.isArray(sites) || !sites.length) return;
        let firstId = null;
        const s0 = sites[0];
        if (typeof s0 === "number") firstId = s0;
        else if (s0 && (typeof s0 === "object")) {
            firstId = s0.id || s0.resId || s0.resourceId || null;
        }
        if (firstId) {
            root.update({ current_site_id: firstId });
        }
    } catch (_e) { /* ignore */ }
}

function publishStates(controller) {
    try {
        if (!controller?.model || controller.model.name !== "ccn.service.quote") return;
        const el = controller.el;
        const notebook = el.querySelector(".o_notebook");
        if (!notebook) return;

        const links = notebook.querySelectorAll('.nav-tabs .nav-link[name^="page_"], .nav-tabs .nav-link[aria-controls^="page_"]');
        const data = controller.model.root?.data || {};
        const states = {};

        links.forEach((a) => {
            const nameAttr = a.getAttribute("name") || "";
            const mName = nameAttr.match(/^page_(.+)$/);
            let code = mName ? mName[1] : null;
            if (!code) {
                const t = (a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/, "");
                const mT = t.match(/^page_(.+)$/);
                code = mT ? mT[1] : null;
            }
            if (!code) return;
            code = normalizeCode(code);
            const field = `rubro_state_${code}`;
            const v = data[field];
            if (v) states[code] = v;
        });

        const json = JSON.stringify(states);
        // Publica en 3 lugares por robustez
        el.dataset.ccnStates = json;
        (el.closest(".o_form_view") || el).dataset.ccnStates = json;
        (el.querySelector("form") || el).dataset.ccnStates = json;
    } catch (e) {
        // silencioso
    }
}

export function initQuoteNotebook(controller) {
    if (controller?.model?.name !== "ccn.service.quote") return;
    ensureCurrentSite(controller);
    publishStates(controller);
}

patch(FormController.prototype, {
    patchName: "ccn_quote_notebook_publish_states",
    async onMounted() {
        if (this._super) await this._super(...arguments);
        initQuoteNotebook(this);
    },
    async onWillUpdateProps() {
        if (this._super) await this._super(...arguments);
        initQuoteNotebook(this);
    },
});
