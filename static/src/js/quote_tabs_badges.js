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

  // === Obtiene el code por etiqueta visible del tab (ignora el contador "(n)") ===
  function codeFromLabel(link){
    try{
      // texto visible sin el contador temporal "(n)" al final
      let txt = link ? (link.textContent || '') : '';
      txt = txt.replace(/\([^)]*\)\s*$/, '').trim();
      const key = norm(txt);
      return LABEL_TO_CODE[key] || null;
    }catch(_e){ return null; }
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
  function readStrField(root, fieldName){
    const el = root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    return String(raw).trim();
  }

  // === Escribe (solo en DOM) el valor de estado de un campo (para feedback inmediato) ===
  function writeIntField(root, fieldName, value){
    try{
      const el = root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
      if (!el) return false;
      const v = String(parseInt(value, 10));
      // Odoo suele reflejar el valor en data-value y/o value; mantenemos ambos más el texto
      el.setAttribute("data-value", v);
      if (el.hasAttribute("value")) el.setAttribute("value", v);
      // algunos widgets renderizan el valor como texto
      if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE){
        el.firstChild.nodeValue = v;
      } else {
        el.textContent = v;
      }
      return true;
    }catch(_e){ return false; }
  }

  // === Encuentra notebook y tabs ===
  function getNotebook(){
    return document.querySelector(".o_form_view .o_notebook");
  }
  function getLinks(nb){
    return nb ? [...nb.querySelectorAll(".nav-tabs .nav-link")] : [];
  }

  // === Contador visible desactivado: limpia cualquier badge previo y no muestra nada ===
  function setTabCount(link, _n){
    try{
      if (!link) return;
      link.querySelectorAll('.ccn-tab-count').forEach((el)=> el.remove());
    }catch(_e){}
  }

  // === Estados publicados por el FormController (JSON en data-ccn-states) ===
  function readStatesFromDataset(root){
    try{
      const holder = root?.closest?.('.o_form_view') || root;
      const ds = holder?.dataset?.ccnStates || (holder?.querySelector?.('[data-ccn-states]')?.dataset?.ccnStates) || null;
      if (!ds) return {};
      const obj = JSON.parse(ds);
      return obj && typeof obj === 'object' ? obj : {};
    }catch(_e){ return {}; }
  }
  function fallbackStatesFromDOM(root){
    const out = {};
    try{
      const codes = [
        'mano_obra','uniforme','epp','epp_alturas','equipo_especial_limpieza','comunicacion_computo',
        'herramienta_menor_jardineria','material_limpieza','perfil_medico','maquinaria_limpieza',
        'maquinaria_jardineria','fertilizantes_tierra_lama','consumibles_jardineria','capacitacion'
      ];
      for(const code of codes){
        const v = readIntField(root, `rubro_state_${code}`);
        if (v != null) out[code] = v;
      }
    }catch(_e){}
    return out;
  }

  // === Contadores publicados por el FormController (JSON en data-ccn-counts) ===
  function readCountsFromDataset(root){
    try{
      const holder = root?.closest?.('.o_form_view') || root;
      const ds = holder?.dataset?.ccnCounts || (holder?.querySelector?.('[data-ccn-counts]')?.dataset?.ccnCounts) || null;
      if (!ds) return {};
      const obj = JSON.parse(ds);
      return obj && typeof obj === 'object' ? obj : {};
    }catch(_e){ return {}; }
  }
  function readCtxFromDataset(root){
    try{
      const holder = root?.closest?.('.o_form_view') || root;
      return holder?.dataset?.ccnCtx || holder?.querySelector?.('[data-ccn-ctx]')?.dataset?.ccnCtx || '';
    }catch(_e){ return ''; }
  }
  function fallbackCountsFromDOM(root){
    const out = {};
    try{
      const codes = [
        'mano_obra','uniforme','epp','epp_alturas','equipo_especial_limpieza','comunicacion_computo',
        'herramienta_menor_jardineria','material_limpieza','perfil_medico','maquinaria_limpieza',
        'maquinaria_jardineria','fertilizantes_tierra_lama','consumibles_jardineria','capacitacion'
      ];
      for(const code of codes){
        const v = readIntField(root, `rubro_count_${code}`);
        if (v != null) out[code] = v;
      }
    }catch(_e){}
    return out;
  }

  // === Extrae code del contenedor de la lista (ancestor [name^=line_ids_]) ===
  function codeFromCell(el){
    try{
      const holder = el.closest && el.closest('[name^="line_ids_"], [data-name^="line_ids_"]');
      if (!holder) return null;
      const fname = holder.getAttribute('name') || holder.getAttribute('data-name') || '';
      const m = fname.match(/^line_ids_(.+?)(?:_(jardineria|limpieza))?$/);
      if (!m) return null;
      return canon(m[1]);
    }catch(_e){ return null; }
  }

  // === Normaliza alias de codes provenientes de name/aria-controls
  function canon(code){
    if (!code) return code;
    const map = {
      'herr_menor_jardineria': 'herramienta_menor_jardineria',
    };
    return map[code] || code;
  }

  // === Extraer code desde atributos del link (name="page_CODE" o aria-controls="#page_CODE") ===
  function linkCodeByAttrs(link){
    try{
      const nameAttr = link.getAttribute("name") || link.dataset?.name || "";
      let m = nameAttr.match(/^page_(.+)$/);
      if (m) return canon(m[1]);
      const target = (
        link.getAttribute("aria-controls") ||
        link.getAttribute("data-bs-target") ||
        link.getAttribute("data-target") ||
        link.getAttribute("href") ||
        ""
      ).replace(/^#/, "");
      m = target.match(/^page_(.+)$/);
      if (m) return canon(m[1]);
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
    // 1) Intento directo por id/selector
    try{
      const id = linkTargetId(a);
      if (id){
        const byId = nb.querySelector('#' + id);
        if (byId) return byId;
      }
    }catch(_e){}
    // 2) Fallback por índice visual (posición del link)
    try{
      const links = [...nb.querySelectorAll('.nav-tabs .nav-link')];
      const idx = links.indexOf(a);
      if (idx >= 0){
        const pages = [...nb.querySelectorAll('.tab-content .tab-pane, .o_notebook .tab-pane')];
        return pages[idx] || null;
      }
    }catch(_e){}
    return null;
  }
  // Encontrar el <a.nav-link> correspondiente a un contenedor de página (por id)
  function linkForPage(nb, page){
    if (!nb || !page) return null;
    // 1) Por id/atributos
    try{
      const id = page.id || '';
      if (id){
        const sel = [
          `.nav-tabs .nav-link[aria-controls="${id}"]`,
          `.nav-tabs .nav-link[href="#${id}"]`,
          `.nav-tabs .nav-link[data-bs-target="#${id}"]`,
        ].join(', ');
        let link = nb.querySelector(sel);
        if (!link){
          const m = (id || '').match(/^page_(.+)$/);
          if (m) link = nb.querySelector(`.nav-tabs .nav-link[name="page_${m[1]}"]`);
        }
        if (link) return link;
      }
    }catch(_e){}
    // 2) Fallback por índice visual
    try{
      const pages = [...nb.querySelectorAll('.tab-content .tab-pane, .o_notebook .tab-pane')];
      const idx = pages.indexOf(page);
      if (idx >= 0){
        const links = [...nb.querySelectorAll('.nav-tabs .nav-link')];
        return links[idx] || null;
      }
    }catch(_e){}
    return null;
  }
  // Fallback: deducir code inspeccionando los nombres de campos de lista dentro de la page
  function codeFromPage(page){
    if (!page) return null;
    try{
      const el = page.querySelector('[name^="line_ids_"], [data-name^="line_ids_"]');
      if (!el) return null;
      const fname = el.getAttribute('name') || el.getAttribute('data-name') || '';
      const m = fname.match(/^line_ids_(.+?)(?:_(jardineria|limpieza))?$/);
      if (!m) return null;
      let code = m[1];
      code = canon(code);
      return code;
    }catch(_e){ return null; }
  }
  function countListRows(root){
    if (!root) return 0;
    // Preferir filas OWL reales
    const rows = root.querySelectorAll('.o_data_row');
    if (rows.length){
      let cnt = 0;
      rows.forEach((tr)=>{
        const rowId = tr.getAttribute('data-res-id') || tr.getAttribute('data-id') || tr.getAttribute('data-record-id') || tr.getAttribute('data-oe-id');
        if (rowId){ cnt += 1; return; }
        const cell = tr.querySelector('td[data-name="product_id"], td[name="product_id"]');
        if (!cell) return;
        if (cell.querySelector('a[href], .o_m2o_chip, .o_m2o_tag')){ cnt += 1; return; }
        const inp = cell.querySelector('input[role="combobox"], input.o-autocomplete--input');
        if (inp && (inp.value || '').trim()) { cnt += 1; return; }
      });
      return cnt;
    }
    // Fallback conservador: no cuentes placeholder ni encabezados
    const body = root.querySelector('tbody');
    if (!body) return 0;
    let cnt = 0;
    body.querySelectorAll('tr').forEach((tr)=>{
      if (tr.closest('thead')) return;
      if (tr.matches('.o_list_no_records, .o_empty_list')) return;
      if (tr.querySelector('.o_field_x2many_list_row_add')) return;
      const cell = tr.querySelector('td[data-name="product_id"], td[name="product_id"]');
      if (!cell) return;
      if (cell.querySelector('a[href], .o_m2o_chip, .o_m2o_tag')) { cnt += 1; return; }
      const inp = cell.querySelector('input[role="combobox"], input.o-autocomplete--input');
      if (inp && (inp.value || '').trim()) { cnt += 1; return; }
    });
    return cnt;
  }
  function countPageRows(page){ return countListRows(page); }
  function hasListContainer(page){
    if (!page) return false;
    return !!page.querySelector('.o_list_renderer, .o_list_view, .o_list_table, tbody tr');
  }

  // Detección optimista: ¿existe algún valor de producto capturado en la página,
  // aunque aún no podamos contar filas del grid?
  function pageHasAnyProductValue(page){
    if (!page) return false;
    try{
      const row = page.querySelector('.o_data_row');
      if (!row) return false;
      const cell = row.querySelector('td[data-name="product_id"], td[name="product_id"]');
      if (!cell) return false;
      if (cell.querySelector('a[href], .o_m2o_chip, .o_m2o_tag')) return true;
      const inp = cell.querySelector('input[role="combobox"], input.o-autocomplete--input');
      if (inp && (inp.value || '').trim()) return true;
    }catch(_e){}
    return false;
  }

  // === Búsqueda alternativa por nombre de campo de la lista
  function listFieldNameForCode(code, srvType){
    // Soporte para listas separadas por tipo de servicio
    const splitCodes = new Set([
      'mano_obra', 'uniforme', 'epp', 'comunicacion_computo', 'perfil_medico', 'capacitacion'
    ]);
    if (splitCodes.has(code)){
      if (srvType === 'jardineria') return `line_ids_${code}_jardineria`;
      if (srvType === 'limpieza') return `line_ids_${code}_limpieza`;
    }
    return `line_ids_${code}`;
  }
  function fieldRoot(formRoot, fieldName){
    try{ return formRoot.querySelector(`[name="${fieldName}"]`) || formRoot.querySelector(`[data-name="${fieldName}"]`); }catch(_e){ return null; }
  }
  function countRowsInField(formRoot, code){
    const srvType = readStrField(formRoot, 'current_service_type');
    const fname = listFieldNameForCode(code, srvType);
    const root = fieldRoot(formRoot, fname);
    if (!root) return null; // desconocido/no renderizado
    return countListRows(root);
  }

  // === Construye índice tab→code y code→link por etiqueta visible ===
  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    for(const a of getLinks(nb)){
      // 1) Preferir code por atributos del link (no depende del texto visible)
      let code = linkCodeByAttrs(a);
      // 2) Si no hay atributos, intenta por etiqueta visible (nombres exactos)
      if (!code){ code = codeFromLabel(a); }
      // Importante: NO usar pageRoot/page fallback aquí para evitar mapear al tab vecino por índice
      code = canon(code);
      if(code) byCode[code] = a;
    }
    return byCode;
  }

  // === Memoria por contexto (sitio/servicio) para conservar "verde" si ya se detectó información ===
let __ctxKey = null;
let __filledMemo = {};
let __filledMemoMap = {};
// Overrides locales por contexto para mantener "No Aplica" (ámbar) tras reload/repintados
let __ackOverrides = {};
let __ackOverridesMap = {};
// Estados persistidos por contexto (para restaurar tras reload)
let __persistStates = {};
let __persistStatesMap = {};
let __ctxChanged = false;
// Código del rubro en edición activa (optimista) — se aplica solo al siguiente pintado
let __activeCodeOptimistic = null;
  function currentCtxKey(formRoot){
    const site = readIntField(formRoot, 'current_site_id');
    const stype = readStrField(formRoot, 'current_service_type');
    return `${site||''}|${stype||''}`;
  }
  function ensureCtx(formRoot){
    const key = currentCtxKey(formRoot);
    if (key !== __ctxKey){
      __ctxKey = key;
      const persisted = loadPersist(formRoot);
      const persistedStates = persisted.states || {};
      const persistedAcks = persisted.acks || {};
      if (!__filledMemoMap[key]) __filledMemoMap[key] = {};
      if (!__ackOverridesMap[key]) __ackOverridesMap[key] = { ...persistedAcks };
      if (!__persistStatesMap[key]) __persistStatesMap[key] = { ...persistedStates };
      __filledMemo = __filledMemoMap[key];
      __ackOverrides = __ackOverridesMap[key];
      __persistStates = __persistStatesMap[key];
      __ctxChanged = true;
    }
  }

  // === Persistencia en sessionStorage por contexto (site|service) ===
  function persistKey(formRoot){ return `ccnTabs:${currentCtxKey(formRoot)}`; }
  function loadPersist(formRoot){
    try{
      const raw = sessionStorage.getItem(persistKey(formRoot));
      const obj = raw ? JSON.parse(raw) : null;
      if (obj && typeof obj === 'object') return {states: obj.states||{}, acks: obj.acks||{}};
    }catch(_e){}
    return {states:{}, acks:{}};
  }
  function savePersist(formRoot, states, acks){
    try{ sessionStorage.setItem(persistKey(formRoot), JSON.stringify({states: states||{}, acks: acks||{}})); }catch(_e){}
  }

  // === Pintado (prioriza conteo inmediato; sincroniza rubro_state_* en DOM para persistir) ===
  function paintFromStates(formRoot, nb, byCode, last){
    ensureCtx(formRoot);
    let dsStates = readStatesFromDataset(formRoot);
    let dsCounts = readCountsFromDataset(formRoot);
    const dsCtx = readCtxFromDataset(formRoot);
    const ctxNow = currentCtxKey(formRoot);
    // Si el dataset corresponde a otro contexto (sitio/servicio), ignóralo por completo
    if (dsCtx && dsCtx !== ctxNow){ dsStates = {}; dsCounts = {}; }
    // No usar fallback a DOM: evita arrastrar estados de un contexto anterior
    if (!dsStates || !Object.keys(dsStates).length) dsStates = (__persistStates || {});
    if (!dsCounts || !Object.keys(dsCounts).length) dsCounts = {};
    let changed = false;
    const activeCode = __activeCodeOptimistic; // snapshot y limpiar al final
    for(const [code, link] of Object.entries(byCode)){
      const page = pageRootForLink(nb, link); // solo para ubicar el botón No Aplica
      // Determinar filas SIN depender del tab activo ni del mapping de páginas
      let rowCount = 0;
      // 1) Preferir contador publicado por el servidor
      if (dsCounts && Object.prototype.hasOwnProperty.call(dsCounts, code)){
        const n = parseInt(dsCounts[code] || 0, 10);
        rowCount = Number.isNaN(n) ? 0 : n;
      }
      // 2) Si no tenemos dataset, contar en el contenedor del campo específico del rubro
      if (!rowCount){
        const cField = countRowsInField(formRoot, code);
        if (cField != null) rowCount = cField;
      }
      // Pintado de estado
      let sNorm;
      if (__ctxChanged) {
        // En el primer repintado tras cambio de servicio/sitio, forzar todos a ROJO
        sNorm = 0;
      } else if (rowCount > 0) {
        sNorm = 1;
        __filledMemo[code] = true;
        // Hay filas, ya no aplica override ámbar
        if (__ackOverrides && __ackOverrides[code] != null) delete __ackOverrides[code];
      } else {
        // No leas el DOM (puede traer valores del contexto previo). Solo confía en dataset o en optimismo local.
        let st = 0;
        const v = dsStates?.[code];
        if (v === 1 || v === 2) st = v;
        if (__ackOverrides[code] === 2) sNorm = 2; // mantener ámbar local
        else if (__filledMemo[code] || (activeCode && code === activeCode)) sNorm = 1;
        else sNorm = (st === 1) ? 1 : (st === 2 ? 2 : 0);
        // Estabilidad: no "degradar" a rojo si antes estaba verde y no hay evidencia nueva
        const prev = last[code];
        if (!__ctxChanged && prev === 1 && sNorm === 0 && (v == null)) {
          sNorm = 1;
        }
      }
      // Visibilidad del botón "No Aplica": base en sNorm, pero:
      // - Solo ocultamos (add d-none) en rubro activo o en cambio de contexto
      // - Siempre permitimos mostrar (remove d-none) cuando sNorm === 0
      try{
        const showNoAplica = (sNorm === 0);
        const isActive = (activeCode && code === activeCode);
        const allowHide = __ctxChanged || isActive;
        if (page){
          page.querySelectorAll('button[name="action_mark_rubro_empty"]').forEach((btn)=>{
            if (showNoAplica) btn.classList.remove('d-none');
            else if (allowHide) btn.classList.add('d-none');
          });
        }
      }catch(_e){}
      // Decide contador a mostrar: dataset > conteo de campo; si 0 y es rubro activo, '1+'
      let displayCount = 0;
      if (dsCounts && Object.prototype.hasOwnProperty.call(dsCounts, code)){
        const dsNum = parseInt(dsCounts[code] || 0, 10) || 0;
        displayCount = dsNum;
      }
      if (!displayCount && rowCount) displayCount = rowCount;
      if (!displayCount && !__ctxChanged && activeCode && code === activeCode) displayCount = '1+';
      try{ setTabCount(link, displayCount); }catch(_e){}

      if (last[code] !== sNorm){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
      }
    }
    // Guardar persistencia por contexto (estados + overrides de ámbar)
    try{
      const toSave = {};
      for (const code of Object.keys(byCode)){
        if (last[code] != null) toSave[code] = last[code];
      }
      __persistStatesMap[__ctxKey] = { ...toSave };
      __persistStates = __persistStatesMap[__ctxKey];
      __ackOverridesMap[__ctxKey] = { ...__ackOverrides };
      savePersist(formRoot, __persistStates, __ackOverrides);
    }catch(_e){}
    // Limpiar optimismo: solo aplica a un ciclo de pintado
    __activeCodeOptimistic = null;
    __ctxChanged = false;
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
          // Cualquier cambio dentro del notebook: repintar (agresivo pero con RAF throttle)
          if (t.closest && t.closest('.o_notebook')){ schedule(); return; }
          const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
          if (name === 'current_service_type' || name === 'current_site_id'){
            // Reset duro si el cambio ocurrió por script (sin evento change)
            try{ hardContextReset(formRoot, nb); }catch(_e){}
            schedule();
            return;
          }
          if (name.startsWith("rubro_state_") || name.startsWith("rubro_count_")){
            schedule(); return;
          }
          // También, si se alteró texto dentro de esos campos
          if (name){
            // noop — ya cubierto
          } else {
            // Busca ancestro con name=data-name de interés
            const holder = t.closest?.('[name^="rubro_state_"], [data-name^="rubro_state_"], [name^="rubro_count_"], [data-name^="rubro_count_"]');
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
      attributeFilter: ["data-value", "value", "class", "data-ccn-states", "data-ccn-counts"],
    });

    // Exponer para debug opcional
    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ paintFromStates(formRoot, nb, byCode, last); },
      stats(){
        const out = {};
        const dsS = readStatesFromDataset(formRoot);
        const dsC = readCountsFromDataset(formRoot);
        for(const [code, link] of Object.entries(byCode)){
          const page = pageRootForLink(nb, link);
          const listPresent = hasListContainer(page);
          const pageNum = listPresent ? countPageRows(page) : 0;
          const fieldNum = (()=>{ const c = countRowsInField(formRoot, code); return c == null ? 0 : c; })();
          const dsNum = parseInt(dsC?.[code] || 0, 10) || 0;
          out[code] = {
            tab: (link.textContent||'').trim(),
            dsState: dsS?.[code] ?? null,
            dsCount: dsNum,
            pageCount: pageNum,
            fieldCount: fieldNum,
            chosen: Math.max(dsNum, pageNum, fieldNum),
          };
        }
        try { console.table(out); } catch(_) { console.log(out); }
        return out;
      }
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
      // Reintentos breves tras carga por si el DOM/render llega tarde
      [50, 150, 350, 600].forEach((ms)=> setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, ms));
      // Repintar específico al cambiar sitio/servicio
      const onQuickRepaint = (ev)=>{
        const name = ev?.target?.getAttribute?.('name') || ev?.target?.getAttribute?.('data-name') || '';
        if (name === 'current_service_type' || name === 'current_site_id'){
          try{
            // Reset completamente el contexto y LIMPIAR colores previos
            __ctxKey = null;
            __filledMemo = {};
            __filledMemoMap = {};
            __activeCodeOptimistic = null;
            __ctxChanged = true;
            // Limpiar datasets viejos para evitar que otros servicios pinten con info previa
            try{
              const holder = (formRoot.closest && formRoot.closest('.o_form_view')) || formRoot;
              if (holder && holder.dataset){ holder.dataset.ccnStates='{}'; holder.dataset.ccnCounts='{}'; holder.dataset.ccnCtx=''; }
              const inner = formRoot.querySelector && formRoot.querySelector('form');
              if (inner && inner.dataset){ inner.dataset.ccnStates='{}'; inner.dataset.ccnCounts='{}'; inner.dataset.ccnCtx=''; }
            }catch(_e){}
            try { getLinks(nb).forEach((a)=> clearTab(a)); } catch(_e){}
            paintFromStates(formRoot, nb, byCode, last);
          }catch(_e){}
          [80, 180, 360].forEach((ms)=> setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, ms));
        }
      };
      document.body.addEventListener('change', onQuickRepaint, true);
      document.body.addEventListener('input', onQuickRepaint, true);
      // Interacciones dentro de listas (click o edición por teclado) → recalcular
      document.body.addEventListener('click', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_notebook .o_list_renderer, .o_notebook .o_list_view, .o_notebook .o_list_table')){
          try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
        }
      }, true);
      document.body.addEventListener('keydown', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_notebook .o_list_renderer, .o_notebook .o_list_view, .o_notebook .o_list_table')){
          // Teclas típicas de edición/navegación en listas
          const k = ev.key || '';
          if (k) {
            try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
          }
        }
      }, true);
      // Pintado inmediato al pulsar "Agregar línea" en cualquier lista del notebook
      document.body.addEventListener('click', (ev)=>{
        const addBtn = ev.target.closest && ev.target.closest('.o_list_button_add, button.o_list_button_add, .o_list_record_add, .o_list_view_add, .o_list_table_add, .o_field_x2many_list_row_add a');
        if (!addBtn) return;
        try{
          const page = addBtn.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]');
          const link = linkForPage(nb, page);
          // Priorizar deducir el code DESDE LA PÁGINA (más confiable)
          let code = codeFromPage(page) || (link ? linkCodeByAttrs(link) : null);
          if (!code && link) code = codeFromLabel(link);
          code = canon(code);
          // No pintamos verde al abrir la fila de captura; esperar a que haya valor real
          try { paintFromStates(formRoot, nb, byCode, last); } catch(_e) {}
        }catch(_e){}
      }, true);
      // Reforzar en interacciones típicas de tabs/listas
      const onClick = (ev)=>{ if (ev.target.closest && ev.target.closest('.o_notebook .nav-tabs .nav-link')){ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} } };
      document.body.addEventListener('click', onClick, true);
      document.body.addEventListener('change', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_form_view')){
          try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
          // Quick win: si el cambio fue en product_id dentro de un tab, pintar optimista en verde y (1+)
          try{
            const holder = ev.target.closest('td[name="product_id"], td[data-name="product_id"], [name="product_id"], [data-name="product_id"], .o_data_row');
            if (holder && holder.closest){
              let code = codeFromCell(holder) || codeFromPage(holder.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]'));
              code = canon(code);
              const link = code ? byCode[code] : null;
          if (code && link){
            __activeCodeOptimistic = code;
            applyTab(link, 1);
            last[code] = 1;
            setTabCount(link, '1+');
            // Mantener verde en repintados hasta que el conteo real alcance
            __filledMemo[code] = true;
          }
            }
          }catch(_e){}
        }
      }, true);
      // También reacciona a escritura en el input M2O con blur/keyup
      const optimisticPaint = (ev)=>{
        try{
          const input = ev.target;
          if (!(input && input.closest)) return;
          const isM2O = input.matches('input[role="combobox"], input.o-autocomplete--input, .o_input');
          if (!isM2O) return;
          const cell = input.closest('td[data-name="product_id"], td[name="product_id"], [data-name="product_id"], [name="product_id"]');
          if (!cell) return;
          let code = codeFromCell(cell) || codeFromPage(input.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]'));
          code = canon(code);
          const hasText = (input.value || '').trim().length > 0;
          if (code && hasText){
            const link = byCode[code];
            if (link){
              __activeCodeOptimistic = code;
              applyTab(link, 1);
              last[code] = 1;
              setTabCount(link, '1+');
              // Mantener verde en repintados hasta que el conteo real alcance
              __filledMemo[code] = true;
            }
          }
        }catch(_e){}
      };
      document.body.addEventListener('blur', optimisticPaint, true);
      document.body.addEventListener('keyup', (ev)=>{
        const k = ev.key || '';
        if (k === 'Enter' || k === 'Tab') optimisticPaint(ev);
      }, true);
      document.body.addEventListener('input', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_form_view')){
          try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
        }
      }, true);
      // Pintado optimista al marcar "No Aplica": aplica ámbar al instante en el rubro correcto
      document.body.addEventListener('click', (ev)=>{
        const btn = ev.target.closest && ev.target.closest('button[name="action_mark_rubro_empty"]');
        if (!btn) return;
        try{
          const page = btn.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]');
          // 1) Obtener code a partir del contenedor de lista dentro de la page
          let code = codeFromPage(page);
          code = canon(code);
          // 2) Buscar el <a> por code en el índice (más estable que linkForPage)
          const link = code ? byCode[code] : null;
          if (code && link){
            applyTab(link, 2);
            last[code] = 2;
            // Persistir en DOM para estabilidad visual
            try{ writeIntField(formRoot, STATE_FIELD(code), 2); }catch(_e){}
            // Guardar override local (por contexto actual) y persistirlo
            __ackOverrides[code] = 2;
            try{
              const toSave = {};
              for (const c of Object.keys(byCode)) if (last[c] != null) toSave[c] = last[c];
              savePersist(formRoot, toSave, __ackOverrides);
            }catch(_e){}
          }
        }catch(_e){}
      }, true);
      // Eventos de Bootstrap para tabs (si están presentes)
      document.body.addEventListener('shown.bs.tab', ()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, true);
      document.body.addEventListener('hidden.bs.tab', ()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, true);
    });
  }catch(_e){}
})();
