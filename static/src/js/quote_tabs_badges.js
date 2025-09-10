/** @odoo-module **/

import { registry } from "@web/core/registry";

function log(...a) {
  (window.__ccnLog = window.__ccnLog || []).push(a);
  try {
    console.log("[CCN Tabs]", ...a);
  } catch (e) {}
}

function ensureScopeClass() {
  document.querySelectorAll(".o_form_view:not(.ccn-quote)").forEach((form) => {
    const hasQuotePages = form.querySelector(
      '.o_notebook .o_notebook_page[name^="page_"]'
    );
    const hasCurrentSite = form.querySelector(
      '.o_field_widget[name="current_site_id"], [name="current_site_id"]'
    );
    if (hasQuotePages || hasCurrentSite) {
      form.classList.add("ccn-quote");
      log("scope class added to form");
    }
  });
}

function panelCode(panelEl) {
  const name = panelEl.getAttribute("name") || panelEl.dataset.name || "";
  const m = name.match(/^page_(.+)$/);
  return m ? m[1] : null;
}

function readState(form, panelEl) {
  const code = panelCode(panelEl);
  if (!code) return "red";
  const el = form.querySelector(`[name="rubro_state_${code}"]`);
  return el ? el.value || "red" : "red";
}

function linkForPanel(form, panelEl) {
  const id = panelEl.getAttribute("id");
  if (!id) return null;
  return form.querySelector(
    `.o_notebook .nav-link[data-bs-target="#${id}"], .o_notebook .nav-link[href="#${id}"]`
  );
}

function applyInForm(form) {
  const panels = form.querySelectorAll(".o_notebook .o_notebook_page");
  panels.forEach((panel) => {
    const link = linkForPanel(form, panel);
    if (!link) return;
    const li = link.closest("li");
    const targets = li ? [link, li] : [link];

    const state = readState(form, panel);

    targets.forEach((el) =>
      el.classList.remove(
        "ccn-status-empty",
        "ccn-status-ack",
        "ccn-status-filled"
      )
    );
    if (state === "ok")
      targets.forEach((el) => el.classList.add("ccn-status-filled"));
    else if (state === "yellow")
      targets.forEach((el) => el.classList.add("ccn-status-ack"));
    else targets.forEach((el) => el.classList.add("ccn-status-empty"));
  });
}

function applyAll() {
  try {
    ensureScopeClass();
    const forms = document.querySelectorAll(".o_form_view.ccn-quote");
    if (!forms.length) {
      log("no .ccn-quote forms found yet");
      return;
    }
    forms.forEach(applyInForm);
    log("applyAll OK on", forms.length, "form(s)");
  } catch (e) {
    log("applyAll ERROR", e);
  }
}

let t;
function scheduleApply() {
  clearTimeout(t);
  t = setTimeout(applyAll, 80);
}

const service = {
  name: "ccn_quote_tabs_service",
  start() {
    log("service start");
    const root = document.body;
    if (!root) {
      log("no document.body");
      return;
    }

    const obs = new MutationObserver(scheduleApply);
    obs.observe(root, { childList: true, subtree: true });
    root.addEventListener("click", (ev) => {
      if (ev.target.closest(".o_form_view .nav-link")) scheduleApply();
    });
    root.addEventListener("change", (ev) => {
      if (ev.target.closest(".o_form_view")) scheduleApply();
    });

    // primera pasada (doble por si tarda el render)
    setTimeout(scheduleApply, 0);
    setTimeout(scheduleApply, 200);

    window.__ccnTabsDebug = { applyAll, installed: () => true };
    log("debug helper exposed");
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
