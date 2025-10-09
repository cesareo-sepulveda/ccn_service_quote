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
    if (link.classList.contains("active")) {
        clearInline(link, li);
        return;
    }
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

    if (li) {
        li.style.setProperty("--ccn-tab-bg", bg);
        li.style.setProperty("--ccn-tab-fg", fg);
        li.setAttribute("data-ccn-dyed", s);
        // Si el tema pinta el fondo en el <li>, cúbrelo también
        li.style.setProperty("background-color", bg, "important");
        li.style.setProperty("background-image", "none", "important");
        li.style.setProperty("border-color", bg, "important");
    }
}

function applyOnce() {
    const f = formRoot();
    const links = [...f.querySelectorAll(".o_notebook .nav-tabs .nav-link")];
    if (!links.length) return;

    const map = getMap();
    console.log('Color map:', map);
    if (map && Object.keys(map).length) {
        for (const a of links) {
            const code = linkCode(a);
            if (!code) { clearInline(a, a.closest("li")); continue; }
            const state = map[code] ?? (code === "herr_menor_jardineria" ? map["herramienta_menor_jardineria"] : undefined);
            console.log('Tab', code, 'state:', state);
            if (state !== undefined && state !== null) dye(a, state);
            else clearInline(a, a.closest("li"));
        }
        return;
    }

    // Fallback: usa clases (por si no hay dataset)
    for (const a of links) {
        const li = a.closest("li");
        if (a.classList.contains("active")) { clearInline(a, li); continue; }
        let s = null;
        if (a.classList.contains("ccn-status-filled") || li?.classList.contains("ccn-status-filled")) s = "ok";
        else if (a.classList.contains("ccn-status-ack") || li?.classList.contains("ccn-status-ack")) s = "yellow";
        else if (a.classList.contains("ccn-status-empty") || li?.classList.contains("ccn-status-empty")) s = "red";
        if (s) dye(a, s); else clearInline(a, li);
    }
}

let raf, t1, t2, t3;
function scheduleApply() {
    if (raf) cancelAnimationFrame(raf);
    [t1,t2,t3].forEach(t=>t && clearTimeout(t));
    // Varios ticks para ganar al toggle interno de Bootstrap/Odoo
    raf = requestAnimationFrame(applyOnce);
    t1 = setTimeout(applyOnce, 30);
    t2 = setTimeout(applyOnce, 120);
    t3 = setTimeout(applyOnce, 360);
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

        // Cambios de DOM
        const mo = new MutationObserver(scheduleApply);
        mo.observe(root, { childList: true, subtree: true, attributes: true });

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
