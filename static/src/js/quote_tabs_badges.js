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

function readComputedState(form, code) {
  const el = form.querySelector(`[name="rubro_state_${code}"]`);
  return el ? (el.value || el.getAttribute("value") || "") : "";
}

function countRows(panelEl) {
  let rows = panelEl.querySelectorAll(".o_list_view tbody tr.o_data_row");
  if (rows.length) return rows.length;
  rows = panelEl.querySelectorAll(".o_list_view tbody tr:not(.o_list_record_add)");
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
  const activePane = form.querySelector(".o_notebook .tab-content .tab-pane.active");
  links.forEach((link) => {
    const code = linkCode(link);
    if (!code) return;
    const li = link.closest("li");
    const targets = li ? [link, li] : [link];

    // Remove previous state classes
    targets.forEach((el) => el.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled"));

    // Prefer computed state from hidden fields; fallback to counting rows when available
    let state = readComputedState(form, code);
    if (!state && activePane) {
      const count = countRows(activePane);
      const ack = readAck(activePane);
      state = count > 0 ? "ok" : ack ? "yellow" : "red";
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
    forms.forEach(applyInForm);
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
