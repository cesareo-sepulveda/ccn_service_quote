/** @odoo-module **/

/*
  Colorea tabs SOLO en Service Quote (form con clase ccn-quote).
  Usa MutationObserver (robusto) y re-aplica al cambiar DOM o pestaña.
*/

const PAGES = [
  "page_mano_obra",
  "page_uniforme",
  "page_epp",
  "page_epp_alturas",
  "page_equipo_especial_limpieza",
  "page_comunicacion_computo",
  "page_herr_menor_jardineria",
  "page_material_limpieza",
  "page_perfil_medico",
  "page_maquinaria_limpieza",
  "page_maquinaria_jardineria",
  "page_fertilizantes_tierra_lama",
  "page_consumibles_jardineria",
  "page_capacitacion",
];

// Lee el checkbox "ack" si existe. Convención: ack_<slug>_empty, donde slug = pageName sin "page_"
function readAckForPage(panelEl, pageName) {
  const slug = pageName.replace(/^page_/, "");
  const candidates = [
    `.o_field_widget[name="ack_${slug}_empty"] input[type="checkbox"]`,
    `[name="ack_${slug}_empty"] input[type="checkbox"]`,
  ];
  for (const sel of candidates) {
    const el = panelEl.querySelector(sel);
    if (el) return !!el.checked;
  }
  return false;
}

// Cuenta filas reales del list view (ignora "Agregar un elemento")
function countRows(panelEl) {
  // Odoo 16–18: .o_list_view tbody tr.o_data_row (editable inline)
  let rows = panelEl.querySelectorAll(".o_list_view tbody tr.o_data_row");
  if (rows.length) return rows.length;
  // Fallback amplio
  rows = panelEl.querySelectorAll(".o_list_view tbody tr:not(.o_list_record_add)");
  return rows.length || 0;
}

function linkForPanel(form, panelEl) {
  const id = panelEl.getAttribute("id");
  if (!id) return null;
  // Bootstrap 5 usa data-bs-target
  return form.querySelector(`.o_notebook .nav-link[data-bs-target="#${id}"], .o_notebook .nav-link[href="#${id}"]`);
}

function applyTabStatusesIn(form) {
  PAGES.forEach((pageName) => {
    const panel = form.querySelector(`.o_notebook .o_notebook_page[name="${pageName}"]`);
    if (!panel) return;
    const link = linkForPanel(form, panel);
    if (!link) return;

    const count = countRows(panel);
    const ack   = readAckForPage(panel, pageName);

    link.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled");
    if (count > 0)       link.classList.add("ccn-status-filled");
    else if (ack)        link.classList.add("ccn-status-ack");
    else                 link.classList.add("ccn-status-empty");
  });
}

function applyAll() {
  document.querySelectorAll(".o_form_view.ccn-quote").forEach(applyTabStatusesIn);
}

// Debounce simple para no recalcular en cada micro-cambio
let t;
function scheduleApply() {
  clearTimeout(t);
  t = setTimeout(applyAll, 60);
}

// Observa cambios de DOM dentro del webclient
function installObserver() {
  if (window.__ccnTabsObserver) return; // evita doble instalación
  const root = document.body;
  if (!root) return; // DOM aún no listo

  const obs = new MutationObserver(scheduleApply);
  obs.observe(root, { childList: true, subtree: true });
  window.__ccnTabsObserver = obs;

  // Reaplicar al click en tabs o cambios de campos dentro del form scopeado
  root.addEventListener("click", (ev) => {
    if (ev.target.closest(".o_form_view.ccn-quote .nav-link")) scheduleApply();
  });
  root.addEventListener("change", (ev) => {
    if (ev.target.closest(".o_form_view.ccn-quote")) scheduleApply();
  });

  // Primera pasada
  scheduleApply();
}

// Pequeño debugging helper
window.__ccnTabsDebug = {
  applyAll,
  installed: () => !!window.__ccnTabsObserver,
};

// Arranque inmediato cuando el script carga
(function bootstrap() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installObserver, { once: true });
  } else {
    installObserver();
  }
})();
