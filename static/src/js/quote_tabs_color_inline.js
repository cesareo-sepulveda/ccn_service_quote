/** @odoo-module **/

import { registry } from "@web/core/registry";

const COLORS = {
    filled: { bg: "#16a34a", fg: "#ffffff" },  // ok
    ack:    { bg: "#ca8a04", fg: "#1f2937" },  // yellow, texto oscuro
    empty:  { bg: "#dc2626", fg: "#ffffff" },  // red
};

function stateFor(link) {
    const li = link.closest("li");
    if (link.classList.contains("ccn-status-filled") || li?.classList.contains("ccn-status-filled")) return "filled";
    if (link.classList.contains("ccn-status-ack")    || li?.classList.contains("ccn-status-ack"))    return "ack";
    if (link.classList.contains("ccn-status-empty")  || li?.classList.contains("ccn-status-empty"))  return "empty";
    return null;
}

function clearInline(a, li) {
    ["background-color","border-color","color","--ccn-tab-bg","--ccn-tab-fg"].forEach((p)=>{
        a.style.removeProperty(p);
        if (li) li.style.removeProperty(p);
    });
    a.removeAttribute("data-ccn-dyed");
    if (li) li.removeAttribute("data-ccn-dyed");
}

function dyeOnce() {
    document.querySelectorAll(".o_notebook .nav-tabs .nav-link").forEach((a) => {
        const li = a.closest("li");
        if (a.classList.contains("active")) {
            clearInline(a, li);
            return;
        }
        const key = stateFor(a);
        if (!key) {
            clearInline(a, li);
            return;
        }
        const { bg, fg } = COLORS[key];

        // Inline + !important: esto gana a cualquier CSS del tema
        a.style.setProperty("background-color", bg, "important");
        a.style.setProperty("border-color", bg, "important");
        a.style.setProperty("color", fg, "important");

        // Variables usadas por el SCSS para teñir el chevron
        a.style.setProperty("--ccn-tab-bg", bg);
        a.style.setProperty("--ccn-tab-fg", fg);
        if (li) {
            li.style.setProperty("--ccn-tab-bg", bg);
            li.style.setProperty("--ccn-tab-fg", fg);
        }

        a.setAttribute("data-ccn-dyed", key);
        if (li) li.setAttribute("data-ccn-dyed", key);
    });
}

const service = {
    name: "ccn_quote_tabs_color_inline",
    start() {
        // Primera pasada
        dyeOnce();

        // Reaplicar en cambios de DOM (cambios de tab, renders, etc.)
        const root = document.body;
        const mo = new MutationObserver(dyeOnce);
        mo.observe(root, { childList: true, subtree: true });

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
