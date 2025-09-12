/** @odoo-module **/

import { registry } from "@web/core/registry";

function cssVar(name, fallback) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    } catch {
        return fallback;
    }
}

const COLORS = {
    filled: { bg: () => cssVar("--ccn-ok", "#16a34a"), fg: () => "#ffffff" },
    ack:    { bg: () => cssVar("--ccn-warn", "#ca8a04"), fg: () => "#1f2937" }, // texto oscuro sobre ámbar
    empty:  { bg: () => cssVar("--ccn-empty", "#dc2626"), fg: () => "#ffffff" },
};

function applyPersistColors(root = document) {
    const links = root.querySelectorAll(".o_notebook .nav-tabs .nav-link");
    links.forEach((a) => {
        const li = a.closest("li");
        const isActive = a.classList.contains("active");

        // Limpieza en activos (que sigan usando tus estilos originales)
        if (isActive) {
            a.classList.remove("ccn-dyed");
            a.style.removeProperty("--ccn-tab-bg");
            a.style.removeProperty("--ccn-tab-fg");
            if (li) {
                li.classList.remove("ccn-dyed");
                li.style.removeProperty("--ccn-tab-bg");
                li.style.removeProperty("--ccn-tab-fg");
            }
            return;
        }

        // Detectar estado por clases que ya pone tu servicio
        let key = null;
        if (a.classList.contains("ccn-status-filled") || li?.classList.contains("ccn-status-filled")) key = "filled";
        else if (a.classList.contains("ccn-status-ack") || li?.classList.contains("ccn-status-ack")) key = "ack";
        else if (a.classList.contains("ccn-status-empty") || li?.classList.contains("ccn-status-empty")) key = "empty";

        if (!key) {
            // sin estado => no teñimos
            a.classList.remove("ccn-dyed");
            if (li) li.classList.remove("ccn-dyed");
            return;
        }

        const { bg, fg } = COLORS[key];
        const bgVal = bg();
        const fgVal = fg();

        // Teñimos SOLO inactivos usando variables CSS (no tocamos paddings/bordes del tema)
        a.classList.add("ccn-dyed");
        a.style.setProperty("--ccn-tab-bg", bgVal);
        a.style.setProperty("--ccn-tab-fg", fgVal);
        if (li) {
            li.classList.add("ccn-dyed");
            li.style.setProperty("--ccn-tab-bg", bgVal);
            li.style.setProperty("--ccn-tab-fg", fgVal);
        }
    });
}

const service = {
    name: "ccn_quote_tabs_color_persist",
    start() {
        // Primera pasada
        applyPersistColors();

        // Reaplicar cuando cambia el DOM (cambio de tab, render, etc.)
        const root = document.body;
        const obs = new MutationObserver(() => applyPersistColors());
        obs.observe(root, { childList: true, subtree: true });

        // Eventos comunes
        root.addEventListener("click", (ev) => {
            if (ev.target.closest(".o_notebook .nav-tabs .nav-link")) applyPersistColors();
        });
        root.addEventListener("change", (ev) => {
            if (ev.target.closest(".o_form_view")) applyPersistColors();
        });

        // Exponer helper para depurar
        window.__ccnPersistTabsDebug = { apply: applyPersistColors };
    },
};

registry.category("services").add("ccn_quote_tabs_color_persist", service);
