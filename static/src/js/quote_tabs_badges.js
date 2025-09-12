/** @odoo-module **/

import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

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
  const nameAttr = link.getAttribute("name") || link.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
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

function normalizeState(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "ok" || s === "green" || s === "verde") return "ok";
  if (s.startsWith("yell") || s === "amarillo") return "yellow";
  if (s === "red" || s === "rojo") return "red";
  return s;
}

function getStatesMap(form) {
  const wrapper = form.closest ? (form.closest('.o_form_view') || form) : form;
  const raw = wrapper && wrapper.dataset ? wrapper.dataset.ccnStates : null;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getRecordIdFromHash() {
  try {
    const rawHash = window.location.hash || "";
    const hash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
    const queryish = hash.includes("?") ? hash.split("?")[1] : hash;
    const params = new URLSearchParams(queryish);
    for (const k of ["id", "res_id", "active_id"]) {
      const v = parseInt(params.get(k), 10);
      if (Number.isFinite(v)) return v;
    }
    let m = rawHash.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    if (m) return +m[1];
    m = rawHash.match(/(?:^|#|\/)(?:ccn\.service\.quote)\/(\d+)(?:[/?#]|$)/);
    if (m) return +m[1];
  } catch {}
  try {
    const c = odoo?.__DEBUG__?.services?.action?.currentController;
    const rid = c?.model?.root?.data?.id;
    if (Number.isFinite(rid)) return rid;
  } catch {}
  return null;
}

async function ensureStatesForForm(form) {
  if (getStatesMap(form)) return;
  if (form.__ccnStatesLoading) return;

  // 1) Intento DOM: leer cualquier campo rubro_state_*
  const sels = '[name^="rubro_state_"], [data-name^="rubro_state_"], .o_field_widget[name^="rubro_state_"], .o_field_widget[data-name^="rubro_state_"]';
  const fields = Array.from(form.querySelectorAll(sels));
  const states = {};
  fields.forEach((el) => {
    const name = el.getAttribute("name") || el.getAttribute("data-name") || "";
    const code = name.replace(/^rubro_state_/, "");
    const direct = el.getAttribute("data-value") || el.dataset?.value || el.value || el.getAttribute("value");
    const txt = (el.textContent || "").toLowerCase();
    const v = normalizeState(direct || (txt.includes("amarillo") ? "yellow" : (/(^|\\s)ok(\\s|$)/.test(txt) ? "ok" : (txt.includes("rojo") ? "red" : ""))));
    if (code && v) states[code] = v;
  });
  if (Object.keys(states).length) {
    try { (form.closest('.o_form_view') || form).dataset.ccnStates = JSON.stringify(states); } catch {}
    scheduleApply();
    return;
  }

  // 2) Fallback RPC: leer del servidor
  const id = getRecordIdFromHash();
  if (!id) return;
  form.__ccnStatesLoading = true;
  try {
    const res = await rpc('/web/dataset/call_kw/ccn.service.quote/get_rubro_states', {
      model: 'ccn.service.quote', method: 'get_rubro_states', args: [[id]], kwargs: {},
    });
    if (res && typeof res === 'object') {
      const s = {};
      Object.keys(res).forEach((c) => { const v = normalizeState(res[c]); if (v) s[c] = v; });
      try { (form.closest('.o_form_view') || form).dataset.ccnStates = JSON.stringify(s); } catch {}
      scheduleApply();
    }
  } catch (e) {
    log('RPC states fetch failed', e);
  } finally {
    form.__ccnStatesLoading = false;
  }
}

function readStateSmart(form, rawCode) {
  const code = normalizeCode(rawCode || "");
  const states = getStatesMap(form);
  if (states) {
    const v = states[code];
    if (v) return normalizeState(String(v));
  }
  const el = form.querySelector(
    `[name="rubro_state_${code}"], [data-name="rubro_state_${code}"], .o_field_widget[name="rubro_state_${code}"], .o_field_widget[data-name="rubro_state_${code}"]`
  );
  if (el) {
    const direct = el.getAttribute("data-value") || el.dataset?.value || el.value || el.getAttribute("value");
    if (direct) return normalizeState(String(direct));
    const innerData = el.querySelector?.("[data-value]");
    if (innerData) return normalizeState(String(innerData.getAttribute("data-value") || ""));
  }
  return "";
}

function countRowsForCode(form, code) {
  const container = form.querySelector(`.o_notebook .tab-content .tab-pane [name="line_${code}_ids"]`);
  if (!container) return 0;
  const rows = container.querySelectorAll(".o_list_view tbody tr.o_data_row");
  return rows.length || 0;
}

function applyInFormSmart(form) {
  const links = form.querySelectorAll(".o_notebook .nav-tabs .nav-link");
  links.forEach((link) => {
    const raw = linkCode(link);
    const code = normalizeCode(raw || "");
    if (!code) return;

    const li = link.closest("li");
    const targets = li ? [link, li] : [link];
    if (li) li.classList.add("ccn-tab-angle"); else link.classList.add("ccn-tab-angle");
    targets.forEach((el) => el.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled"));

    let state = readStateSmart(form, code);

    // Fallback por conteo si no hay state o si viene 'red' pero sí hay líneas visibles
    if (!state || state === "red") {
      const count = countRowsForCode(form, code);
      if (!state && count > 0) state = "ok";
      if (state === "red" && count > 0) state = "ok";
      if (!state && count === 0) state = "red";
    }

    if (state === "ok")           targets.forEach((el) => el.classList.add("ccn-status-filled"));
    else if (state === "yellow")  targets.forEach((el) => el.classList.add("ccn-status-ack"));
    else                          targets.forEach((el) => el.classList.add("ccn-status-empty"));
  });
}

function applyAll() {
  try {
    ensureScopeClass();
    const forms = document.querySelectorAll(".o_form_view.ccn-quote, form.ccn-quote");
    if (!forms.length) { log("no .ccn-quote forms found yet"); return; }
    forms.forEach((f) => { ensureStatesForForm(f); });
    forms.forEach(applyInFormSmart);
    log("applyAll OK on", forms.length, "form(s)");
  } catch (e) {
    log("applyAll ERROR", e);
  }
}

let t;
function scheduleApply() { clearTimeout(t); t = setTimeout(applyAll, 120); }

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

    setTimeout(scheduleApply, 0);
    setTimeout(scheduleApply, 300);

    window.__ccnTabsDebug = { applyAll, installed: () => true };
    log("debug helper exposed");
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
