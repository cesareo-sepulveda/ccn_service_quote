/** @odoo-module **/

import { registry } from "@web/core/registry";

const COLORS = {
    ok:     { bg: "#16a34a", fg: "#ffffff" }, // filled
    yellow: { bg: "#ca8a04", fg: "#1f2937" }, // ack
    red:    { bg: "#dc2626", fg: "#ffffff" }, // empty
};

function normalizeState(v) {
    const s = String(v || "").toLowerCase().trim();
    if (s === "ok" || s === "green" || s === "verde") return "ok";
    if (s.startsWith("yell") || s === "amarillo") return "yellow";
    if (s === "red" || s === "rojo") return "red";
    return s || "red";
}

function getForm() {
    return document.querySelector(".o_form_view") || document;
}

function getStatesMap(form) {
    const wrappers = [form, form.querySelector?.("form"), form.closest?.(".o_form_view")].filter(Boolean);
    for (const el of wrappers) {
        const raw = el?.dataset?.ccnStates;
        if (!raw) continue;
        try {
            const map = JSON.parse(raw);
            if (map && typeof map === "object") return map;
        } catch {}
    }
    return null;
}

function linkCode(link) {
    // Intenta name="page_CODE"
    const nameAttr = link.getAttribute("name") || link.dataset.name || "";
    let m = nameAttr.match(/^page_(.+)$/);
    if (m) return m[1];

    // Intenta aria-controls / data-bs-target / href="#page_CODE"
    let target = (
        link.getAttribute("aria-controls") ||
        link.getAttribute("data-bs-target") ||
        link.getAttribute("data-target") ||
        link.getAttribute("href") ||
        ""
    ).replace(/^#/, "");
    m = target.match(/^page_(.+)$/);
    if (m) return m[1];

    return null;
}

function clearInline(a, li) {
    ["background-color", "border-color", "color", "--ccn-tab-bg", "--ccn-tab-fg"].forEach((p) => {
        a.style.removeProperty(p);
        if (li) li.style.removeProperty(p);
    });
    a.removeAttribute("data-ccn-dyed");
    if (li) li.removeAttribute("data-ccn-dyed");
}

function dyeTab(link, state) {
    const li = link.closest("li");
    if (link.classList.contains("active")) {
        clearInline(link, li);
        return;
    }
    const norm = normalizeState(state);
    const { bg, fg } = COLORS[norm] || COLORS.red;

    link.style.setProperty("background-color", bg, "important");
    link.style.setProperty("border-color", bg, "important");
    link.style.setProperty("color", fg, "important");
    link.style.setProperty("--ccn-tab-bg", bg);
    link.style.setProperty("--ccn-tab-fg", fg);
    link.setAttribute("data-ccn-dyed", norm);

    if (li) {
        li.style.setProperty("--ccn-tab-bg", bg);
        li.style.setProperty("--ccn-tab-fg", fg);
        li.setAttribute("data-ccn-dyed", norm);
    }
}

function dyeOnce() {
    const form = getForm();
    const links = Array.from(form.querySelectorAll(".o_notebook .nav-tabs .nav-link"));
    if (!links.length) return;

    // 1) Preferir el mapa publicado por el controlador/servicio
    const map = getStatesMap(form);
    if (map && Object.keys(map).length) {
        // Teñimos TODOS los tabs que podamos mapear por CODE (aunque no se hayan visitado)
        for (const link of links) {
            const code = linkCode(link);
            if (!code) { clearInline(link, link.closest("li")); continue; }
            const state = map[code] ?? (code === "herr_menor_jardineria" ? map["herramienta_menor_jardineria"] : undefined);
            if (state) dyeTab(link, state);
            else clearInline(link, link.closest("li"));
        }
        return;
    }

    // 2) Fallback: si no hay mapa, usa las clases ccn-status-* (solo teñirá los tabs ya procesados por el servicio de badges)
    for (const a of links) {
        const li = a.closest("li");
        const isActive = a.classList.contains("active");
        if (isActive) { clearInline(a, li); continue; }

        let state = null;
        if (a.classList.contains("ccn-status-filled") || li?.classList.contains("ccn-status-filled")) state = "ok";
        else if (a.classList.contains("ccn-status-ack") || li?.classList.contains("ccn-status-ack")) state = "yellow";
        else if (a.classList.contains("ccn-status-empty") || li?.classList.contains("ccn-status-empty")) state = "red";

        if (state) dyeTab(a, state);
        else clearInline(a, li);
    }
}

let raf, t1, t2;
function scheduleDye() {
    if (raf) cancelAnimationFrame(raf);
    if (t1) clearTimeout(t1);
    if (t2) clearTimeout(t2);
    // Aplicar en distintos ticks para ganar al reflow del switch de pestañas
    raf = requestAnimationFrame(() => dyeOnce());
    t1 = setTimeout(dyeOnce, 40);
    t2 = setTimeout(dyeOnce, 160);
}

const service = {
    name: "ccn_quote_tabs_color_map",
    start() {
        // Primera pasada
        scheduleDye();

        // Reaplicar al mutar el DOM
        const root = document.body;
        const obs = new MutationObserver(scheduleDye);
        obs.observe(root, { childList: true, subtree: true });

        // Eventos típicos
        root.addEventListener("click", (ev) => {
            if (ev.target.closest(".o_notebook .nav-tabs .nav-link")) scheduleDye();
        });
        root.addEventListener("change", (ev) => {
            if (ev.target.closest(".o_form_view")) scheduleDye();
        });

        // Helper de depuración
        window.__ccnTabsColorMap = { apply: scheduleDye, once: dyeOnce };
    },
};

registry.category("services").add("ccn_quote_tabs_color_map", service);
