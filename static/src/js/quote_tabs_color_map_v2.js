/** @odoo-module **/
console.log('quote_tabs_color_map_v2.js loaded (ES module)');

import { registry } from "@web/core/registry";

const COLORS = {
    ok:     { bg: "#16a34a", fg: "#ffffff" },
    yellow: { bg: "#ca8a04", fg: "#1f2937" },
    red:    { bg: "#dc2626", fg: "#ffffff" },
};

function normState(v) {
    const s = String(v || "").toLowerCase().trim();
    if (s === "0" || s === "red" || s === "rojo") return "red";
    if (s === "1" || s === "ok" || s === "green" || s === "verde") return "ok";
    if (s === "2" || s.startsWith("yell") || s === "amarillo") return "yellow";
    return "red";
}

function formRoot() {
    return document.querySelector(".o_form_view") || document;
}

function getMap() {
    const f = formRoot();
    const candidates = [f, f.querySelector?.("form"), f.closest?.(".o_form_view")].filter(Boolean);
    for (const el of candidates) {
        const raw = el?.dataset?.ccnStates;
        if (!raw) continue;
        try {
            const m = JSON.parse(raw);
            if (m && typeof m === "object") return m;
        } catch {}
    }
    return null;
}

// ===== DOM helpers: leer campos invisibles/visibles =====
function readStrField(name){
    try{
        const el = document.querySelector(`[name="${name}"]`) || document.querySelector(`[data-name="${name}"]`);
        if (!el) return '';
        const sel = el.querySelector && el.querySelector('select');
        if (sel) return String(sel.value||'').trim();
        const raw = el.getAttribute('data-value') || el.getAttribute('value') || el.textContent || '';
        return String(raw).trim();
    }catch(_e){ return ''; }
}
function readIntField(name){
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
function stateFromNumber(v){
    if (v === 1 || v === '1') return 'ok';
    if (v === 2 || v === '2') return 'yellow';
    if (v === 0 || v === '0') return 'red';
    return null;
}

function linkCode(a) {
    const nameAttr = a.getAttribute("name") || a.dataset.name || "";
    let m = nameAttr.match(/^page_(.+)$/);
    if (m) return m[1];
    const target = (
        a.getAttribute("aria-controls") ||
        a.getAttribute("data-bs-target") ||
        a.getAttribute("data-target") ||
        a.getAttribute("href") ||
        ""
    ).replace(/^#/, "");
    m = target.match(/^page_(.+)$/);
    if (m) return m[1];
    return null;
}

// Normaliza códigos especiales para que coincidan con los nombres de campos
function canon(code){
    if (!code) return code;
    return code === 'herr_menor_jardineria' ? 'herramienta_menor_jardineria' : code;
}

function clearInline(a, li) {
    ["background-color","background-image","border-color","color","--ccn-tab-bg","--ccn-tab-fg","z-index","isolation","position"].forEach(p=>{
        a.style.removeProperty(p);
        if (li) li.style.removeProperty(p);
    });
    a.removeAttribute("data-ccn-dyed");
    if (li) li.removeAttribute("data-ccn-dyed");
}

function dye(link, state) {
    const li = link.closest("li");
    const s = normState(state);
    const { bg, fg } = COLORS[s] || COLORS.red;

    // Ganar al tema: inline + !important y quitar background-image que tapa el color
    link.style.setProperty("background-color", bg, "important");
    link.style.setProperty("border-color", bg, "important");
    link.style.setProperty("color", fg, "important");
    link.style.setProperty("background-image", "none", "important");

    // variables para chevron en SCSS
    link.style.setProperty("--ccn-tab-bg", bg);
    link.style.setProperty("--ccn-tab-fg", fg);

    // asegurar que el fondo no quede debajo de overlays raros
    link.style.setProperty("position", "relative");
    link.style.setProperty("z-index", "1");
    link.style.setProperty("isolation", "isolate");

    link.setAttribute("data-ccn-dyed", s);

    // Evitar pintar color en el <li> para no tapar el notch/gap del chevrón
    if (li) {
        li.removeAttribute("data-ccn-dyed");
        li.style.removeProperty("background-color");
        li.style.removeProperty("background-image");
        li.style.removeProperty("border-color");
        li.style.removeProperty("--ccn-tab-bg");
        li.style.removeProperty("--ccn-tab-fg");
    }
}

function applyOnce() {
    const f = formRoot();

    // IMPORTANTE: Solo aplicar en vistas de ccn.service.quote
    // Verificación MUY ESTRICTA: debe existir el elemento .o_ccn_rubro_states
    // Este elemento es ÚNICO de las cotizaciones CCN y no existe en otros módulos
    const rubroStatesElement = f.querySelector('.o_ccn_rubro_states');

    if (!rubroStatesElement) {
        // No es una cotización CCN, salir sin hacer nada
        return;
    }

    const links = [...f.querySelectorAll(".o_notebook .nav-tabs .nav-link")];
    if (!links.length) {
        return;
    }

    const map = getMap();
    // Solo log si el map es null (problema)
    if (!map || !Object.keys(map).length) {
        console.warn('[CCN] ⚠️ Color map is null or empty - tabs will use DOM fallback');
    }

    if (map && Object.keys(map).length) {
        const currentService = readStrField('current_service_type');
        const suffix = currentService === 'jardineria' ? '_jard' : (currentService === 'limpieza' ? '_limp' : '');
        for (const a of links) {
            const code = canon(linkCode(a));
            if (!code) { clearInline(a, a.closest("li")); continue; }

            // Dataset como PRIMERA fuente (más confiable)
            const ds = map[code];

            // DOM como fallback
            let v = null;
            if (suffix) v = readIntField(`rubro_state_${code}${suffix}`);
            if (v == null) v = readIntField(`rubro_state_${code}`);
            const sDom = stateFromNumber(v);

            // Prioridad: dataset > DOM states
            if (ds !== undefined && ds !== null) {
                dye(a, ds);
            } else if (sDom) {
                dye(a, sDom);
            } else {
                // Si no hay valor, asumir rojo (vacío)
                dye(a, 'red');
            }
        }
        return;
    }

    // Fallback: usa DOM directo (por si no hay dataset)
    for (const a of links) {
        const currentService = readStrField('current_service_type');
        const suffix = currentService === 'jardineria' ? '_jard' : (currentService === 'limpieza' ? '_limp' : '');
        const code = canon(linkCode(a));
        // Leer SOLO desde campos DOM (fuente de verdad) - NO usar clases CSS
        let s = null;
        if (code){
            let v = null;
            if (suffix) v = readIntField(`rubro_state_${code}${suffix}`);
            if (v == null) v = readIntField(`rubro_state_${code}`);
            s = stateFromNumber(v);
        }
        // Si no hay valor, asumir rojo (vacío)
        if (s) dye(a, s); else dye(a, 'red');
    }
}

let raf, t1, t2;
let isApplying = false; // Flag para prevenir re-entrada

function scheduleApply() {
    if (isApplying) return; // Prevenir loop infinito
    if (raf) cancelAnimationFrame(raf);
    [t1,t2].forEach(t=>t && clearTimeout(t));
    // Repintados dentro del límite solicitado (<= 200ms)
    try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e) {}
    raf = requestAnimationFrame(() => {
        isApplying = true;
        try { applyOnce(); } finally { isApplying = false; }
    });
    t1 = setTimeout(() => {
        isApplying = true;
        try {
            window.__ccnPublishLastStates && window.__ccnPublishLastStates();
            applyOnce();
        } finally { isApplying = false; }
    }, 60);
    t2 = setTimeout(() => {
        isApplying = true;
        try { applyOnce(); } finally { isApplying = false; }
    }, 200);
}

const service = {
    name: "ccn_quote_tabs_color_map_v2",
    start() {
        console.log('Color map service started');
        // Primera pasada
        scheduleApply();

        const root = document.body;

        // Re- aplicar cuando Bootstrap termina de mostrar/ocultar tabs
        root.addEventListener("shown.bs.tab", scheduleApply, true);
        root.addEventListener("show.bs.tab", scheduleApply, true);
        root.addEventListener("hide.bs.tab", scheduleApply, true);
        root.addEventListener("hidden.bs.tab", scheduleApply, true);
        // Publicar estados al cambiar de tab para asegurar dataset actualizado
        root.addEventListener("shown.bs.tab", () => { try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e) {} }, true);

        // Cambios de DOM - DESACTIVADO TEMPORALMENTE para evitar loop infinito
        // const mo = new MutationObserver(scheduleApply);
        // mo.observe(root, { childList: true, subtree: true, attributes: true });

        // Eventos típicos
        root.addEventListener("click", (ev) => {
            if (ev.target.closest(".o_notebook .nav-tabs .nav-link")) scheduleApply();
        });
        root.addEventListener("change", (ev) => {
            if (ev.target.closest(".o_form_view")) scheduleApply();
        });

        // Transiciones (por si hay animaciones en el tema)
        root.addEventListener("transitionend", (ev) => {
            if (ev.target.closest?.(".o_notebook .nav-tabs")) scheduleApply();
        });

        // Helper de depuración
        window.__ccnTabsColorV2 = { apply: scheduleApply, once: applyOnce };
    },
};

registry.category("services").add("ccn_quote_tabs_color_map_v2", service);
