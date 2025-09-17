/** CCN Quote Tabs — DOM-only, sin RPC ni res_id
 *  Reglas:
 *    filas > 0  -> ccn-status-filled (verde)
 *    filas = 0 y ACK marcado -> ccn-status-ack (ámbar)
 *    filas = 0 y sin ACK     -> ccn-status-empty (rojo)
 *  Odoo 18 CE, sin imports. No toca tu SCSS/chevrons.
 */
(function () {
  "use strict";

  // === Tus 11 pestañas exactas (mapeo por etiqueta visible) ===
  function norm(s){
    return String(s||"").trim().toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/\s+/g," ");
  }
  const LABEL_TO_CODE = {
    "mano de obra": "mano_obra",
    "uniforme": "uniforme",
    "epp": "epp",
    "epp alturas": "epp_alturas",
    "comunicacion y computo": "comunicacion_computo",
    "herr. menor jardineria": "herramienta_menor_jardineria",
    "perfil medico": "perfil_medico",
    "maquinaria de jardineria": "maquinaria_jardineria",
    "fertilizantes y tierra lama": "fertilizantes_tierra_lama",
    "consumibles de jardineria": "consumibles_jardineria",
    "capacitacion": "capacitacion",
  };

  // Si usas checks "No aplica" en el form, márcalos aquí (si no existen, se ignoran)
  const ACK_BY_CODE = {
    mano_obra: "ack_mano_obra_empty",
    uniforme: "ack_uniforme_empty",
    epp: "ack_epp_empty",
    epp_alturas: "ack_epp_alturas_empty",
    comunicacion_computo: "ack_comunicacion_computo_empty",
    herramienta_menor_jardineria: "ack_herramienta_menor_jardineria_empty",
    perfil_medico: "ack_perfil_medico_empty",
    maquinaria_jardineria: "ack_maquinaria_jardineria_empty",
    fertilizantes_tierra_lama: "ack_fertilizantes_tierra_lama_empty",
    consumibles_jardineria: "ack_consumibles_jardineria_empty",
    capacitacion: "ack_capacitacion_empty",
  };

  // === Helpers de estilo ===
  function clsFor(state){ return state==="ok"?"ccn-status-filled":state==="yellow"?"ccn-status-ack":"ccn-status-empty"; }
  function clearTab(link){
    if(!link) return;
    const li = link.closest ? link.closest("li") : null;
    const rm = ["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove(...rm);
    if (li) li.classList.remove(...rm);
  }
  function applyTabState(link, state){
    if(!link) return;
    const li = link.closest ? link.closest("li") : null;
    const c = clsFor(state);
    link.classList.add(c);
    if (li) li.classList.add(c);
  }

  // === DOM utils ===
  function paneFor(link){
    if(!link) return null;
    const id=(link.getAttribute("aria-controls")||link.getAttribute("data-bs-target")||link.getAttribute("href")||"").replace(/^#/,"");
    return id ? document.getElementById(id) : null;
  }
  function getActiveLink(nav){ return nav.querySelector(".nav-link.active") || null; }

  // === Conteo genérico de filas (list/kanban) ===
  function countRowsGeneric(pane){
    if(!pane) return 0;
    let total = 0;
    // List
    pane.querySelectorAll(".o_list_renderer tbody, .o_list_view tbody").forEach(tb=>{
      total += tb.querySelectorAll("tr.o_data_row, tr[data-id], tr[role='row'][data-id], tr[aria-rowindex]").length;
    });
    // Kanban
    pane.querySelectorAll(".o_kanban_renderer, .o_kanban_view").forEach(k=>{
      total += k.querySelectorAll(".o_kanban_record, .oe_kanban_card, [data-id].o_kanban_record").length;
    });
    return total;
  }

  // === Lectura de ACK desde DOM (si no están en la vista, devuelve false) ===
  function readAckFromDom(fieldName){
    const cb = document.querySelector(`input[name="${fieldName}"]`) ||
               document.querySelector(`[name="${fieldName}"] .o_checkbox input`);
    if (cb && "checked" in cb) return !!cb.checked;
    const el = document.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if (!el) return false;
    const raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
    const s = String(raw).trim().toLowerCase();
    return (s==="1"||s==="true"||s==="yes"||s==="sí"||s==="si");
  }

  function stateFromPaneAndAck(pane, code){
    const rows = countRowsGeneric(pane);
    if (rows > 0) return "ok";
    const ackField = ACK_BY_CODE[code];
    if (ackField && readAckFromDom(ackField)) return "yellow";
    return "red";
  }

  // === Montaje silencioso por tab: activa, espera contenido, mide, regresa ===
  function showTabAndWait(link, timeoutMs=700){
    return new Promise((resolve)=>{
      if(!link) return resolve();
      const pane = paneFor(link);
      // Si ya hay contenido, basta con activar y resolver
      if (pane && (pane.querySelector(".o_list_renderer, .o_list_view, .o_kanban_renderer, .o_kanban_view"))) {
        link.click?.(); return setTimeout(resolve, 0);
      }
      link.click?.();
      const t0 = Date.now(); let done = false;
      const finish = ()=>{ if(done) return; done=true; resolve(); };
      const obs = pane ? new MutationObserver(()=>{
        if (pane.querySelector(".o_list_renderer, .o_list_view, .o_kanban_renderer, .o_kanban_view")) {
          try{ obs.disconnect(); }catch{}
          finish();
        } else if (Date.now() - t0 > timeoutMs) {
          try{ obs.disconnect(); }catch{}
          finish();
        }
      }) : null;
      if (obs && pane) obs.observe(pane, {childList:true, subtree:true});
      setTimeout(()=>{ try{obs && obs.disconnect();}catch{} finish(); }, timeoutMs + 100);
    });
  }

  async function initialSweep(notebook, byCode, paneByCode){
    const nav = notebook.querySelector(".nav-tabs");
    if(!nav) return;

    const activeBefore = getActiveLink(nav);

    for (const code of Object.keys(byCode)) {
      const link = byCode[code];
      try {
        await showTabAndWait(link);
        const pane = paneByCode[code] || paneFor(link);
        paneByCode[code] = pane;
        const st = stateFromPaneAndAck(pane, code);
        clearTab(link); applyTabState(link, st);
      } catch {
        clearTab(link); applyTabState(link, "red");
      }
    }

    // Volver a la tab original (sin repintar por cambio de pestaña)
    if (activeBefore && activeBefore !== getActiveLink(nav)) {
      try { activeBefore.click?.(); } catch {}
    }
  }

  function setupObservers(notebook, byCode, paneByCode){
    const tabContent = notebook.querySelector(".tab-content") || notebook;

    const paneIdToCode = {};
    for (const [code, link] of Object.entries(byCode)) {
      const p = paneByCode[code] || paneFor(link);
      if (p && p.id) paneIdToCode[p.id] = code;
    }

    let dirty = {};
    let scheduled = false;

    function schedule(){
      if(scheduled) return;
      scheduled = true;
      setTimeout(()=>{
        scheduled = false;
        try{
          Object.keys(dirty).forEach(code=>{
            const link = byCode[code];
            const pane = paneByCode[code] || paneFor(link);
            const st = stateFromPaneAndAck(pane, code);
            clearTab(link); applyTabState(link, st);
          });
        }catch{}
        dirty = {};
      }, 60);
    }

    const mo = new MutationObserver(muts=>{
      try{
        for (const mut of muts) {
          const pane = mut.target?.closest?.(".tab-pane");
          if (pane && pane.id && paneIdToCode[pane.id]) {
            dirty[paneIdToCode[pane.id]] = true;
          }
          for (const n of mut.addedNodes || []) {
            if (!(n instanceof Element)) continue;
            const p2 = n.classList?.contains("tab-pane") ? n : n.closest?.(".tab-pane");
            if (p2 && p2.id && paneIdToCode[p2.id]) {
              dirty[paneIdToCode[p2.id]] = true;
            }
          }
        }
      }catch{}
      if (Object.keys(dirty).length) schedule();
    });
    mo.observe(tabContent, {childList:true, subtree:true});

    // Cambios de ACK -> repinta solo ese rubro (si los campos están visibles)
    document.addEventListener("change", ev=>{
      try{
        const nm = ev.target?.getAttribute?.("name");
        if (!nm) return;
        for (const [code, field] of Object.entries(ACK_BY_CODE)) {
          if (nm === field && byCode[code]) dirty[code] = true;
        }
      }catch{}
      if (Object.keys(dirty).length) schedule();
    });
  }

  function waitNotebook(cb){
    const nb = document.querySelector(".o_form_view .o_notebook");
    if (nb) return cb(nb);
    const mo = new MutationObserver(()=>{
      const n=document.querySelector(".o_form_view .o_notebook");
      if(n){ mo.disconnect(); cb(n); }
    });
    mo.observe(document.documentElement, {childList:true, subtree:true});
  }

  try{
    waitNotebook(async function(notebook){
      const links = [...notebook.querySelectorAll(".nav-tabs .nav-link")];
      if (!links.length) return;

      // Indexar por etiqueta visible (tus 11 tabs)
      const byCode = {};
      for (const a of links) {
        const code = LABEL_TO_CODE[norm(a.textContent)];
        if (code) byCode[code] = a;
      }

      const paneByCode = {};
      await initialSweep(notebook, byCode, paneByCode);
      setupObservers(notebook, byCode, paneByCode);

      // Depuración opcional
      window.__ccnTabsLiveDOM = {
        repaint(code){
          try{
            if(code && byCode[code]){
              const a=byCode[code];
              const p=paneByCode[code]||paneFor(a);
              const st=stateFromPaneAndAck(p, code);
              clearTab(a); applyTabState(a, st);
              return;
            }
            Object.keys(byCode).forEach(c=>{
              const a=byCode[c];
              const p=paneByCode[c]||paneFor(a);
              const st=stateFromPaneAndAck(p, c);
              clearTab(a); applyTabState(a, st);
            });
          }catch{}
        }
      };
    });
  }catch{}
})();
