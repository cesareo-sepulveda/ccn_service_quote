/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

const DEBUG = false;

// Ejecuta en el siguiente ciclo de rendering (2 rAF) para asegurar DOM listo,
// sin introducir retrasos perceptibles como 50-100ms.
function asap(fn){
    try{ requestAnimationFrame(()=>requestAnimationFrame(fn)); }
    catch(_e){ setTimeout(fn, 0); }
}

// Overlay de actividad (spinner) mínimo y no intrusivo
function showBusyOverlay(message){
    try{
        let el = document.querySelector('.o_ccn_busy');
        if (!el){
            el = document.createElement('div');
            el.className = 'o_ccn_busy';
            el.setAttribute('role', 'status');
            el.style.position = 'fixed';
            el.style.inset = '0';
            el.style.zIndex = '9999';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.background = 'rgba(255,255,255,0.35)';
            el.style.backdropFilter = 'blur(1px)';
            el.innerHTML = `
              <div class="text-center">
                <div class="spinner-border text-primary" style="width: 2.75rem; height: 2.75rem;" aria-hidden="true"></div>
                <div class="mt-2 small text-muted o_ccn_busy_msg"></div>
              </div>`;
            document.body.appendChild(el);
        }
        const msg = el.querySelector('.o_ccn_busy_msg');
        if (msg) msg.textContent = String(message || 'Procesando…');
    }catch(_e){}
}
function hideBusyOverlay(){
    try{
        const el = document.querySelector('.o_ccn_busy');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }catch(_e){}
}

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
            if (suffix) {
                // Con servicio activo, usar solo el estado por servicio (sin fallback al genérico)
                v = readIntFieldDOM(`rubro_state_${code}${suffix}`);
                if (v != null) states[code] = v;
            } else {
                // Sin servicio activo, usar el estado genérico
                v = readIntFieldDOM(`rubro_state_${code}`);
                if (v != null) states[code] = v;
            }
            const cnt = readIntFieldDOM(`rubro_count_${code}`);
            if (cnt != null) counts[code] = cnt;
        }

        try {
            const statesJson = JSON.stringify(states);
            const countsJson = JSON.stringify(counts);

            // Log detallado para debug (solo si hay estados)
            const hasStates = Object.keys(states).length > 0;
            if (DEBUG) {
                if (hasStates) {
                    // eslint-disable-next-line no-console
                    console.log('[CCN] ✅ Publicando estados:', states);
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('[CCN] ⚠️ Publish issue - States empty, FormView found?', !!fv);
                }
            }

            if (fv) {
                fv.dataset.ccnStates = statesJson;
                fv.dataset.ccnCounts = countsJson;
                fv.dataset.ccnCtx = ctxStr;
                // También publicar atributos por servicio para consumo directo
                if (currentService) {
                    try { fv.setAttribute(`data-ccn-states-${currentService}`, statesJson); } catch(_e) {}
                    try { fv.setAttribute(`data-ccn-counts-${currentService}`, countsJson); } catch(_e) {}
                    try { fv.setAttribute(`data-ccn-ctx-${currentService}`, ctxStr); } catch(_e) {}
                }
            }
            const notebook = document.querySelector(".o_notebook");
            if (notebook) {
                notebook.dataset.ccnStates = statesJson;
                notebook.dataset.ccnCounts = countsJson;
                notebook.dataset.ccnCtx = ctxStr;
                if (currentService) {
                    try { notebook.setAttribute(`data-ccn-states-${currentService}`, statesJson); } catch(_e) {}
                    try { notebook.setAttribute(`data-ccn-counts-${currentService}`, countsJson); } catch(_e) {}
                    try { notebook.setAttribute(`data-ccn-ctx-${currentService}`, ctxStr); } catch(_e) {}
                }
            }
            try { sessionStorage.setItem(`ccnTabs:${ctxStr}`, JSON.stringify({states, acks: {}})); } catch(_e) {}
        } catch (_e) {
            if (DEBUG) {
                // eslint-disable-next-line no-console
                console.error('Error publishing states:', _e);
            }
        }
    } catch (e) {
        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.error('[CCN] Error in publishStates:', e);
        }
    }
}

function initQuoteNotebook(controller) {
    if (!controller?.model || controller.model.name !== "ccn.service.quote") return;
    const el = controller.el || document.querySelector('.o_form_view');
    ensureCurrentSite(controller);
    // Si quedó un overlay de una acción previa (p.ej. cambio de servicio), ocultarlo ahora
    hideBusyOverlay();

    // Publicar estados en el siguiente tick (rápido)
    asap(() => {
        publishStates(controller);
        try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
        // Intentar restaurar el tab activo solicitado (p.ej., tras cerrar Catálogo)
        try {
            const root = document.querySelector('.o_form_view');
            const data = controller?.model?.root?.data || {};
            const rid = controller?.model?.root?.resId || data.id || 'new';
            const currentService = readStrFieldDOM('current_service_type') || '';
            const currentSite = readIntFieldDOM('current_site_id') || '';
            const ctxStr = `${rid}|${currentSite||''}|${currentService||''}`;
            const key = `ccnGoTab:${ctxStr}`;
            const raw = sessionStorage.getItem(key);
            if (raw) {
                let payload = null;
                try { payload = JSON.parse(raw) || {}; } catch(_e) { payload = {}; }
                const codeRaw = (payload && payload.code) || '';
                const candidates = [];
                const normalized = normalizeCode(codeRaw);
                if (codeRaw) candidates.push(codeRaw);
                if (normalized && normalized !== codeRaw) candidates.push(normalized);

                const tryActivate = (remaining) => {
                    const nb = root ? (root.querySelector('.o_notebook') || root.querySelector('.o_content .o_notebook')) : document.querySelector('.o_notebook');
                    if (!nb) {
                        if (remaining > 0) return asap(() => tryActivate(remaining - 1));
                        const tooOld = (Date.now() - (payload.ts || 0)) > 10000;
                        if (tooOld) { try { sessionStorage.removeItem(key); } catch(_e){} }
                        return;
                    }
                    for (const code of candidates){
                        if (!code) continue;
                        const pageId = `page_${code}`;
                        const sel = [
                            `.nav-tabs .nav-link[name="page_${code}"]`,
                            `.nav-tabs .nav-link[aria-controls="${pageId}"]`,
                            `.nav-tabs .nav-link[data-bs-target="#${pageId}"]`,
                            `.nav-tabs .nav-link[href="#${pageId}"]`,
                        ].join(', ');
                        const link = nb.querySelector(sel);
                        if (link) {
                            try { link.click(); } catch(_e){}
                            try { sessionStorage.removeItem(key); } catch(_e){}
                            return;
                        }
                    }
                    if (remaining > 0) {
                        asap(() => tryActivate(remaining - 1));
                    } else {
                        const tooOld = (Date.now() - (payload.ts || 0)) > 10000;
                        if (tooOld) { try { sessionStorage.removeItem(key); } catch(_e){} }
                    }
                };
                tryActivate(20);
            }
        } catch(_e) {}

        // Marcar el tab placeholder en su <li> para poder estilizarlo (ocultar marca activa)
        try {
            const nb2 = document.querySelector('.o_form_view .o_notebook');
            const ph = nb2 && nb2.querySelector(
                '.nav-tabs .nav-link[name*="page__placeholder"],\
                 .nav-tabs .nav-link[aria-controls*="page__placeholder"],\
                 .nav-tabs .nav-link[href*="#page__placeholder"]'
            );
            if (ph && ph.parentElement) {
                ph.parentElement.classList.add('ccn-placeholder-tab');
            }
        } catch(_e) {}

        // Marcar el <li> activo con clase dedicada para evitar depender de :has
        try {
            const nb = document.querySelector('.o_form_view .o_notebook');
            if (nb) {
                const markActive = () => {
                    try {
                        const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
                        const lis = nb.querySelectorAll('.nav-tabs li');
                        lis.forEach(li => li.classList.remove('ccn-active-tab'));
                        if (activeLink) {
                            const li = activeLink.closest('li');
                            if (li) li.classList.add('ccn-active-tab');
                        }

                        // No modificar texto de tabs - usar CSS para outline
                    } catch(_e) {}
                };

                // Función para disparar catálogo automáticamente en tabs rojos
                const triggerCatalogForRedTab = (activeLink) => {
                    try {
                        if (!activeLink) return;

                        // Verificar si el tab está vacío/rojo (ccn-status-empty)
                        const li = activeLink.closest('li');
                        if (!li) return;

                        // Verificar si tiene la clase de estado vacío
                        const hasEmptyStatus = li.classList.contains('ccn-status-empty') ||
                                              activeLink.classList.contains('ccn-status-empty');

                        if (DEBUG) {
                            // eslint-disable-next-line no-console
                            console.log('[CCN] Checking tab for auto-catalog:', {
                                tabName: activeLink.getAttribute('name') || activeLink.textContent.trim(),
                                hasEmptyStatus,
                                liClasses: li.className,
                                linkClasses: activeLink.className
                            });
                        }

                        if (!hasEmptyStatus) return;

                        // Evitar loops infinitos: verificar si ya se disparó recientemente
                        const now = Date.now();
                        const lastTrigger = parseInt(activeLink.dataset.lastCatalogTrigger || '0');
                        if (now - lastTrigger < 2000) {
                            if (DEBUG) {
                                // eslint-disable-next-line no-console
                                console.log('[CCN] Skipping catalog trigger - too soon since last trigger');
                            }
                            return; // Máximo 1 vez cada 2 segundos
                        }

                        activeLink.dataset.lastCatalogTrigger = now.toString();

                        // Buscar el botón de catálogo en el tab activo
                        const catalogButton = activeLink.closest('.tab-pane')?.querySelector('button[name="action_open_catalog_wizard"]') ||
                                             nb.querySelector('.tab-pane.active button[name="action_open_catalog_wizard"]');

                        if (DEBUG) {
                            // eslint-disable-next-line no-console
                            console.log('[CCN] Catalog button found:', !!catalogButton, catalogButton?.disabled);
                        }

                        if (catalogButton && !catalogButton.disabled) {
                            if (DEBUG) {
                                // eslint-disable-next-line no-console
                                console.log('[CCN] Triggering catalog for red tab');
                            }
                            // Simular click en el botón de catálogo
                            catalogButton.click();
                        } else if (DEBUG) {
                            // eslint-disable-next-line no-console
                            console.log('[CCN] Catalog button not found or disabled');
                        }
                    } catch(_e) {
                        if (DEBUG) {
                            // eslint-disable-next-line no-console
                            console.error('[CCN] Error triggering catalog for red tab:', _e);
                        }
                    }
                };

                const markActiveAndTrigger = () => {
                    markActive();
                    // Después de marcar activo, verificar si es un tab rojo y disparar catálogo
                    const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
                    if (activeLink) {
                        // Pequeño delay para asegurar que el DOM esté actualizado
                        setTimeout(() => triggerCatalogForRedTab(activeLink), 100);
                    }
                };

                markActiveAndTrigger();
                // Bootstrap tab events
                const onShown = (ev) => {
                    try {
                        if (ev && ev.target && nb.contains(ev.target)) {
                            markActiveAndTrigger();
                        }
                    } catch(_e) {}
                };
                document.body.addEventListener('shown.bs.tab', onShown, true);
                // Fallback por mutaciones de clase
                try {
                    const mo = new MutationObserver(() => markActiveAndTrigger());
                    mo.observe(nb, { subtree: true, attributes: true, attributeFilter: ['class'] });
                } catch(_e) {}

                // Inyectar/eliminar un span de marca visible en el <li> activo (más robusto que ::after)
                const updateActiveDot = () => {
                    try {
                        // eliminar puntos previos
                        nb.querySelectorAll('.nav-tabs li .ccn-active-dot').forEach((el)=> el.remove());
                        const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
                        if (!activeLink) return;
                        const li = activeLink.closest('li');
                        if (!li) return;
                        if (li.classList.contains('ccn-placeholder-tab')) return; // no dibujar en placeholder
                        const dot = document.createElement('span');
                        dot.className = 'ccn-active-dot';
                        li.appendChild(dot);
                    } catch(_e) {}
                };
                // Llamar junto con markActive
                const markBoth = () => { markActive(); updateActiveDot(); };
                markBoth();
                document.body.addEventListener('shown.bs.tab', (ev)=>{ try{ if (ev && ev.target && nb.contains(ev.target)) markBoth(); }catch(_e){} }, true);
                try { const mo2 = new MutationObserver(()=> markBoth()); mo2.observe(nb, {subtree:true, attributes:true, attributeFilter:['class']}); } catch(_e){}
            }
        } catch(_e) {}

        // Modo "sin pestaña activa" al mostrar el notebook por primera vez.
        // Oculta el contenido hasta que el usuario seleccione una pestaña.
        try {
            const root2 = document.querySelector('.o_form_view');
            const formEl = root2 ? (root2.querySelector('form.ccn-quote') || root2) : document.querySelector('form.ccn-quote');
            const nb = root2 ? (root2.querySelector('.o_notebook') || root2.querySelector('.o_content .o_notebook')) : document.querySelector('.o_notebook');
            if (nb && formEl && formEl.getAttribute('data-ccn-noactive-applied') !== '1') {
                // Evitar aplicar si hay una navegación pendiente a un tab (ccnGoTab)
                const data2 = controller?.model?.root?.data || {};
                const rid2 = controller?.model?.root?.resId || data2.id || 'new';
                const currentService2 = readStrFieldDOM('current_service_type') || '';
                const currentSite2 = readIntFieldDOM('current_site_id') || '';
                const ctxStr2 = `${rid2}|${currentSite2||''}|${currentService2||''}`;
                const goTabKey = `ccnGoTab:${ctxStr2}`;
                const pendingGo = !!sessionStorage.getItem(goTabKey);
                if (!pendingGo) {
                    formEl.setAttribute('data-ccn-noactive-applied', '1');
                    formEl.setAttribute('data-ccn-noactive', '1');
                    const link = nb.querySelector('.nav-tabs .nav-link.active');
                    const pane = nb.querySelector('.tab-pane.active');
                    if (link) { try { link.classList.remove('active'); } catch(_e) {} }
                    if (pane) { try { pane.classList.remove('show'); pane.classList.remove('active'); } catch(_e) {} }
                    // Guard: mientras esté en modo noactivo, eliminar cualquier activación automática
                    try {
                        const cleanNoActive = () => {
                            try {
                                if (!formEl || formEl.getAttribute('data-ccn-noactive') !== '1') return;
                                nb.querySelectorAll('.nav-tabs .nav-link.active').forEach(a => { try { a.classList.remove('active'); } catch(_e) {} });
                                nb.querySelectorAll('.tab-pane.show, .tab-pane.active').forEach(p => { try { p.classList.remove('show'); p.classList.remove('active'); } catch(_e) {} });
                            } catch(_e) {}
                        };
                        cleanNoActive();
                        const mo = new MutationObserver(() => cleanNoActive());
                        mo.observe(nb, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
                        // Solo salir del modo noactivo con PRIMER click del usuario
                        const onFirstClick = (ev) => {
                            try {
                                const a = ev.target && ev.target.closest && ev.target.closest('.o_notebook .nav-tabs .nav-link');
                                if (!a || !nb.contains(a)) return;
                                formEl.removeAttribute('data-ccn-noactive');
                                try { mo.disconnect(); } catch(_e) {}
                                document.removeEventListener('click', onFirstClick, true);
                            } catch(_e) {}
                        };
                        document.addEventListener('click', onFirstClick, true);

                        // Bloquear activaciones programáticas mientras esté en noactivo
                        const onShowPre = (ev) => {
                            try {
                                if (!formEl || formEl.getAttribute('data-ccn-noactive') !== '1') return;
                                const link = ev.target;
                                if (link && nb.contains(link)) {
                                    ev.preventDefault();
                                    ev.stopImmediatePropagation();
                                }
                            } catch(_e) {}
                        };
                        document.addEventListener('show.bs.tab', onShowPre, true);
                        // Al salir del modo noactivo, quitar el listener
                        const offNoActive = () => {
                            try { document.removeEventListener('show.bs.tab', onShowPre, true); } catch(_e) {}
                        };
                        document.addEventListener('click', function _tmp(ev){
                            const a = ev.target && ev.target.closest && ev.target.closest('.o_notebook .nav-tabs .nav-link');
                            if (!a || !nb.contains(a)) return;
                            try { offNoActive(); } catch(_e) {}
                            document.removeEventListener('click', _tmp, true);
                        }, true);
                    } catch(_e) {}
                }
            }
        } catch(_e) {}
    });
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
        // Publicar rápido en setup inicial
        asap(() => initQuoteNotebook(this));
        exposePublisher(this);

        const requestRepaint = () => {
            try { publishStates(this); } catch(_e) {}
            try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
            asap(() => {
                try { publishStates(this); } catch(_e) {}
                try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
            });
        };

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
            if (hasServiceTypeChange) requestRepaint();
            asap(() => initQuoteNotebook(self));
        });

        // Observar cambios en el form, pero no en datasets para evitar loop
        asap(() => {
            const form = document.querySelector('.o_form_view');
            if (form) {
                observer.observe(form, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'data-value', 'value']  // evitar data-ccn-* para no loop
                });
            }
        });

        // Listener explícito al cambio del campo de servicio → repintado inmediato (sin recarga)
        document.body.addEventListener('change', (ev) => {
            const t = ev.target;
            if (!t) return;
            try {
                const holder = t.closest?.('[name="current_service_type"], [data-name="current_service_type"]');
                if (holder) {
                    requestRepaint();

                    // Fast path: NO recargar la vista ni forzar guardado.
                    // Publicar estados y repintar inmediatamente con dos reintentos cortos.
                    try { publishStates(this); } catch(_e) {}
                    try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
                    try { (window.__ccnTabsColorV2 && typeof window.__ccnTabsColorV2.apply === 'function') && window.__ccnTabsColorV2.apply(); } catch (_e) {}
                    setTimeout(() => {
                        try { publishStates(this); } catch(_e) {}
                        try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
                        try { (window.__ccnTabsColorV2 && typeof window.__ccnTabsColorV2.apply === 'function') && window.__ccnTabsColorV2.apply(); } catch (_e) {}
                    }, 20);
                    setTimeout(() => {
                        try { publishStates(this); } catch(_e) {}
                        try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
                        try { (window.__ccnTabsColorV2 && typeof window.__ccnTabsColorV2.apply === 'function') && window.__ccnTabsColorV2.apply(); } catch (_e) {}
                    }, 120);
                    setTimeout(() => {
                        try { publishStates(this); } catch(_e) {}
                        try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
                        try { (window.__ccnTabsColorV2 && typeof window.__ccnTabsColorV2.apply === 'function') && window.__ccnTabsColorV2.apply(); } catch (_e) {}
                    }, 300);
                    setTimeout(() => {
                        try { publishStates(this); } catch(_e) {}
                        try { (window.__ccnTabsWatch && typeof window.__ccnTabsWatch.repaint === 'function') && window.__ccnTabsWatch.repaint(); } catch (_e) {}
                        try { (window.__ccnTabsColorV2 && typeof window.__ccnTabsColorV2.apply === 'function') && window.__ccnTabsColorV2.apply(); } catch (_e) {}
                    }, 500);
                    try { hideBusyOverlay(); } catch(_e) {}
                    return;
                }
            } catch (_e) {}
        }, true);
    },
    onWillUpdateProps() {
        super.onWillUpdateProps(...arguments);
        // En updates, publicar rápido
        asap(() => initQuoteNotebook(this));
        exposePublisher(this);
    },
});
