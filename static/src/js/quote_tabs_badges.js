/** @odoo-module **/

import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

function normalizeCode(code) {
    return code === "herr_menor_jardineria" ? "herramienta_menor_jardineria" : code;
}
function normalizeState(v) {
    const s = String(v || "").toLowerCase().trim();
    if (s === "ok" || s === "green" || s === "verde") return "ok";
    if (s.startsWith("yell") || s === "amarillo") return "yellow";
    if (s === "red" || s === "rojo") return "red";
    return "";
}

function getStatesMap(form) {
    const shells = [form, form.querySelector?.("form"), form.closest?.(".o_form_view")].filter(Boolean);
    for (const el of shells) {
        const raw = el?.dataset?.ccnStates;
        if (!raw) continue;
        try { const map = JSON.parse(raw); if (map && typeof map === "object") return map; } catch {}
    }
    return null;
}

function linkCode(link) {
    const nameAttr = link.getAttribute("name") || link.dataset.name || "";
    let m = nameAttr.match(/^page_(.+)$/);
    if (m) return m[1];
    const t = (link.getAttribute("aria-controls") || link.getAttribute("data-bs-target") || link.getAttribute("data-target") || link.getAttribute("href") || "").replace(/^#/, "");
    m = t.match(/^page_(.+)$/);
    if (m) return m[1];
    return null;
}

function getRecordId(form) {
    try {
        // Odoo 15/16: desde el controlador
        const rid = odoo?.__DEBUG__?.services?.action?.currentController?.model?.root?.data?.id;
        if (Number.isFinite(rid)) return rid;
    } catch {}
    try {
        // Por hash URL
        const raw = location.hash || "";
        const m = raw.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
        if (m) return +m[1];
    } catch {}
    return null;
}

async function ensureMap(form) {
    let map = getStatesMap(form);
    if (map) return map;

    // Fallback: pide al servidor (NO contamos filas porque panes inactivos no están montados)
    const id = getRecordId(form);
    if (!id) return null;
    try {
        const res = await rpc('/web/dataset/call_kw/ccn.service.quote/get_rubro_states', {
            model: 'ccn.service.quote', method: 'get_rubro_states', args: [[id]], kwargs: {},
        });
        if (res && typeof res === 'object') {
            // Publica y devuelve
            const json = JSON.stringify(res);
            (form.closest('.o_form_view') || form).dataset.ccnStates = json;
            return res;
        }
    } catch {}
    return null;
}

function applyInForm(form, map) {
    const notebook = form.querySelector(".o_notebook");
    if (!notebook) return;
    const links = notebook.querySelectorAll(".nav-tabs .nav-link");
    links.forEach((link) => {
        const li = link.closest("li");
        // limpia
        [link, li].forEach(el => {
            if (!el) return;
            el.classList.remove("ccn-status-filled","ccn-status-ack","ccn-status-empty");
            el.removeAttribute("data-ccn-state");
        });

        const raw = linkCode(link);
        if (!raw) return;
        const code = normalizeCode(raw);
        let state = map ? map[code] : null;
        if (!state && code === "herr_menor_jardineria") state = map ? map["herramienta_menor_jardineria"] : null;
        state = normalizeState(state) || "red";

        const cls = state === "ok" ? "ccn-status-filled" : state === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
        [link, li].forEach(el => el && el.classList.add(cls));
        [link, li].forEach(el => el && el.setAttribute("data-ccn-state", state));
    });
}

async function applyAll() {
    const forms = document.querySelectorAll(".o_form_view");
    for (const form of forms) {
        const map = await ensureMap(form);
        if (map) applyInForm(form, map);
    }
}

let t0, t1;
function schedule() {
    clearTimeout(t0); clearTimeout(t1);
    t0 = setTimeout(applyAll, 0);
    t1 = setTimeout(applyAll, 150); // ganar a Bootstrap al cambiar tab
}

const service = {
    name: "ccn_quote_tabs_service",
    start() {
        const root = document.body;
        const mo = new MutationObserver(schedule);
        mo.observe(root, { childList: true, subtree: true });
        root.addEventListener("click",  (e) => { if (e.target.closest(".o_notebook .nav-tabs .nav-link")) schedule(); });
        root.addEventListener("shown.bs.tab", schedule, true);
        root.addEventListener("hidden.bs.tab", schedule, true);
        schedule();
        window.__ccnTabsDebug = { applyAll: schedule };
    },
};

registry.category("services").add("ccn_quote_tabs_service", service);
