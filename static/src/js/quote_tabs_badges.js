/** @odoo-module **/

import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

/* Utilidad de log (opcional) */
function log(...a) { (window.__ccnLog = window.__ccnLog || []).push(a); try { console.log("[CCN Tabs]", ...a); } catch(e){} }

/* -------------------- Helpers -------------------- */

function normalizeCode(code) {
  switch (code) {
    case "herr_menor_jardineria":
      return "herramienta_menor_jardineria";
    default:
      return code;
  }
}

function normalizeState(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "ok" || s === "green" || s === "verde") return "ok";
  if (s.startsWith("yell") || s === "amarillo") return "yellow";
  if (s === "red" || s === "rojo") return "red";
  return s || "";
}

function linkCode(link) {
  // name="page_CODE"
  const nameAttr = link.getAttribute("name") || link.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
  // aria-controls / data-bs-target / href="#page_CODE"
  const tgt = (
    link.getAttribute("aria-controls")
    || link.getAttribute("data-bs-target")
    || link.getAttribute("data-target")
    || link.getAttribute("href")
    || ""
  ).replace(/^#/, "");
  m = tgt.match(/^page_(.+)$/);
  if (m) return m[1];
  return null;
}

function getStatesMap(form) {
  const shells = [form, form.querySelector?.("form"), form.closest?.(".o_form_view")].filter(Boolean);
  for (const el of shells) {
    const raw = el?.dataset?.ccnStates;
    if (!raw) continue;
    try {
      const map = JSON.parse(raw);
      if (map && typeof map === "object") return map;
    } catch {}
  }
  return null;
}

function ensureScopeClass() {
  document.querySelectorAll(".o_form_view").forEach((wrapper) => {
    const hasNotebook  = wrapper.querySelector(".o_notebook .nav-tabs");
    const hasCurrent   = wrapper.querySelector('[name="current_site_id"]');
    if ((hasNotebook || hasCurrent) && !wrapper.classList.contains("ccn-quote")) {
      wrapper.classList.add("ccn-quote");
    }
  });
}

/* -------------------- Núcleo de pintado -------------------- */

function applyInFormSmart(form) {
  const notebook = form.querySelector(".o_notebook");
  if (!notebook) return;

  const links = notebook.querySelectorAll(".nav-tabs .nav-link");
  if (!links.length) return;

  // 1) Obtener el mapa de estados (servidor o DOM)
  let map = getStatesMap(form);

  // Fallback: intenta leer <field name="rubro_state_*"> si no hubo dataset
  if (!map) {
    const fields = Array.from(form.querySelectorAll('[name^="rubro_state_"], [data-name^="rubro_state_"]'));
    const tmp = {};
    for (const el of fields) {
      const name = el.getAttribute("name") || el.getAttribute("data-name") || "";
      const code = name.replace(/^rubro_state_/, "");
      const val  = el.getAttribute("data-value") || el.dataset?.value || el.value || el.getAttribute("value") || el.textContent;
      const v = normalizeState(val);
      if (code && v) tmp[code] = v;
    }
    if (Object.keys(tmp).length) map = tmp;
  }

  // 2) Para cada tab, calcular su estado y poner clases + atributo data-ccn-state
  links.forEach((link) => {
    const li   = link.closest("li");
    const raw  = linkCode(link);
    const code = normalizeCode(raw || "");

    // Limpia marcas previas
    [link, li].forEach((el) => {
      if (!el) return;
      el.classList.remove("ccn-status-filled","ccn-status-ack","ccn-status-empty");
      el.removeAttribute("data-ccn-state");
    });

    // Determinar estado
    let state = "";
    if (map && code) {
      state = map[code] ?? (code === "herr_menor_jardineria" ? map["herramienta_menor_jardineria"] : "");
      state = normalizeState(state);
    }
    // Fallback ultra-min: si no hay mapa, intenta contar filas visibles del pane
    if (!state && code) {
      const cont = notebook.querySelector(`.tab-content .tab-pane [name="line_${code}_ids"]`);
      const rows = cont ? cont.querySelectorAll(".o_list_view tbody tr.o_data_row").length : 0;
      state = rows > 0 ? "ok" : "red";
    }
    if (!state) state = "red";

    // Clases de estado (por compat con tus estilos previos)
    const cls = state === "ok" ? "ccn-status-filled" : (state === "yellow" ? "ccn-status-ack" : "ccn-status-empty");
    [link, li].forEach((el) => el && el.classList.add(cls));

    // **Clave**: atributo usado por el SCSS para pintar INACTIVOS
    [link, li].forEach((el) => el && el.setAttribute("data-ccn-state", state));
  });
}

function applyAll() {
  try {
    ensureScopeClass();
    const forms = document.querySelectorAll(".o_form_view.ccn-quote, form.ccn-quote");
    forms.forEach(applyInFormSmart);
  } catch (e) {
    log("applyAll ERROR", e);
  }
}

let timer;
function scheduleApply() { clearTimeout(timer); timer = setTimeout(applyAll, 60); }

/* -------------------- Servicio -------------------- */

const service = {
  name: "ccn_quote_tabs_service",
  start() {
    const root = document.body;
    if (!root) return;

    const obs = new MutationObserver(scheduleApply);
    obs.observe(root, { childList: true, subtree: true });

    root.addEventListener("click",  (ev) => { if (ev.target.closest(".o_form_view .nav-link")) scheduleApply(); });
    root.addEventListener("change", (ev) => { if (ev.target.closest(".o_form_view")) scheduleApply(); });

    // Primeras pasadas
    setTimeout(scheduleApply, 0);
    setTimeout(scheduleApply, 200);

    // Debug helper
    window.__ccnTabsDebug = { applyAll, installed: () => true };
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
