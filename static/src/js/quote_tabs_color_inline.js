/** @odoo-module **/

import { registry } from "@web/core/registry";

const COLORS = {
    ok:   { bg: "#16a34a", fg: "#ffffff" },  // verde
    warn: { bg: "#ca8a04", fg: "#1f2937" },  // ámbar
    red:  { bg: "#dc2626", fg: "#ffffff" },  // rojo
};

function normState(v){
    if (v === 1 || v === '1' || v === true || v === 'ok' || v === 'green') return 'ok';
    if (v === 2 || v === '2' || v === 'warn' || v === 'yellow') return 'warn';
    if (v === 0 || v === '0' || v === 'red' || v === 'empty' || v == null) return 'red';
    return 'red';
}

function readIntFieldIn(root, name){
    try{
        const el = root.querySelector(`[name="${name}"]`) || root.querySelector(`[data-name="${name}"]`);
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
function readStrFieldIn(root, name){
    try{
        const el = root.querySelector(`[name="${name}"]`) || root.querySelector(`[data-name="${name}"]`);
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

function linkCode(a){
    const nameAttr = a.getAttribute('name') || a.dataset.name || '';
    let m = nameAttr.match(/^page_(.+)$/);
    if (m) return m[1];
    const target = (
        a.getAttribute('aria-controls') ||
        a.getAttribute('data-bs-target') ||
        a.getAttribute('data-target') ||
        a.getAttribute('href') ||
        ''
    ).replace(/^#/, '');
    m = target.match(/^page_(.+)$/);
    if (m) return m[1];
    return null;
}
function canon(code){
    if (!code) return code;
    return code === 'herr_menor_jardineria' ? 'herramienta_menor_jardineria' : code;
}

function clearInline(a, li) {
    [
        "background-color","background-image","border-color","color",
        "--ccn-tab-bg","--ccn-tab-fg","position","z-index","isolation"
    ].forEach((p)=>{
        a.style.removeProperty(p);
        if (li) li.style.removeProperty(p);
    });
    a.removeAttribute("data-ccn-dyed");
    if (li) li.removeAttribute("data-ccn-dyed");
}

let __ccnColoring = false;
function dyeOnce() {
    if (__ccnColoring) return;
    __ccnColoring = true;
    try {
    document.querySelectorAll('.o_notebook .nav-tabs .nav-link').forEach((a) => {
        const li = a.closest('li');
        const form = a.closest('.o_form_view');
        const isCCN = !!(form && form.querySelector('.o_ccn_rubro_states'));
        if (!isCCN) { clearInline(a, li); return; }

        // Fuente de verdad: dataset en el form actual
        let dmap = null;
        try{ const raw = form.dataset?.ccnStates; dmap = raw ? JSON.parse(raw) : null; }catch(_e){ dmap = null; }
        const currentService = readStrFieldIn(form, 'current_service_type');
        const suffix = currentService === 'jardineria' ? '_jard' : (currentService === 'limpieza' ? '_limp' : '');

        const code = canon(linkCode(a));
        if (!code) { clearInline(a, li); return; }

        let st = null;
        if (dmap && Object.prototype.hasOwnProperty.call(dmap, code)) st = dmap[code];
        if (st == null) {
            // Fallback: DOM per-servicio
            let v = null;
            if (suffix) v = readIntFieldIn(form, `rubro_state_${code}${suffix}`);
            if (v == null) v = readIntFieldIn(form, `rubro_state_${code}`);
            st = v;
        }

        const key = normState(st);
        const { bg, fg } = COLORS[key] || COLORS.red;
        const cls = (key === 'ok') ? 'ccn-status-filled' : (key === 'warn') ? 'ccn-status-ack' : 'ccn-status-empty';

        // Sincronizar clases solo si son diferentes (evita disparar observadores)
        try {
            const needsA = !a.classList.contains(cls);
            const needsLi = li && !li.classList.contains(cls);
            if (needsA) { a.classList.remove('ccn-status-filled','ccn-status-ack','ccn-status-empty'); a.classList.add(cls); }
            if (li && needsLi) { li.classList.remove('ccn-status-filled','ccn-status-ack','ccn-status-empty'); li.classList.add(cls); }
        } catch(_e) {}

        // Inline + !important (usar background completo para ganar a reglas base)
        a.style.setProperty('background', bg, 'important');
        a.style.setProperty('background-color', bg, 'important');
        a.style.setProperty('border-color', bg, 'important');
        a.style.setProperty('color', fg, 'important');
        a.style.setProperty('background-image', 'none', 'important');

        a.style.setProperty('--ccn-tab-bg', bg);
        a.style.setProperty('--ccn-tab-fg', fg);
        if (li) {
            li.style.setProperty('--ccn-tab-bg', bg);
            li.style.setProperty('--ccn-tab-fg', fg);
        }

        a.style.setProperty('position', 'relative');
        a.style.setProperty('z-index', '1');
        a.style.setProperty('isolation', 'isolate');

        a.setAttribute('data-ccn-dyed', key);
        if (li) li.setAttribute('data-ccn-dyed', key);
    });
    } finally {
      __ccnColoring = false;
    }
}

const service = {
    name: "ccn_quote_tabs_color_inline",
    start() {
        // Primera pasada
        dyeOnce();

        // Reaplicar en cambios de DOM (cambios de tab, renders, etc.)
        const root = document.body;
        const mo = new MutationObserver(() => { requestAnimationFrame(dyeOnce); });
        // Observar solo cambios de datasets que publican estados para evitar loops por cambios de clase
        mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ccn-states','data-ccn-counts','data-ccn-ctx'] });

        // Eventos típicos que cambian tabs
        root.addEventListener("click", (ev) => {
            if (ev.target.closest(".o_notebook .nav-tabs .nav-link")) dyeOnce();
        });
        root.addEventListener("change", (ev) => {
            if (ev.target.closest(".o_form_view")) dyeOnce();
        });

        // Helper de depuración
        window.__ccnTabsColorInline = { apply: dyeOnce };
    },
};

registry.category("services").add("ccn_quote_tabs_color_inline", service);
