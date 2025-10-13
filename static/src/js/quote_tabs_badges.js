/** CCN Quote Tabs — pinta leyendo rubro_state_* desde el DOM (sin RPC/URL/res_id)
 *  - No hace clics ni "barridos".
 *  - Pinta al inicio y re-pinta solo cuando cambian los campos rubro_state_*.
 *  - Estados: 1 => verde (ccn-status-filled), 2 => ámbar (ccn-status-ack), 0/otros => rojo (ccn-status-empty).
 *  - Odoo 18 CE, sin imports. Respeta tu geometría/chevrons; solo añade clases.
 *  - v18.0.9.8.72 - Contar filas en tab activo + watch mutations en notebook
 */
(function () {
  "use strict";
  console.log('Badges JS v18.0.9.8.81 loaded - Fix: persist green on inactive tabs');

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

    // No pintar color en el <li> (evita cubrir el notch/gap del chevrón)
    try {
      if (li) {
        li.style.removeProperty('background-color');
        li.style.removeProperty('background-image');
        li.style.removeProperty('border-color');
      }
    } catch(_e) {}

    // Visibilidad del botón se controla en servidor (XML). No tocar desde JS.
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
      // Para campos de selección, buscar el <select> dentro del div
      const select = el.querySelector('select');
      if (select) {
          const raw = select.value || select.getAttribute("value") || select.getAttribute("data-value");
          if (raw) return String(raw).trim();
      }
      const raw = el.getAttribute("value") ?? el.getAttribute("data-value") ?? el.textContent;
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
          const stype = readStrField(root, 'current_service_type');
          const codes = [
              'mano_obra','uniforme','epp','epp_alturas','equipo_especial_limpieza','comunicacion_computo',
              'herramienta_menor_jardineria','material_limpieza','perfil_medico','maquinaria_limpieza',
              'maquinaria_jardineria','fertilizantes_tierra_lama','consumibles_jardineria','capacitacion'
          ];
          for(const code of codes){
              let fieldName = `rubro_state_${code}`;
              if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
              else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
              const v = readIntField(root, fieldName);
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
    // Preferir filas OWL reales y contar SOLO registros guardados (con id)
    const rows = root.querySelectorAll('.o_data_row');
    if (rows.length){
      let cnt = 0;
      rows.forEach((tr)=>{
        // 1) Fila guardada (id numérico) cuenta inmediatamente
        const idRaw = tr.getAttribute('data-res-id') || tr.getAttribute('data-id') || tr.getAttribute('data-record-id') || tr.getAttribute('data-oe-id');
        const idNum = (idRaw == null) ? NaN : parseInt(String(idRaw).trim(), 10);
        if (!Number.isNaN(idNum) && idNum > 0) { cnt += 1; return; }

        // 2) Fila no guardada: contar si product_id tiene valor (chip, link, o texto)
        const productCell = tr.querySelector('td[data-name="product_id"], td[name="product_id"]');
        if (!productCell) return;

        // Buscar chips/tags/links del many2one confirmado
        if (productCell.querySelector('a[href], .o_m2o_chip, .o_m2o_tag, .o_m2o_value')) {
          cnt += 1;
          return;
        }

        // Buscar input con valor seleccionado (aunque aún esté visible)
        const editInp = productCell.querySelector('input[role="combobox"], input.o-autocomplete--input');
        if (editInp) {
          const inputValue = (editInp.value || '').trim();
          // Si el input tiene valor Y no está vacío, contar
          // Esto permite contar inmediatamente después de seleccionar del autocompletado
          if (inputValue && inputValue.length > 0) {
            cnt += 1;
            return;
          }
        }

        // En algunos temas, el many2one muestra texto plano cuando está confirmado
        const widget = productCell.querySelector('.o_field_widget') || productCell;
        const txt = (widget.textContent || '').trim();
        if (txt && txt.length > 0) { cnt += 1; return; }

        // No contar filas completamente vacías
      });
      return cnt;
    }
    // Fallback conservador: sin .o_data_row, no asumir capturas temporales
    return 0;
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
    try{
      // ESTRATEGIA 1: Buscar en TODO el formulario (para campos que están fuera de tabs)
      let root = formRoot.querySelector(`[name="${fieldName}"]`);
      if (root) {
        console.log(`[FIELD-ROOT] Found by [name="${fieldName}"] in formRoot`);
        return root;
      }

      root = formRoot.querySelector(`[data-name="${fieldName}"]`);
      if (root) {
        console.log(`[FIELD-ROOT] Found by [data-name="${fieldName}"] in formRoot`);
        return root;
      }

      root = formRoot.querySelector(`.o_field_widget[name="${fieldName}"]`);
      if (root) {
        console.log(`[FIELD-ROOT] Found by .o_field_widget[name="${fieldName}"] in formRoot`);
        return root;
      }

      root = formRoot.querySelector(`.o_field_one2many[name="${fieldName}"]`);
      if (root) {
        console.log(`[FIELD-ROOT] Found by .o_field_one2many[name="${fieldName}"] in formRoot`);
        return root;
      }

      // ESTRATEGIA 2: Buscar dentro de TODAS las páginas del notebook
      // Los campos de líneas pueden estar en páginas no visibles
      const notebook = formRoot.querySelector('.o_notebook');
      if (notebook) {
        const pages = notebook.querySelectorAll('.tab-pane');
        // Buscando en páginas del notebook...

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];

          root = page.querySelector(`[name="${fieldName}"]`);
          if (root) {
            console.log(`[FIELD-ROOT] Found by [name="${fieldName}"] in page ${i}`);
            return root;
          }

          root = page.querySelector(`[data-name="${fieldName}"]`);
          if (root) {
            console.log(`[FIELD-ROOT] Found by [data-name="${fieldName}"] in page ${i}`);
            return root;
          }

          root = page.querySelector(`.o_field_widget[name="${fieldName}"]`);
          if (root) {
            console.log(`[FIELD-ROOT] Found by .o_field_widget[name="${fieldName}"] in page ${i}`);
            return root;
          }

          root = page.querySelector(`.o_field_one2many[name="${fieldName}"]`);
          if (root) {
            console.log(`[FIELD-ROOT] Found by .o_field_one2many[name="${fieldName}"] in page ${i}`);
            return root;
          }
        }
      }

      // Field not found - silenciar log para reducir ruido

      return null;
    }catch(_e){
      console.error('[FIELD-ROOT] Exception:', _e);
      return null;
    }
  }
  function countRowsInField(formRoot, code){
    const srvType = readStrField(formRoot, 'current_service_type');
    const fname = listFieldNameForCode(code, srvType);
    const root = fieldRoot(formRoot, fname);
    if (!root) return null; // desconocido/no renderizado
    const result = countListRows(root);
    return result;
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
// No persistimos estados de color entre contextos para evitar contaminación
let __persistStates = {};
let __persistStatesMap = {};
let __ctxChanged = false;
// Código del rubro en edición activa (optimista) — se aplica solo al siguiente pintado
let __activeCodeOptimistic = null;
// Flag para forzar estados frescos en cambio de contexto
let __forceFresh = false;
// ID único para el registro actual (evita regenerar para registros nuevos)
let __currentRecordUniqueId = null;
  // Reset duro de contexto: limpiar memorias de verde persistente y colores aplicados
  function hardContextReset(formRoot, nb){
    try{
      __filledMemo = {};
      __filledMemoMap = {};
      __persistStates = {};
      __persistStatesMap = {};
      __ackOverrides = {};
      __ackOverridesMap = {};
      __activeCodeOptimistic = null;
      __currentRecordUniqueId = null;
      __ctxChanged = true;
      try { (nb ? getLinks(nb) : getLinks(getNotebook())).forEach((a)=> clearTab(a)); } catch(_e){}
    }catch(_e){}
  }
  function currentCtxKey(formRoot){
    // Contexto por record, site y servicio (evita contaminación entre jard/limp)
    let recordId = readIntField(formRoot, 'id');
    // Para registros nuevos, generar ID único solo una vez
    if (!recordId || recordId === 'new') {
      if (!__currentRecordUniqueId) {
        __currentRecordUniqueId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }
      recordId = __currentRecordUniqueId;
    } else {
      // Si ya tiene ID real, limpiar el ID temporal
      __currentRecordUniqueId = null;
    }
    const site = readIntField(formRoot, 'current_site_id');
    const srv = readStrField(formRoot, 'current_service_type') || '';
    return `${recordId}|${site||''}|${srv}`;
  }
  function ensureCtx(formRoot){
    const key = currentCtxKey(formRoot);
    if (key !== __ctxKey){
      __ctxKey = key;
      const recordId = readIntField(formRoot, 'id') || 'new';
      const persisted = loadPersist(formRoot);
      const persistedStates = (recordId === 'new') ? {} : (persisted.states || {});
      const persistedAcks = (recordId === 'new') ? {} : (persisted.acks || {});
      if (!__filledMemoMap[key]) __filledMemoMap[key] = {};
      if (!__ackOverridesMap[key]) __ackOverridesMap[key] = { ...persistedAcks };
      if (!__persistStatesMap[key]) __persistStatesMap[key] = { ...persistedStates };
      // Forzar estados frescos en cambio de contexto
      if (__forceFresh) {
        __persistStatesMap[key] = {};
        __ackOverridesMap[key] = {};
        __filledMemoMap[key] = {};
      }
      __filledMemo = __filledMemoMap[key];
      __ackOverrides = __ackOverridesMap[key];
      __persistStates = __persistStatesMap[key];
      // REMOVIDO: No cargar desde DOM en cambio de contexto para evitar contaminación
      // Solo cargar persistedAcks que vienen del storage, no del DOM
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
    // Re-index links on every paint to survive OWL re-renders
    const map = indexByCode(nb);
    ensureCtx(formRoot);
    let dsStates = readStatesFromDataset(formRoot);
    let dsCounts = readCountsFromDataset(formRoot);
    // Si no hay dataset, usar DOM
    if (!dsStates || !Object.keys(dsStates).length){
      dsStates = fallbackStatesFromDOM(formRoot);
    }
    // Forzar estados frescos en cambio de contexto
    if (__forceFresh) { dsStates = {}; dsCounts = {}; __forceFresh = false; }
    if (!dsCounts || !Object.keys(dsCounts).length) dsCounts = {};
    let changed = false;
    const activeCode = __activeCodeOptimistic; // snapshot y limpiar al final

    // ODOO 18: Detectar tab activo PRIMERO (solo 1 tab-pane está renderizado)
    let activeTabCode = null;
    let activeRowCount = null;

    // Buscar el link activo para saber qué code es
    const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
    if (activeLink) {
      for (const [code, link] of Object.entries(byCode)) {
        if (link === activeLink) {
          activeTabCode = code;
          break;
        }
      }
    }

    // Si encontramos tab activo, contar sus filas (solo registros guardados)
    if (activeTabCode) {
      const activePage = nb.querySelector('.tab-pane.active');
      if (activePage) {
        activeRowCount = countPageRows(activePage);
      }
    }

    // Ahora iterar sobre TODOS los tabs
    for(const [code, link] of Object.entries(map)){
      let sNorm;
      let rowCount = null;
      const stateValue = dsStates?.[code]; // Leer estado del backend
      // Conteo desde el widget del campo (para cualquier tab, incluso inactivo)
      // IMPORTANTE: Solo contar fieldCount si NO es un registro nuevo (evita contaminación DOM)
      const isNewRecord = !readIntField(formRoot, 'id');
      const fieldCountRaw = isNewRecord ? null : countRowsInField(formRoot, code);
      const fieldCount = (fieldCountRaw == null) ? 0 : fieldCountRaw;

      // Si este es el tab activo, usar el conteo que ya hicimos
      if (code === activeTabCode && activeRowCount !== null) {
        rowCount = activeRowCount;
        // Actualizar memoria con el conteo en tiempo real
        if (rowCount > 0) {
          __filledMemo[code] = true;
        } else {
          __filledMemo[code] = false;
        }
      }

      // No refrescar memoria desde backend: solo actualizar memoria cuando el tab activo
      // muestra conteo real (rowCount); así el verde persiste al cambiar de tab

      // Determinar estado normalizado (sNorm)
      // Prioridad: override ámbar > conteo directo (tab activo) > conteo por campo (cualquier tab) > memoria > backend > persistido
      let debugSource = '';
      if (__ackOverrides[code]) {
        // Override "No Aplica" (ámbar)
        sNorm = 2;
        debugSource = 'ackOverride';
      } else if (rowCount !== null) {
        // Tab activo: usar conteo directo (SIEMPRE tiene prioridad)
        sNorm = rowCount > 0 ? 1 : 0;
        debugSource = `rowCount(${rowCount})`;
      } else if (fieldCount > 0) {
        // Cualquier tab: el widget del campo tiene filas confirmadas/guardadas
        sNorm = 1;
        debugSource = `fieldCount(${fieldCount})`;
      } else if (__filledMemo[code]) {
        // Memoria de verde cuando previamente se detectó contenido real
        sNorm = 1;
        debugSource = 'filledMemo';
      } else if (stateValue === 1) {
        // Backend dice que está lleno (registro guardado)
        sNorm = 1;
        debugSource = 'backend(1)';
      } else if (stateValue === 2) {
        // Backend dice "No Aplica"
        sNorm = 2;
        debugSource = 'backend(2)';
      } else if ((__persistStates && !readIntField(formRoot,'id')) ? false : (__persistStates && (__persistStates[code] === 1 || __persistStates[code] === 2 || __persistStates[code] === 0))) {
        // Fallback a último estado persistido para tabs inactivos
        sNorm = __persistStates[code];
        debugSource = `persistStates(${sNorm})`;
      } else {
        // Sin información: vacío
        sNorm = 0;
        debugSource = 'default(empty)';
      }

      // Log solo para estados no vacíos (verde o ámbar) para debug
      if (sNorm !== 0 && (fieldCount > 0 || __filledMemo[code] || stateValue || __persistStates[code])) {
        console.log(`[CCN] ${code}: ${debugSource} → ${sNorm === 1 ? 'VERDE' : sNorm === 2 ? 'ÁMBAR' : 'ROJO'}`);
      }

      // Persistir último estado decidido por código/contexto
      try { __persistStates[code] = sNorm; } catch(_e) {}

      // Limpiar override si ahora está verde
      if (sNorm === 1 && __ackOverrides[code] != null) {
        delete __ackOverrides[code];
      }

      // Log solo si el estado cambió (evitar spam)
      // (El log se movió a applyTab para mostrar solo cuando cambia)
      // Contador de líneas: usar dsCounts del backend (si existe)
      let displayCount = 0;
      if (dsCounts && Object.prototype.hasOwnProperty.call(dsCounts, code)){
        const dsNum = parseInt(dsCounts[code] || 0, 10) || 0;
        displayCount = dsNum;
      }
      // Si no hay contador pero el estado es verde (1) o tenemos filas contadas, mostrar contador
      if (!displayCount && rowCount && rowCount > 0) displayCount = rowCount;
      if (!displayCount && stateValue === 1) displayCount = '✓';
      try{ setTabCount(link, displayCount); }catch(_e){}

      // Asegurar que el DOM nuevo (tras re-render) tenga la clase correcta aunque el estado no cambie
      const desiredClass = clsFor(sNorm);
      const liNode = link.closest ? link.closest('li') : null;
      const missingClass = !link.classList.contains(desiredClass) || (liNode && !liNode.classList.contains(desiredClass));

      if (last[code] !== sNorm || missingClass){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
        // Log solo cuando el estado cambia Y es tab activo con conteo real
        if (sNorm === 1 && rowCount !== null && rowCount > 0) {
          console.log(`✅ ${code}: ${rowCount} filas → VERDE`);
        }
      }
    }
    // Guardar persistencia por contexto (estados + overrides de ámbar)
    try{
      const isNew = !readIntField(formRoot,'id');
      __ackOverridesMap[__ctxKey] = { ...__ackOverrides };
      __persistStatesMap[__ctxKey] = { ...__persistStates };
      savePersist(formRoot, isNew ? {} : __persistStates, isNew ? {} : __ackOverrides);
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

          // ODOO 18: Detectar cambios en tabs activos (cuando agregas/eliminas líneas)
          // Buscar cambios en .o_data_row, .o_list_table, o botones "Agregar una línea"
          if (t.closest && t.closest('.o_notebook')){
            // Solo procesar cambios en el tab activo
            const activePane = t.closest('.tab-pane.active');
            if (!activePane) {
              // Cambio en tab inactivo, ignorar
              continue;
            }
            // Si es un cambio en una tabla de líneas, repintar inmediatamente
            if (t.matches('.o_list_table, .o_data_row, .o_field_x2many_list, .o_field_one2many, .o_field_many2many') ||
                t.querySelector('.o_list_table, .o_data_row')) {
              schedule();
              return;
            }
            // Cambio genérico dentro del notebook activo (throttled)
            schedule();
            return;
          }

          const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
          if (name === 'current_service_type' || name === 'current_site_id'){
            // Reset duro si el cambio ocurrió por script (sin evento change)
            __forceFresh = true;
            try{ hardContextReset(formRoot, nb); }catch(_e){}
            // No pintar aquí, esperar a que publishStates actualice el dataset
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
      attributeFilter: ["data-value", "value", "class"],
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
      // IMPORTANTE: Solo ejecutar en vistas de ccn.service.quote
      // Verificar que existe el elemento .o_ccn_rubro_states (único de CCN quotes)
      if (!formRoot) return false;
      const rubroStatesElement = formRoot.querySelector('.o_ccn_rubro_states');
      if (!rubroStatesElement) return false; // No es una cotización CCN
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

      // Detectar cambios de registro (cuando se abre otra cotización)
      let lastRecordId = readIntField(formRoot, 'id');
      const checkRecordChange = () => {
        const currentRecordId = readIntField(formRoot, 'id');
        if (currentRecordId !== lastRecordId) {
          console.log(`[CCN] Record changed from ${lastRecordId} to ${currentRecordId} - resetting context`);
          lastRecordId = currentRecordId;
          // Reset completo cuando cambia el registro
          __currentRecordUniqueId = null;
          __ctxKey = null;
          __filledMemo = {};
          __filledMemoMap = {};
          __persistStates = {};
          __persistStatesMap = {};
          __ackOverrides = {};
          __ackOverridesMap = {};
          __forceFresh = true;
          for (const k in last) delete last[k];
          try { getLinks(nb).forEach((a)=> clearTab(a)); } catch(_e){}
          try { paintFromStates(formRoot, nb, byCode, last); } catch(_e){}
        }
      };

      // Pintado inicial (sin clics, inmediato)
      try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      // Observa cambios de los campos de estado
      watchStates(formRoot, nb, byCode, last);
      // Reintentos breves tras carga por si el DOM/render llega tarde
      [50, 150, 350, 600].forEach((ms)=> setTimeout(()=>{
        checkRecordChange();
        try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      }, ms));
      // Repintar específico al cambiar sitio/servicio
      const onQuickRepaint = (ev)=>{
        const name = ev?.target?.getAttribute?.('name') || ev?.target?.getAttribute?.('data-name') || '';
        if (name === 'current_service_type' || name === 'current_site_id'){
          try{
            // LIMPIAR sessionStorage para el nuevo contexto (evita fantasmas)
            try {
              const newKey = currentCtxKey(formRoot);
              sessionStorage.removeItem(`ccnTabs:${newKey}`);
            } catch(_e) {}

            // Reset completamente el contexto y LIMPIAR colores previos
            __ctxKey = null;
            __filledMemo = {};
            __filledMemoMap = {};
            __activeCodeOptimistic = null;
            __ackOverrides = {};
            __ackOverridesMap = {};
            __persistStates = {};
            __persistStatesMap = {};
            __ctxChanged = true;
            __forceFresh = true;
            // CRÍTICO: Limpiar el objeto 'last' para forzar re-pintado completo
            for (const k in last) delete last[k];
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
          // Repintados adicionales para capturar la selección del autocompletado
          setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 100);
          setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 300);
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
      const onClick = (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_notebook .nav-tabs .nav-link')){
          checkRecordChange();
          try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
        }
      };
      document.body.addEventListener('click', onClick, true);
      document.body.addEventListener('change', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_form_view')){
          checkRecordChange();
          // Recalcular con datos actuales (dataset + DOM)
          try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e){}
          try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
          // Repintado adicional después de 50ms para dar tiempo al DOM
          setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 50);
        }
      }, true);
      // REMOVIDO: optimisticPaint - causaba tabs verdes en cuanto se hacía click en "Agregar línea"
      // El MutationObserver detecta cambios reales automáticamente
      document.body.addEventListener('input', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_form_view')){
          try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e){}
          try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
          // Repintado adicional después de 50ms para dar tiempo al DOM
          setTimeout(()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 50);
        }
      }, true);
      // Pintado optimista al marcar "No Aplica": aplicar ámbar inmediatamente
      document.body.addEventListener('click', (ev)=>{
        const btn = ev.target.closest && ev.target.closest('button[name="action_mark_rubro_empty"]');
        if (!btn) return;
        try{
          const page = btn.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]');
          let code = codeFromPage(page);
          code = canon(code);
          const link = code ? (indexByCode(nb)[code] || null) : null;
          if (code && link){
            // Actualizar override para que persista al cambiar de tab
            __ackOverrides[code] = true;
            applyTab(link, 2);
            last[code] = 2;
            // Escribir en el campo per-servicio correcto
            const stype = readStrField(formRoot, 'current_service_type');
            let fieldName = `rubro_state_${code}`;
            if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
            else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
            try{ writeIntField(formRoot, fieldName, 2); }catch(_e){}
            // Actualizar el dataset para que color_map lo use
            try{
              const holder = formRoot.closest('.o_form_view') || formRoot;
              let ds = holder.dataset.ccnStates;
              if (ds) {
                const obj = JSON.parse(ds);
                obj[code] = 2;
                holder.dataset.ccnStates = JSON.stringify(obj);
              }
            }catch(_e){}
            // Replicar la publicación para sincronizar servicios
            try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e){}
            // Repintar inmediatamente
            try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
          }
        }catch(_e){}
      }, true);
      // Eventos de Bootstrap para tabs (si están presentes)
      document.body.addEventListener('shown.bs.tab', ()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, true);
      document.body.addEventListener('hidden.bs.tab', ()=>{ try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, true);
    });
  }catch(_e){}
})();
