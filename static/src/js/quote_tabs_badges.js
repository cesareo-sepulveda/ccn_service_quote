/** @odoo-module **/

import { registry } from "@web/core/registry";

/*
  Tabs de colores SOLO en Service Quote.
  - Auto-scope: si el <form> no tiene .ccn-quote, se la añade al vuelo.
  - Detección automática de páginas (no requiere lista fija).
  - Pone clases de estado en <li> y en <a.nav-link>.
*/

function ensureScopeClass() {
  // Marca como .ccn-quote cualquier form que tenga señales de Service Quote
  document.querySelectorAll(".o_form_view:not(.ccn-quote)").forEach((form) => {
    const resModel =
      form.getAttribute("data-res-model") ||
      (form.dataset ? form.dataset.resModel || form.dataset.model : null);
    const hasQuotePages = form.querySelector(
      '.o_notebook .o_notebook_page[name^="page_"]'
    );
    const hasCurrentSite = form.querySelector(
      '.o_field_widget[name="current_site_id"], [name="current_site_id"]'
    );
    if (resModel === "ccn.service.quote" || hasQuotePages || hasCurrentSite) {
      form.classList.add("ccn-quote");
    }
  });
}

function panelCode(panelEl) {
  const name = panelEl.getAttribute("name") || panelEl.dataset.name || "";
  const m = name.match(/^page_(.+)$/);
  return m ? m[1] : null;
}

function rowRubroCode(row) {
  const cell = row.querySelector('td[data-name="rubro_code"]');
  const code = cell
    ? (cell.dataset.value || cell.textContent.trim())
    : row.dataset.rubroCode || "";
  if (code) {
    row.dataset.rubroCode = code;
  }
  return code;
}

function readAck(panelEl) {
  // dataset.cnnAck="1" indica "No Aplica" marcado
  if (panelEl.dataset.ccnAck !== undefined) {
    return panelEl.dataset.ccnAck === "1" || panelEl.dataset.ccnAck === "true";
  }
  // fallback: cualquier checkbox *_empty dentro de la página
  const el = panelEl.querySelector(
    '.o_field_widget input[type="checkbox"][name$="_empty"], input[type="checkbox"][name$="_empty"]'
  );
  return el ? !!el.checked : false;
}

function readState(form, code) {
  const el = form.querySelector(`[name="rubro_state_${code}"]`);
  return el ? el.value || "" : "";
}

function writeState(form, code, state) {
  const el = form.querySelector(`[name="rubro_state_${code}"]`);
  if (el && el.value !== state) {
    el.value = state;
  }
}

function linkForPanel(form, panelEl) {
  let id = panelEl.getAttribute("id");
  if (!id) id = panelEl.getAttribute("name") || panelEl.getAttribute("data-tab-id");
  if (!id) return null;
  const selector =
    `.o_notebook .nav-link[aria-controls="${id}"], ` +
    `.o_notebook .nav-link[data-bs-target="#${id}"], ` +
    `.o_notebook .nav-link[href="#${id}"]`;
  return form.querySelector(selector);
}

function applyInForm(form) {
  const panels = Array.from(
    form.querySelectorAll(".o_notebook .o_notebook_page")
  );
  const activePanel =
    panels.find((p) => p.classList.contains("active") || p.classList.contains("show")) ||
    panels.find((p) => p.querySelector(".o_list_view"));

  if (activePanel) {
    // Contar líneas por rubro y mostrar solo las del panel activo
    const activeCode = panelCode(activePanel);
    let count = 0;
    activePanel
      .querySelectorAll(".o_list_view tbody tr.o_data_row")
      .forEach((row) => {
        const rowCode = rowRubroCode(row);
        if (rowCode === activeCode) {
          count++;
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    const ack = readAck(activePanel);
    const state = count > 0 ? "ok" : ack ? "yellow" : "red";
    writeState(form, activeCode, state);
  }

  panels.forEach((panel) => {
    const link = linkForPanel(form, panel);
    if (!link) return;
    const li = link.closest("li");
    const targets = li ? [link, li] : [link];
    const code = panelCode(panel);
    const state = code ? readState(form, code) : "";

    targets.forEach((el) =>
      el.classList.remove("ccn-status-empty", "ccn-status-ack", "ccn-status-filled")
    );
    if (state === "ok") targets.forEach((el) => el.classList.add("ccn-status-filled"));
    else if (state === "yellow") targets.forEach((el) => el.classList.add("ccn-status-ack"));
    else targets.forEach((el) => el.classList.add("ccn-status-empty"));
  });
}

function applyAll() {
  ensureScopeClass();
  document.querySelectorAll(".o_form_view.ccn-quote").forEach(applyInForm);
}

// Debounce
let t;
function scheduleApply() { clearTimeout(t); t = setTimeout(applyAll, 60); }

// Servicio webclient — asegura ejecución al iniciar el cliente
export const ccnQuoteTabsService = {
  start() {
    const root = document.body;
    if (!root) return;
    // Observer de todo el webclient
    const obs = new MutationObserver(scheduleApply);
    obs.observe(root, { childList: true, subtree: true });
    // Reaplicar al navegar entre tabs, marcar "No Aplica" o cambiar campos
    root.addEventListener("click",  (ev) => {
      if (ev.target.closest(".o_form_view .nav-link") || ev.target.closest(".o_form_view .ccn-skip")) {
        scheduleApply();
      }
    });
    root.addEventListener("change", (ev) => { if (ev.target.closest(".o_form_view")) scheduleApply(); });
    root.addEventListener("shown.bs.tab", (ev) => {
      if (ev.target.closest(".o_form_view .nav-link")) scheduleApply();
    });
    // Primera pasada
    scheduleApply();
    // Exponer helper para debug
    window.__ccnTabsDebug = { applyAll, installed: () => true };
  },
};
registry.category("services").add("ccn_quote_tabs_service", ccnQuoteTabsService);
