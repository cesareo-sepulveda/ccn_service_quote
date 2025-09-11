/** @odoo-module **/

import { registry } from "@web/core/registry";

function log(...a) { (window.__ccnLog = window.__ccnLog || []).push(a); try { console.log("[CCN Tabs]", ...a); } catch(e){} }

function ensureScopeClass() {
  document.querySelectorAll(".o_form_view").forEach((wrapper) => {
    const hasQuotePages  = wrapper.querySelector('.o_notebook .o_notebook_page[name^="page_"]');
    const hasCurrentSite = wrapper.querySelector('.o_field_widget[name="current_site_id"], [name="current_site_id"]');
    if (hasQuotePages || hasCurrentSite) {
      if (!wrapper.classList.contains("ccn-quote")) {
        wrapper.classList.add("ccn-quote");
        log("scope class added to .o_form_view");
      }
      const innerForm = wrapper.querySelector("form");
      if (innerForm && !innerForm.classList.contains("ccn-quote")) {
        innerForm.classList.add("ccn-quote");
        log("scope class added to <form>");
      }
    }
  });
}

function linkCode(link) {
  // Prefer explicit name="page_CODE"
  const nameAttr = link.getAttribute("name") || link.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
  // Fallback to target id (aria-controls / data-bs-target / href)
  const target = (
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

function normalizeCode(code) {
  switch (code) {
    case "herr_menor_jardineria":
      return "herramienta_menor_jardineria";
    default:
      return code;
  }
}

function getStatesMap(form) {
  const wrapper = form.closest ? (form.closest('.o_form_view') || form) : form;
  const raw = wrapper && wrapper.dataset ? wrapper.dataset.ccnStates : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function readStateSmart(form, code) {
  // First, try states provided by FormController (authoritative)
  const states = getStatesMap(form);
  if (states) {
    const v = states[normalizeCode(code)];
    if (v) return String(v).toLowerCase();
  }
  const norm = normalizeCode(code);
  const el = form.querySelector(`[name="rubro_state_${norm}"]`);
  if (el) {
    const direct = el.getAttribute("data-value") || (el.dataset && el.dataset.value) || el.value || el.getAttribute("value");
    if (direct) return String(direct).toLowerCase();
    const innerData = el.querySelector && el.querySelector("[data-value]");
    if (innerData) return String(innerData.getAttribute("data-value") || "").toLowerCase();
    const select = el.matches && el.matches("select") ? el : el.querySelector && el.querySelector("select");
    if (select && select.value) return String(select.value).toLowerCase();
    const input = el.matches && el.matches("input") ? el : el.querySelector && el.querySelector("input");
    if (input && input.value) return String(input.value).toLowerCase();
    const txt = (el.textContent || "").toLowerCase();
    if (/(^|\s)ok(\s|$)/.test(txt)) return "ok";
    if (txt.includes("amarillo")) return "yellow";
    if (txt.includes("rojo")) return "red";
  }
  return "";
}

function applyInFormSmart(form) {
  const links = form.querySelectorAll(".o_notebook .nav-tabs .nav-link");
  links.forEach((link) => {
    const raw = linkCode(link);
    const code = normalizeCode(raw || "");
    if (!code) return;
    const li = link.closest("li");
    const targets = li ? [link, li] : [link];

    targets.forEach((el) => el.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled"));

    let state = readStateSmart(form, code);
    if (!state) {
      const cont = form.querySelector(`.o_notebook .tab-content [name="line_${code}_ids"]`);
      if (cont) {
        const count = countRows(cont);
        state = count > 0 ? "ok" : "red";
      } else {
        // Pane no montado aún; evitar forzar un color incorrecto
        state = "";
      }
    }

    if (state === "ok")           targets.forEach((el) => el.classList.add("ccn-status-filled"));
    else if (state === "yellow")  targets.forEach((el) => el.classList.add("ccn-status-ack"));
    else if (state === "red")     targets.forEach((el) => el.classList.add("ccn-status-empty"));
  });
}

function readComputedState(form, code) {
  const el = form.querySelector(`[name="rubro_state_${code}"]`);
  if (!el) return "";
  // try multiple ways typical in Odoo widgets
  const direct = el.getAttribute("data-value") || (el.dataset && el.dataset.value) || el.value || el.getAttribute("value");
  if (direct) return normalizeState(direct);
  const innerData = el.querySelector("[data-value]");
  if (innerData) return normalizeState(innerData.getAttribute("data-value"));
  const select = el.matches && el.matches("select") ? el : el.querySelector && el.querySelector("select");
  if (select && select.value) return normalizeState(select.value);
  const input = el.matches && el.matches("input") ? el : el.querySelector && el.querySelector("input");
  if (input && input.value) return normalizeState(input.value);
  const txt = (el.textContent || "").toLowerCase();
  if (/(^|\s)ok(\s|$)/.test(txt)) return "ok";
  if (txt.includes("amarillo")) return "yellow";
  if (txt.includes("rojo")) return "red";
  return "";
}

function normalizeState(v) {
  const s = String(v).toLowerCase().trim();
  if (s === "ok" || s === "green" || s === "verde") return "ok";
  if (s.startsWith("yell") || s === "amarillo") return "yellow";
  if (s === "red" || s === "rojo") return "red";
  return s;
}

function countRowsForCode(form, code) {
  const container = form.querySelector(`.o_notebook .tab-content .tab-pane [name="line_${code}_ids"]`);
  if (!container) return 0;
  let rows = container.querySelectorAll(".o_list_view tbody tr.o_data_row");
  if (rows.length) return rows.length;
  rows = container.querySelectorAll(".o_list_view tbody tr:not(.o_list_record_add)");
  return rows.length || 0;
}

function countRows(panelEl) {
  // Cuenta solo filas de datos reales (tr.o_data_row)
  const rows = panelEl.querySelectorAll(".o_list_view tbody tr.o_data_row");
  return rows.length || 0;
}

function readAck(panelEl) {
  const el = panelEl.querySelector(
    '.o_field_widget input[type="checkbox"][name$="_empty"], input[type="checkbox"][name$="_empty"]'
  );
  return el ? !!el.checked : false;
}

function linkForPanel(form, panelEl) {
  // Try by panel id first (Bootstrap tabs usually link via aria-controls or data-bs-target)
  const id = panelEl.getAttribute("id");
  const name = panelEl.getAttribute("name") || panelEl.dataset.name || "";
  const selectors = [];
  if (id) {
    selectors.push(
      `.o_notebook .nav-link[aria-controls="${id}"]`,
      `.o_notebook .nav-link[data-bs-target="#${id}"]`,
      `.o_notebook .nav-link[data-target="#${id}"]`,
      `.o_notebook .nav-link[href="#${id}"]`
    );
  }
  if (name) {
    // Fallback by name for cases where controls reference uses the pane name
    selectors.push(
      `.o_notebook .nav-link[aria-controls="${name}"]`,
      `.o_notebook .nav-link[data-bs-target="#${name}"]`,
      `.o_notebook .nav-link[data-target="#${name}"]`,
      `.o_notebook .nav-link[href="#${name}"]`
    );
  }
  if (!selectors.length) return null;
  return form.querySelector(selectors.join(", "));
}

function applyInForm(form) {
  // Iterate over nav links to color tabs even if panes are not yet mounted
  const links = form.querySelectorAll(".o_notebook .nav-tabs .nav-link");
  links.forEach((link) => {
    const code = linkCode(link);
    if (!code) return;
    const li = link.closest("li");
    const targets = li ? [link, li] : [link];
    // Ensure class for chevron arrow styling
    if (li) li.classList.add("ccn-tab-angle"); else link.classList.add("ccn-tab-angle");

    // Remove previous state classes
    targets.forEach((el) => el.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled"));

    // Prefer computed state from hidden fields; fallback to counting rows for this code
    let state = readComputedState(form, code);
    if (!state) {
      const count = countRowsForCode(form, code);
      state = count > 0 ? "ok" : "red";
    }

    if (state === "ok")      targets.forEach((el) => el.classList.add("ccn-status-filled"));
    else if (state === "yellow") targets.forEach((el) => el.classList.add("ccn-status-ack"));
    else                        targets.forEach((el) => el.classList.add("ccn-status-empty"));
  });
}

function applyAll() {
  try {
    ensureScopeClass();
    const forms = document.querySelectorAll(".o_form_view.ccn-quote, form.ccn-quote");
    if (!forms.length) { log("no .ccn-quote forms found yet"); return; }
    forms.forEach(applyInFormSmart);
    log("applyAll OK on", forms.length, "form(s)");
  } catch (e) {
    log("applyAll ERROR", e);
  }
}

let t;
function scheduleApply() { clearTimeout(t); t = setTimeout(applyAll, 80); }

const service = {
  name: "ccn_quote_tabs_service",
  start() {
    log("service start");
    const root = document.body;
    if (!root) { log("no document.body"); return; }

    const obs = new MutationObserver(scheduleApply);
    obs.observe(root, { childList: true, subtree: true });
    root.addEventListener("click",  (ev) => { if (ev.target.closest(".o_form_view .nav-link")) scheduleApply(); });
    root.addEventListener("change", (ev) => { if (ev.target.closest(".o_form_view")) scheduleApply(); });

    // primera pasada (doble por si tarda el render)
    setTimeout(scheduleApply, 0);
    setTimeout(scheduleApply, 200);

    window.__ccnTabsDebug = { applyAll, installed: () => true };
    log("debug helper exposed");
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
