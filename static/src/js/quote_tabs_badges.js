/** @odoo-module **/

/*
  Tabs de colores SOLO en Service Quote.
  - Detecta automáticamente las páginas del notebook (no requiere PAGES).
  - Si el <form> no tiene .ccn-quote, se la añade al vuelo por detección.
  - Coloca clases de estado en <li> y en <a.nav-link>.
*/

function ensureScopeClass() {
  // Busca formularios que aún no tengan .ccn-quote pero parezcan Service Quote
  document.querySelectorAll(".o_form_view:not(.ccn-quote)").forEach((form) => {
    const hasQuotePages = form.querySelector(
      '.o_notebook .o_notebook_page[name^="page_"], .o_notebook .o_notebook_page[name="page_mano_obra"]'
    );
    const hasCurrentSite = form.querySelector(
      '.o_field_widget[name="current_site_id"], [name="current_site_id"]'
    );
    if (hasQuotePages || hasCurrentSite) {
      form.classList.add("ccn-quote");
    }
  });
}

function countRows(panelEl) {
  let rows = panelEl.querySelectorAll(".o_list_view tbody tr.o_data_row");
  if (rows.length) return rows.length;
  rows = panelEl.querySelectorAll(".o_list_view tbody tr:not(.o_list_record_add)");
  return rows.length || 0;
}

function readAck(panelEl) {
  // cualquier checkbox *_empty dentro de la página
  const el = panelEl.querySelector(
    '.o_field_widget input[type="checkbox"][name$="_empty"], input[type="checkbox"][name$="_empty"]'
  );
  return el ? !!el.checked : false;
}

function linkForPanel(form, panelEl) {
  const id = panelEl.getAttribute("id");
  if (!id) return null;
  return form.querySelector(
    `.o_notebook .nav-link[data-bs-target="#${id}"], .o_notebook .nav-link[href="#${id}"]`
  );
}

function applyInForm(form) {
  form.querySelectorAll(".o_notebook .o_notebook_page").forEach((panel) => {
    const link = linkForPanel(form, panel);
    if (!link) return;
    const li = link.closest("li");
    const targets = li ? [link, li] : [link];

    const count = countRows(panel);
    const ack   = readAck(panel);

    targets.forEach((el) =>
      el.classList.remove("ccn-status-empty", "ccn-status-ack", "ccn-status-filled")
    );
    if (count > 0)       targets.forEach((el) => el.classList.add("ccn-status-filled"));
    else if (ack)        targets.forEach((el) => el.classList.add("ccn-status-ack"));
    else                 targets.forEach((el) => el.classList.add("ccn-status-empty"));
  });
}

function applyAll() {
  ensureScopeClass();
  document.querySelectorAll(".o_form_view.ccn-quote").forEach(applyInForm);
}

// Debounce sencillo
let t;
function scheduleApply() { clearTimeout(t); t = setTimeout(applyAll, 60); }

function installObserver() {
  if (window.__ccnTabsObserver) return;
  const root = document.body;
  if (!root) return;

  const obs = new MutationObserver(scheduleApply);
  obs.observe(root, { childList: true, subtree: true });
  window.__ccnTabsObserver = obs;

  root.addEventListener("click",  (ev) => {
    if (ev.target.closest(".o_form_view.ccn-quote .nav-link")) scheduleApply();
  });
  root.addEventListener("change", (ev) => {
    if (ev.target.closest(".o_form_view")) scheduleApply();
  });

  scheduleApply();
}

window.__ccnTabsDebug = { applyAll, installed: () => !!window.__ccnTabsObserver };

(function bootstrap() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installObserver, { once: true });
  } else {
    installObserver();
  }
})();
