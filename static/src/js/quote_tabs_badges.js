(function () {
  "use strict";

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
    "equipo especial de limpieza": "equipo_especial_limpieza",
    "comunicacion y computo": "comunicacion_computo",
    "herr. menor jardineria": "herramienta_menor_jardineria",
    "material de limpieza": "material_limpieza",
    "perfil medico": "perfil_medico",
    "maquinaria de limpieza": "maquinaria_limpieza",
    "maquinaria de jardineria": "maquinaria_jardineria",
    "fertilizantes y tierra lama": "fertilizantes_tierra_lama",
    "consumibles de jardineria": "consumibles_jardineria",
    "capacitacion": "capacitacion",
  };
  const STATE_FIELD = (code) => `rubro_state_${code}`;

  function clsFor(st){
    return st === 1 ? "ccn-status-filled"
         : st === 2 ? "ccn-status-ack"
         : "ccn-status-empty";
  }
  function clearTab(link){
    if(!link) return;
    const li = link.closest ? link.closest("li") : null;
    const rm = ["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove(...rm);
    li && li.classList.remove(...rm);
  }
  function applyTab(link, st){
    if(!link) return;
    const li = link.closest ? link.closest("li") : null;
    const c = clsFor(st);
    if (link.classList.contains(c) || (li && li.classList.contains(c))) return;
    clearTab(link);
    link.classList.add(c);
    li && li.classList.add(c);
  }

  function readIntField(root, fieldName){
    const el = root.querySelector(`.o_ccn_rubro_states [name="${fieldName}"], .o_ccn_rubro_states [data-name="${fieldName}"]`)
            || root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    const v = parseInt(String(raw).trim(), 10);
    return Number.isNaN(v) ? null : v;
  }

  function getForm(){ return document.querySelector(".o_form_view.ccn-quote"); }
  function getNotebook(){ return document.querySelector(".o_form_view.ccn-quote .o_notebook"); }
  function getLinks(nb){ return nb ? [...nb.querySelectorAll(".nav-tabs .nav-link")] : []; }

  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    for(const a of getLinks(nb)){
      const code = LABEL_TO_CODE[norm(a.textContent)];
      if(code) byCode[code] = a;
    }
    return byCode;
  }

  // Fallback: si no hay rubro_state_ disponible todavía en la pestaña activa
  function deduceStateFromActivePage(link){
    try{
      const paneId = link.getAttribute("data-bs-target") || link.getAttribute("href");
      if(!paneId || !paneId.startsWith("#")) return null;
      const pane = document.querySelector(paneId);
      if(!pane) return null;
      const rows = pane.querySelectorAll('.o_list_view table tbody tr');
      for(const tr of rows){
        if (!tr.classList.contains('o_empty_row')) return 1; // hay filas => filled
      }
      return 0; // vacío
    }catch(_e){ return null; }
  }

  function paintFromStates(formRoot, nb, byCode, last){
    let changed = false;
    for(const [code, link] of Object.entries(byCode)){
      let st = readIntField(formRoot, STATE_FIELD(code));
      if (st !== 1 && st !== 2 && st !== 0){
        if (link.classList.contains('active')){
          const d = deduceStateFromActivePage(link);
          if (d !== null) st = d;
        }
      }
      const sNorm = (st === 1 || st === 2) ? st : 0;
      if (last[code] !== sNorm){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
      }
    }
    return changed;
  }

  function watch(formRoot, nb, byCode, last){
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(()=>{ scheduled = false; try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 0);
      setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 120);
    };

    // 1) Mutaciones en estados / listas
    const mo = new MutationObserver((muts) => {
      for(const mut of muts){
        const t = mut.target;
        if (!(t instanceof Element)) continue;
        const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
        if (name.startsWith("rubro_state_")) { schedule(); return; }
        if (t.closest?.('.o_list_view') || t.closest?.('.o_x2m_view')) { schedule(); return; }
      }
    });
    mo.observe(formRoot, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["data-value","value","class"] });

    // 2) Click en tabs => repinta
    nb.addEventListener('click', (ev)=>{
      const a = ev.target.closest?.('.nav-tabs .nav-link');
      if (!a) return;
      setTimeout(schedule, 60);
      setTimeout(schedule, 180);
    }, true);

    // 3) Cambios de sitio / tipo servicio => repinta
    const siteField = formRoot.querySelector('[name="current_site_id"], [data-name="current_site_id"]');
    const svcField  = formRoot.querySelector('[name="current_service_type"], [data-name="current_service_type"]');
    const moScope = new MutationObserver(()=> { schedule(); });
    if (siteField) moScope.observe(siteField, {attributes:true, childList:true, subtree:true, characterData:true});
    if (svcField)  moScope.observe(svcField,  {attributes:true, childList:true, subtree:true, characterData:true});

    // 4) Ediciones dentro de listas => repinta
    formRoot.addEventListener('change', (ev)=>{ if (ev.target.closest('.o_list_view')) schedule(); }, true);
    formRoot.addEventListener('input',  (ev)=>{ if (ev.target.closest('.o_list_view')) schedule(); }, true);

    // debug opcional
    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ paintFromStates(formRoot, nb, byCode, last); },
    };
  }

  function waitFormAndNotebook(cb){
    const tryStart = () =>{
      const formRoot = getForm();
      const nb = getNotebook();
      if(formRoot && nb) return cb(formRoot, nb);
    };
    if (tryStart()) return;
    const obs = new MutationObserver(()=>{ if (tryStart()) obs.disconnect(); });
    obs.observe(document.documentElement, {childList:true,subtree:true});
  }

  try{
    waitFormAndNotebook((formRoot, nb)=>{
      const byCode = indexByCode(nb);
      if (!Object.keys(byCode).length) return;
      const last = {};
      try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      watch(formRoot, nb, byCode, last);
    });
  }catch(_e){}
})();
