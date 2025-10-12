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

// Helpers DOM para leer valores de campos invisibles/visibles
function readIntFieldDOM(name){
    try{
        const el = document.querySelector(`[name="${name}"]`) || document.querySelector(`[data-name="${name}"]`);
        if (!el) return null;
        const sel = el.querySelector && el.querySelector('select');
        let raw;
        if (sel) raw = sel.value;
        if (raw == null) raw = el.getAttribute('data-value');
        if (raw == null) raw = el.getAttribute('value');
        if (raw == null) raw = el.textContent;
        if (raw == null) return null;
        const v = parseInt(String(raw).trim(), 10);
        return Number.isNaN(v) ? null : v;
    }catch(_e){ return null; }
}
function readStrFieldDOM(name){
    try{
        const el = document.querySelector(`[name="${name}"]`) || document.querySelector(`[data-name="${name}"]`);
        if (!el) return '';
        const sel = el.querySelector && el.querySelector('select');
        if (sel) return String(sel.value||'').trim();
        const raw = el.getAttribute('data-value') || el.getAttribute('value') || el.textContent || '';
        return String(raw).trim();
    }catch(_e){ return ''; }
}

function publishStates(controller) {
    try {
        if (!controller?.model || controller.model.name !== "ccn.service.quote") return;
        const data = controller?.model?.root?.data || {};
        const states = {};
        const counts = {};
        const fv = document.querySelector('.o_form_view');
        const rid = controller?.model?.root?.resId || data.id || 'new';
        const currentService = readStrFieldDOM('current_service_type');
        const currentSite = readIntFieldDOM('current_site_id');
        const ctxStr = `${rid}|${currentSite||''}|${currentService||''}`;

        let suffix = '';
        if (currentService === 'jardineria') suffix = '_jard';
        else if (currentService === 'limpieza') suffix = '_limp';

        const CODES = [
            'mano_obra','uniforme','epp','epp_alturas','equipo_especial_limpieza','comunicacion_computo',
            'herramienta_menor_jardineria','material_limpieza','perfil_medico','maquinaria_limpieza',
            'maquinaria_jardineria','fertilizantes_tierra_lama','consumibles_jardineria','capacitacion'
        ];
        for (const code of CODES){
            let v = null;
            if (suffix) v = readIntFieldDOM(`rubro_state_${code}${suffix}`);
            if (v == null) v = readIntFieldDOM(`rubro_state_${code}`);
            if (v != null) states[code] = v;
            const cnt = readIntFieldDOM(`rubro_count_${code}`);
            if (cnt != null) counts[code] = cnt;
        }

        try {
            const statesJson = JSON.stringify(states);
            const countsJson = JSON.stringify(counts);

            // Solo log UNA VEZ cuando hay un problema
            const hasStates = Object.keys(states).length > 0;
            if (!hasStates || !fv) {
                console.warn('[CCN] ⚠️ Publish issue - States empty?', hasStates, 'FormView found?', !!fv);
            }

            if (fv) {
                fv.dataset.ccnStates = statesJson;
                fv.dataset.ccnCounts = countsJson;
                fv.dataset.ccnCtx = ctxStr;
            }
            const notebook = document.querySelector(".o_notebook");
            if (notebook) {
                notebook.dataset.ccnStates = statesJson;
                notebook.dataset.ccnCounts = countsJson;
                notebook.dataset.ccnCtx = ctxStr;
            }
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

// Exponer un helper global para forzar la publicación de estados desde otros scripts
let __ccnLastController = null;
function exposePublisher(ctrl){
    __ccnLastController = ctrl;
    try {
        window.__ccnPublishLastStates = () => { try { publishStates(__ccnLastController); } catch(_e) {} };
    } catch(_e) {}
}

patch(FormController.prototype, {
    setup() {
        super.setup();
        // Publicar con delay en setup inicial
        setTimeout(() => initQuoteNotebook(this), 100);
        exposePublisher(this);

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
        exposePublisher(this);
    },
});
