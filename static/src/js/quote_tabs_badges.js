/** CCN Quote Tabs — pinta leyendo rubro_state_* desde el DOM (sin RPC/URL/res_id)
 *  - No hace clics ni “barridos”.
 *  - Pinta al inicio y re-pinta solo cuando cambian los campos rubro_state_*.
 *  - Estados: 1 => verde (ccn-status-filled), 2 => ámbar (ccn-status-ack), 0/otros => rojo (ccn-status-empty).
 *  - Odoo 18 CE, sin imports. Respeta tu geometría/chevrons; solo añade clases.
 */
(function () {
  "use strict";

  // === Etiquetas EXACTAS (11) que nos pasaste → code de rubro ===
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
    // Limpieza — completar etiquetas faltantes
    "material de limpieza": "material_limpieza",
    "maquinaria de limpieza": "maquinaria_limpieza",
    "equipo especial de limpieza": "equipo_especial_limpieza",
    "herr. menor jardineria": "herramienta_menor_jardineria",
    "perfil medico": "perfil_medico",
    "maquinaria de jardineria": "maquinaria_jardineria",
    "fertilizantes y tierra lama": "fertilizantes_tierra_lama",
    "consumibles de jardineria": "consumibles_jardineria",
    "capacitacion": "capacitacion",
  };

  const CODES = Object.values(LABEL_TOCODE_SAFE());
  function LABEL_TOCODE_SAFE(){
    // helper to keep Object.values stable even if someone edits LABEL_TO_CODE
    return LABEL_TO_CODE;
  }

  // === Nombre del campo de estado por rubro ===
  const STATE_FIELD = (code) => `rubro_state_${code}`;

  // === Clases de color (tu SCSS ya las estiliza) ===
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
    // Evita trabajo si ya está aplicada
    if (link.classList.contains(c) || (li && li.classList.contains(c))) return;
    clearTab(link);
    link.classList.add(c);
    li && li.classList.add(c);
  }

  // === Lee el valor del campo de estado desde el DOM (invisible/visible) ===
  function readIntField(root, fieldName){
    // Probar selectores comunes de form OWL:
    const el = root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    const v = parseInt(String(raw).trim(), 10);
    return Number.isNaN(v) ? null : v;
  }

  // === Encuentra notebook y tabs ===
  function getNotebook(){
    return document.querySelector(".o_form_view .o_notebook");
  }
  function getLinks(nb){
    return nb ? [...nb.querySelectorAll(".nav-tabs .nav-link")] : [];
  }

  // === Extraer code desde atributos del link (name="page_CODE" o aria-controls="#page_CODE") ===
  function linkCodeByAttrs(link){
    try{
      const nameAttr = link.getAttribute("name") || link.dataset?.name || "";
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
    }catch(_e){}
    return null;
  }

  // === Del <a> obtener el id de la página destino y el nodo raíz de page ===
  function linkTargetId(a){
    try{
      const target = (a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/,"");
      return target || null;
    }catch(_e){ return null; }
  }
  function pageRootForLink(nb, a){
    const id = linkTargetId(a);
    if (!id) return null;
    try{ return nb.querySelector('#' + id) || null; }catch(_e){ return null; }
  }
  function countPageRows(page){
    if (!page) return 0;
    // Soporta distintos renderers/temas
    const rows = page.querySelectorAll('.o_list_renderer .o_data_row, .o_list_view .o_data_row, .o_list_table .o_data_row, table tbody tr');
    return rows ? rows.length : 0;
  }
  function hasListContainer(page){
    if (!page) return false;
    return !!page.querySelector('.o_list_renderer, .o_list_view, .o_list_table, table tbody');
  }

  // === Búsqueda alternativa por nombre de campo de la lista
  function listFieldNameForCode(code){
    return `line_ids_${code}`;
  }
  function fieldRoot(formRoot, fieldName){
    try{ return formRoot.querySelector(`[name="${fieldName}"]`) || formRoot.querySelector(`[data-name="${fieldName}"]`); }catch(_e){ return null; }
  }
  function countRowsInField(formRoot, code){
    const fname = listFieldNameForCode(code);
    const root = fieldRoot(formRoot, fname);
    if (!root) return null; // desconocido/no renderizado
    const rows = root.querySelectorAll('.o_list_renderer .o_data_row, .o_list_view .o_data_row, .o_list_table .o_data_row, table tbody tr');
    return rows ? rows.length : 0;
  }

  // === Construye índice tab→code y code→link por etiqueta visible ===
  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    for(const a of getLinks(nb)){
      // 1) Preferir code por atributos del link (no depende del texto visible)
      let code = linkCodeByAttrs(a);
      // 2) Si no hay atributos, intenta por etiqueta visible
      if (!code){ code = LABEL_TO_CODE[norm(a.textContent)]; }
      if(code) byCode[code] = a;
    }
    return byCode;
  }

  // === Pintado (usa únicamente rubro_state_* del DOM) ===
  function paintFromStates(formRoot, nb, byCode, last){
    let changed = false;
    for(const [code, link] of Object.entries(byCode)){
      const page = pageRootForLink(nb, link);
      let listPresent = hasListContainer(page);
      let rowCount = listPresent ? countPageRows(page) : 0;
      if (!listPresent){
        const c = countRowsInField(formRoot, code);
        if (c != null){ listPresent = true; rowCount = c; }
      }
      let sNorm;
      if (listPresent) {
        // La pestaña ya está renderizada: aplica estado por conteo inmediato
        if (rowCount > 0) {
          sNorm = 1; // filled (verde)
        } else {
          // Sin filas visibles: rojo salvo que el DOM ya indique ACK (ámbar)
          const st = readIntField(formRoot, STATE_FIELD(code));
          sNorm = (st === 2) ? 2 : 0;
        }
      } else {
        // Aún no se ha renderizado la lista: confiar en rubro_state_* del DOM
        const st = readIntField(formRoot, STATE_FIELD(code));
        sNorm = (st === 1 || st === 2) ? st : 0;
      }
      if (last[code] !== sNorm){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
      }
    }
    return changed;
  }

  // === Observa cambios en el form para re-pintar cuando cambien rubro_state_* ===
  function watchStates(formRoot, nb, byCode, last){
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      // throttle
      requestAnimationFrame(() => {
        scheduled = false;
        try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      });
    };

    const mo = new MutationObserver((muts) => {
      try{
        for(const mut of muts){
          // Si cambió algo en un nodo que alberga un campo rubro_state_*, repinta
          const t = mut.target;
          if (!(t instanceof Element)) continue;
          const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
          if (name.startsWith("rubro_state_")){
            schedule(); return;
          }
          // También, si se alteró texto dentro de esos campos
          if (name){
            // noop — ya cubierto
          } else {
            // Busca ancestro con name=data-name de interés
            const holder = t.closest?.('[name^="rubro_state_"], [data-name^="rubro_state_"]');
            if (holder){ schedule(); return; }
          }
          // 3) Cambios en listas dentro del notebook (agregar/quitar filas)
          if (t.closest?.('.o_notebook')){
            if (t.matches?.('.o_data_row, .o_list_renderer, .o_list_view, .o_list_table') ||
                t.closest?.('.o_list_renderer, .o_list_view, .o_list_table')){
              schedule(); return;
            }
          }
        }
      }catch(_e){}
    });

    mo.observe(formRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-value", "value", "class"],
    });

    // Exponer para debug opcional
    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ paintFromStates(formRoot, nb, byCode, last); }
    };
  }

  // === Boot ===
  function waitFormAndNotebook(cb){
    const tryStart = () =>{
      const formRoot = document.querySelector('.o_form_view');
      const nb = getNotebook();
      if(formRoot && nb) return cb(formRoot, nb);
    };
    if (tryStart()) return;
    const obs = new MutationObserver(()=>{
      if (tryStart()){ obs.disconnect(); }
    });
    obs.observe(document.documentElement, {childList:true,subtree:true});
  }

  try{
    waitFormAndNotebook((formRoot, nb)=>{
      const byCode = indexByCode(nb);
      if (!Object.keys(byCode).length) return; // no tabs mapeadas; salir limpio
      const last = {};
      // Pintado inicial (sin clics, inmediato)
      try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      // Observa cambios de los campos de estado
      watchStates(formRoot, nb, byCode, last);
      // Reforzar en interacciones típicas de tabs/listas
      const onClick = (ev)=>{ if (ev.target.closest && ev.target.closest('.o_notebook .nav-tabs .nav-link')){ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} } };
      document.body.addEventListener('click', onClick, true);
      document.body.addEventListener('change', (ev)=>{ if (ev.target.closest && ev.target.closest('.o_form_view')){ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} } }, true);
      document.body.addEventListener('input', (ev)=>{ if (ev.target.closest && ev.target.closest('.o_form_view')){ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} } }, true);
      // Eventos de Bootstrap para tabs (si están presentes)
      document.body.addEventListener('shown.bs.tab', ()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, true);
      document.body.addEventListener('hidden.bs.tab', ()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, true);
    });
  }catch(_e){}
})();
