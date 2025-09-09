/** @odoo-module **/

import { registry } from "@web/core/registry";

/*
  Tabs de colores SOLO en Service Quote.
  - Auto-scope: si el formulario <form> no tiene .ccn-quote, se la añade al vuelo.
  - Detección automática de páginas (no requiere lista fija).
  - Pone clases de estado en <li> y en <a.nav-link>.
*/

function ensureScopeClass() {
  // Marca como .ccn-quote cualquier formulario que tenga señales de Service Quote
  document.querySelectorAll(".o_form_view form:not(.ccn-quote)").forEach((form) => {
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
  const rows = Array.from(
    form.querySelectorAll(".o_list_view tbody tr.o_data_row")
  );

  // Contar líneas por rubro
  const counts = {};
  rows.forEach((row) => {
    const code = rowRubroCode(row);
    counts[code] = (counts[code] || 0) + 1;
  });

  // Mostrar solo las líneas correspondientes al panel activo
  const activePanel =
    panels.find((p) => p.classList.contains("active") || p.classList.contains("show")) ||
    panels.find((p) => p.querySelector(".o_list_view"));
  if (activePanel) {
    const activeCode = panelCode(activePanel);
    rows.forEach((row) => {
      const rowCode = rowRubroCode(row);
      row.style.display = rowCode === activeCode ? "" : "none";
    });
  }

  panels.forEach((panel) => {
    const code = panelCode(panel);
    if (!code) return;
    const ack = readAck(panel);
    const state = (counts[code] || 0) > 0 ? "ok" : ack ? "yellow" : "red";
    writeState(form, code, state);

    const link = linkForPanel(form, panel);
    if (!link) return;
    const li = link.closest("li");
    if (li) {
      li.classList.add("ccn-tab-angle");
    } else {
      link.classList.add("ccn-tab-angle");
    }
    const targets = li ? [link, li] : [link];
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
  document.querySelectorAll("form.ccn-quote").forEach(applyInForm);
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
