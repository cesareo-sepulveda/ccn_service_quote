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

        const data = controller.model.root?.data || {};
        const states = {};
        const counts = {};
        const ctxStr = `${data.current_site_id || ''}|${data.current_service_type || ''}`;
        // Publica TODOS los rubro_state_* y rubro_count_* existentes en el record
        for (const [key, val] of Object.entries(data)){
            if (!key) continue;
            if (key.startsWith('rubro_state_')){
                let code = key.substring('rubro_state_'.length);
                code = normalizeCode(code);
                if (val !== undefined && val !== null) states[code] = val;
            } else if (key.startsWith('rubro_count_')){
                let code = key.substring('rubro_count_'.length);
                code = normalizeCode(code);
                const num = parseInt(val || 0, 10);
                counts[code] = Number.isNaN(num) ? 0 : num;
            }
        }

        try {
            const statesJson = JSON.stringify(states);
            const countsJson = JSON.stringify(counts);
            // Publica en 3 lugares por robustez
            el.dataset.ccnStates = statesJson;
            el.dataset.ccnCounts = countsJson;
            el.dataset.ccnCtx = ctxStr;
            const fv = (el.closest(".o_form_view") || el);
            fv.dataset.ccnStates = statesJson;
            fv.dataset.ccnCounts = countsJson;
            fv.dataset.ccnCtx = ctxStr;
            const f = (el.querySelector("form") || el);
            f.dataset.ccnStates = statesJson;
            f.dataset.ccnCounts = countsJson;
            f.dataset.ccnCtx = ctxStr;
            // Persistir en sessionStorage como respaldo
            try { sessionStorage.setItem(`ccnTabs:${ctxStr}`, JSON.stringify({states, acks: {}})); } catch(_e) {}
        } catch (_e) { /* ignore */ }
    } catch (e) {
        // silencioso
    }
}

export function initQuoteNotebook(controller) {
    if (controller?.model?.name !== "ccn.service.quote") return;
    ensureCurrentSite(controller);
    publishStates(controller);
    try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
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
