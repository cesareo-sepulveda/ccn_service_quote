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
        const data = controller?.model?.root?.data || {};
        const states = {};
        const counts = {};
        // Contexto completo para evitar contaminar entre registros: id|site|service
        const rid = controller?.model?.root?.resId || data.id || 'new';
        const ctxStr = `${rid}|${data.current_site_id || ''}|${data.current_service_type || ''}`;

        // Determinar sufijo según el tipo de servicio actual
        const currentService = data.current_service_type || '';
        let suffix = '';
        if (currentService === 'jardineria') {
            suffix = '_jard';
        } else if (currentService === 'limpieza') {
            suffix = '_limp';
        }

        // Leer estados específicos por servicio si existe el sufijo, sino usar genéricos
        for (const [key, val] of Object.entries(data)){
            if (!key) continue;

            // Priorizar campos específicos por servicio (_jard o _limp)
            if (suffix && key.startsWith('rubro_state_') && key.endsWith(suffix)){
                let code = key.substring('rubro_state_'.length, key.length - suffix.length);
                code = normalizeCode(code);
                if (val !== undefined && val !== null) {
                    states[code] = val;
                }
            }
            // Fallback a campos genéricos solo si no hay sufijo (otros servicios)
            else if (!suffix && key.startsWith('rubro_state_') && !key.includes('_jard') && !key.includes('_limp')){
                let code = key.substring('rubro_state_'.length);
                code = normalizeCode(code);
                if (val !== undefined && val !== null) {
                    states[code] = val;
                }
            }
            // Contadores (mantener lógica original)
            else if (key.startsWith('rubro_count_') && !key.includes('_jard') && !key.includes('_limp')){
                let code = key.substring('rubro_count_'.length);
                code = normalizeCode(code);
                const num = parseInt(val || 0, 10);
                counts[code] = Number.isNaN(num) ? 0 : num;
            }
        }

        try {
            const statesJson = JSON.stringify(states);
            const countsJson = JSON.stringify(counts);
            
            // Publicar en el form view (siempre existe)
            const fv = document.querySelector(".o_form_view");
            if (fv) {
                fv.dataset.ccnStates = statesJson;
                fv.dataset.ccnCounts = countsJson;
                fv.dataset.ccnCtx = ctxStr;
            }

            // Publicar en notebook si existe
            const notebook = document.querySelector(".o_notebook");
            if (notebook) {
                notebook.dataset.ccnStates = statesJson;
                notebook.dataset.ccnCounts = countsJson;
                notebook.dataset.ccnCtx = ctxStr;
            }
            
            // Persistir en sessionStorage como respaldo
            try { sessionStorage.setItem(`ccnTabs:${ctxStr}`, JSON.stringify({states, acks: {}})); } catch(_e) {}
        } catch (_e) {
            console.error('Error publishing states:', _e);
        }
    } catch (e) {
        // silencioso
    }
}

function initQuoteNotebook(controller) {
    if (!controller?.model || controller.model.name !== "ccn.service.quote") return;
    const el = controller.el || document.querySelector('.o_form_view');
    ensureCurrentSite(controller);

    // Publicar estados con delay
    setTimeout(() => {
        publishStates(controller);
        try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
    }, 50);
}

patch(FormController.prototype, {
    setup() {
        super.setup();
        // Publicar con delay en setup inicial
        setTimeout(() => initQuoteNotebook(this), 100);

        // Agregar listener para cambios en el formulario
        const self = this;
        const observer = new MutationObserver((muts) => {
            let hasServiceTypeChange = false;
            for (const mut of muts) {
                const t = mut.target;
                if (t && (t.getAttribute('name') === 'current_service_type' || t.getAttribute('data-name') === 'current_service_type')) {
                    hasServiceTypeChange = true;
                    break;
                }
            }
            if (hasServiceTypeChange) {
                setTimeout(() => publishStates(self), 10);
            }
            setTimeout(() => initQuoteNotebook(self), 100);
        });

        // Observar cambios en el form, pero no en datasets para evitar loop
        setTimeout(() => {
            const form = document.querySelector('.o_form_view');
            if (form) {
                observer.observe(form, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'data-value', 'value']  // evitar data-ccn-* para no loop
                });
            }
        }, 1000);
    },
    onWillUpdateProps() {
        super.onWillUpdateProps(...arguments);
        // En updates, publicar con delay
        setTimeout(() => initQuoteNotebook(this), 50);
    },
});
