/** CCN Quote Tabs — pinta leyendo rubro_state_* desde el DOM (sin RPC/URL/res_id)
 *  - No hace clics ni "barridos".
 *  - Pinta al inicio y re-pinta solo cuando cambian los campos rubro_state_*.
 *  - Estados: 1 => verde (ccn-status-filled), 2 => ámbar (ccn-status-ack), 0/otros => rojo (ccn-status-empty).
 *  - Odoo 18 CE, sin imports. Respeta tu geometría/chevrons; solo añade clases.
 *  - v18.0.9.9.42 - Drop M2O hold, hard clear on exit/cancel, rely on confirmed rows only
 */
(function () {
  "use strict";
  const DEBUG = false;
  // Runtime debug toggle via localStorage: set ccnTabs.DEBUG to '1'
  function __dbgEnabled(){
    try{ return (localStorage.getItem('ccnTabs.DEBUG') || '') === '1'; }catch(_e){ return false; }
  }
  function __dbg(){ if (!__dbgEnabled()) return; try{ console.log.apply(console, arguments); }catch(_e){} }

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

    // Debug opcional
    if (DEBUG) {
      const isActive = link.classList.contains('active') || (li && li.classList.contains('active'));
      // eslint-disable-next-line no-console
      console.log(`[CCN-APPLY] ${c} (active=${isActive})`);
    }

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

  // Limpia completamente estilos/clases de tabs y sus <li> asociados
  function hardResetTabs(nb){
    try{
      const links = nb ? getLinks(nb) : [];
      links.forEach((a)=>{
        try{
          clearTab(a);
          a.removeAttribute('data-ccn-dyed');
          a.style.removeProperty('--ccn-tab-bg');
          a.style.removeProperty('--ccn-tab-fg');
          a.style.removeProperty('background');
          a.style.removeProperty('background-color');
          a.style.removeProperty('border-color');
          a.style.removeProperty('background-image');
          const li = a.closest && a.closest('li');
          if (li){
            li.removeAttribute('data-ccn-dyed');
            li.style.removeProperty('--ccn-tab-bg');
            li.style.removeProperty('--ccn-tab-fg');
            li.style.removeProperty('background');
            li.style.removeProperty('background-color');
            li.style.removeProperty('border-color');
            li.style.removeProperty('background-image');
          }
        }catch(_e){}
      });
    }catch(_e){}
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

  // === Encuentra notebook y tabs (aislado por servicio) ===
  function getNotebook(){
    try{
      const form = document.querySelector('.o_form_view');
      if (!form) return null;
      const srv = readStrField(form, 'current_service_type') || '';
      if (srv) {
        // Notebook etiquetado por servicio
        const nbSrv = form.querySelector(`.o_notebook[data-ccn-service="${srv}"]`) || form.querySelector(`.ccn-srv[data-ccn-service="${srv}"] .o_notebook`);
        if (nbSrv) return nbSrv;
      }
      // Fallback: el notebook visible
      const all = [...form.querySelectorAll('.o_notebook')];
      const vis = all.find(nb => nb.offsetParent !== null);
      return vis || all[0] || null;
    }catch(_e){ return document.querySelector('.o_form_view .o_notebook'); }
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
      const srv = readStrField(root, 'current_service_type') || '';
      let ds = null;
      if (holder) {
        if (srv && typeof holder.getAttribute === 'function') {
          const attr = holder.getAttribute(`data-ccn-states-${srv}`);
          if (attr && attr.trim()) ds = attr;
        }
        // No caer al dataset genérico cuando hay servicio activo
        if (!ds && !srv) {
          ds = holder?.dataset?.ccnStates || (holder?.querySelector?.('[data-ccn-states]')?.dataset?.ccnStates) || null;
        }
      }
      if (!ds) return {};
      const obj = JSON.parse(ds);
      return obj && typeof obj === 'object' ? obj : {};
    }catch(_e){ return {}; }
  }
  function detectService(root, nb){
    try{
      const v = readStrField(root, 'current_service_type');
      if (v === 'jardineria' || v === 'limpieza') return v;
      const scope = nb || (document.querySelector('.o_form_view .o_notebook') || root);
      // Detectar por presencia de campos de listas específicos del servicio
      if (scope && scope.querySelector && scope.querySelector('[name$="_jardineria"], [data-name$="_jardineria"]')) return 'jardineria';
      if (scope && scope.querySelector && scope.querySelector('[name$="_limpieza"], [data-name$="_limpieza"]')) return 'limpieza';
      return v || '';
    }catch(_e){ return readStrField(root, 'current_service_type') || ''; }
  }

  function fallbackStatesFromDOM(root, nb){
      const out = {};
      try{
          const stype = detectService(root, nb);
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

  // ===== Debug helpers =====
  function __collectDomStates(root){
    const stype = readStrField(root, 'current_service_type') || '';
    const codes = ['mano_obra','uniforme','epp','epp_alturas','equipo_especial_limpieza','comunicacion_computo','herramienta_menor_jardineria','material_limpieza','perfil_medico','maquinaria_limpieza','maquinaria_jardineria','fertilizantes_tierra_lama','consumibles_jardineria','capacitacion'];
    const out = {};
    for (const code of codes){
      const gen = readIntField(root, `rubro_state_${code}`);
      const jard = readIntField(root, `rubro_state_${code}_jard`);
      const limp = readIntField(root, `rubro_state_${code}_limp`);
      out[code] = { gen, jard, limp };
    }
    return { stype, states: out };
  }
  function __dumpStates(formRoot){
    try{
      const dom = __collectDomStates(formRoot);
      const fb = fallbackStatesFromDOM(formRoot, getNotebook()) || {};
      const ctx = currentCtxKey(formRoot);
      const mapNow = indexByCode(getNotebook());
      const overrides = { current: __ackOverrides, map: __ackOverridesMap };
      __dbg('[CCN-DBG] ctx=', ctx, 'service=', dom.stype);
      __dbg('[CCN-DBG] fallback (used for colors)=', fb);
      __dbg('[CCN-DBG] overrides=', overrides);
      try { console.table(dom.states); } catch(_e) { __dbg(dom.states); }
      const by = {}; for (const [c, a] of Object.entries(mapNow||{})) by[c] = (a.textContent||'').trim();
      __dbg('[CCN-DBG] tabs map=', by);
    }catch(_e){ /* ignore */ }
  }
  try{
    window.__ccnTabsDebug = (on)=>{ try{ localStorage.setItem('ccnTabs.DEBUG', on ? '1':'0'); console.log('[CCN-DBG] DEBUG=', on); }catch(_e){} };
    window.__ccnDumpStates = ()=>{ try{ const f = document.querySelector('.o_form_view'); __dumpStates(f); }catch(_e){} };
    window.__ccnProbe = (code)=>{ try{
      const f = document.querySelector('.o_form_view');
      code = String(code||'').trim();
      const v = {
        jard: readIntField(f, `rubro_state_${code}_jard`),
        limp: readIntField(f, `rubro_state_${code}_limp`),
        gen:  readIntField(f, `rubro_state_${code}`)
      };
      console.log('[CCN-DBG] probe', code, v);
    }catch(_e){} };
  }catch(_e){}

  // === Contadores publicados por el FormController (JSON en data-ccn-counts) ===
  function readCountsFromDataset(root){
    try{
      const holder = root?.closest?.('.o_form_view') || root;
      const srv = readStrField(root, 'current_service_type') || '';
      let ds = null;
      if (holder) {
        if (srv && typeof holder.getAttribute === 'function') {
          const attr = holder.getAttribute(`data-ccn-counts-${srv}`);
          if (attr && attr.trim()) ds = attr;
        }
        // No usar counts genéricos cuando hay servicio activo
        if (!ds && !srv) {
          ds = holder?.dataset?.ccnCounts || (holder?.querySelector?.('[data-ccn-counts]')?.dataset?.ccnCounts) || null;
        }
      }
      if (!ds) return {};
      const obj = JSON.parse(ds);
      return obj && typeof obj === 'object' ? obj : {};
    }catch(_e){ return {}; }
  }
  function readCtxFromDataset(root){
    try{
      const holder = root?.closest?.('.o_form_view') || root;
      const srv = readStrField(root, 'current_service_type') || '';
      if (holder && srv && typeof holder.getAttribute === 'function') {
        const v = holder.getAttribute(`data-ccn-ctx-${srv}`);
        if (v && v.trim()) return v;
      }
      // Solo retornar ctx genérico si no hay servicio activo
      if (!srv) {
        return holder?.dataset?.ccnCtx || holder?.querySelector?.('[data-ccn-ctx]')?.dataset?.ccnCtx || '';
      }
      return '';
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
      let tok = fname.replace(/^line_ids_/, '');
      const m = tok.match(/^(.+)_(jardineria|limpieza)$/);
      if (m){
        const head = canon(m[1]);
        const SPLIT_CODES = new Set(['mano_obra','uniforme','epp','comunicacion_computo','perfil_medico','capacitacion']);
        return SPLIT_CODES.has(head) ? head : canon(tok);
      }
      return canon(tok);
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

  // Determinar code base a partir de un token que puede venir con sufijo
  // Solo quitar _jardineria/_limpieza para rubros "split"; en el resto, el sufijo es parte del código
  function baseCodeFromToken(tok){
    try{
      if (!tok) return tok;
      const SPLIT_CODES = new Set(['mano_obra','uniforme','epp','comunicacion_computo','perfil_medico','capacitacion']);
      const m = String(tok).match(/^(.+?)_(jardineria|limpieza)$/);
      if (m){
        const head = canon(m[1]);
        return SPLIT_CODES.has(head) ? head : canon(tok);
      }
      return canon(tok);
    }catch(_e){ return tok; }
  }

  // === Extraer code desde atributos del link (name="page_CODE" o aria-controls="#page_CODE") ===
  function linkCodeByAttrs(link){
    try{
      const nameAttr = link.getAttribute("name") || link.dataset?.name || "";
      let m = nameAttr.match(/^page_(.+)$/);
      if (m) return baseCodeFromToken(m[1]);
      const target = (
        link.getAttribute("aria-controls") ||
        link.getAttribute("data-bs-target") ||
        link.getAttribute("data-target") ||
        link.getAttribute("href") ||
        ""
      ).replace(/^#/, "");
      m = target.match(/^page_(.+)$/);
      if (m) return baseCodeFromToken(m[1]);
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
      let tok = fname.replace(/^line_ids_/, '');
      const m = tok.match(/^(.+)_(jardineria|limpieza)$/);
      if (m){
        const head = canon(m[1]);
        const SPLIT_CODES = new Set(['mano_obra','uniforme','epp','comunicacion_computo','perfil_medico','capacitacion']);
        return SPLIT_CODES.has(head) ? head : canon(tok);
      }
      return canon(tok);
    }catch(_e){ return null; }
  }
  function countListRows(root){
    if (!root) return 0;
    // Preferir filas OWL reales y contar SOLO registros guardados (con id)
    const rows = root.querySelectorAll('.o_data_row');
    if (rows.length){
      let cnt = 0;
      let debugInfo = [];
      rows.forEach((tr, idx)=>{
        // 1) Fila guardada (id numérico) cuenta inmediatamente
        const idRaw = tr.getAttribute('data-res-id') || tr.getAttribute('data-id') || tr.getAttribute('data-record-id') || tr.getAttribute('data-oe-id');
        const idNum = (idRaw == null) ? NaN : parseInt(String(idRaw).trim(), 10);
        if (!Number.isNaN(idNum) && idNum > 0) {
          cnt += 1;
          debugInfo.push(`fila${idx}:guardada(id=${idNum})`);
          return;
        }

        // 2) Fila no guardada: contar si product_id tiene valor CONFIRMADO
        const productCell = tr.querySelector('td[data-name="product_id"], td[name="product_id"]');
        if (!productCell) {
          debugInfo.push(`fila${idx}:sin_product_cell`);
          return;
        }

        // Buscar chips/tags/links del many2one confirmado
        if (productCell.querySelector('a[href], .o_m2o_chip, .o_m2o_tag, .o_m2o_value, .o_field_many2one_avatar')) {
          cnt += 1;
          debugInfo.push(`fila${idx}:chip`);
          return;
        }

        // Contar si el input M2O tiene algún valor visible (aunque siga enfocado)
        const inputEl = productCell.querySelector('input[role="combobox"], input.o-autocomplete--input');
        if (inputEl) {
          const inputVal = (inputEl.value || '').trim();
          if (inputVal) {
            cnt += 1;
            debugInfo.push(`fila${idx}:m2o_input_val_any`);
            return;
          }
        }

        // Como fallback, si el texto de la celda tiene contenido visible, contar
        const cellText = (productCell.textContent || '').trim();
        if (cellText) {
          cnt += 1;
          debugInfo.push(`fila${idx}:cell_text`);
          return;
        }

        debugInfo.push(`fila${idx}:vacía`);
        // No contar filas completamente vacías
      });

      if (DEBUG && cnt > 0) {
        // console.log(`[COUNT-ROWS] Total=${cnt}, detalles: ${debugInfo.join(', ')}`);
      }
      return cnt;
    }
    // Fallback conservador: sin .o_data_row, no asumir capturas temporales
    return 0;
  }
  function countPageRows(page){ return countListRows(page); }
  // Estricto: solo filas guardadas (id numérico > 0). No cuenta inputs con texto
  function countListRowsStrict(root){
    if (!root) return 0;
    const rows = root.querySelectorAll('.o_data_row');
    if (!rows.length) return 0;
    let cnt = 0;
    rows.forEach((tr)=>{
      const idRaw = tr.getAttribute('data-res-id') || tr.getAttribute('data-id') || tr.getAttribute('data-record-id') || tr.getAttribute('data-oe-id');
      const idNum = (idRaw == null) ? NaN : parseInt(String(idRaw).trim(), 10);
      if (!Number.isNaN(idNum) && idNum > 0) cnt += 1;
    });
    return cnt;
  }
  function countPageRowsStrict(page){ return countListRowsStrict(page); }
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
        // console.log(`[FIELD-ROOT] Found by [name="${fieldName}"] in formRoot`);
        return root;
      }

      root = formRoot.querySelector(`[data-name="${fieldName}"]`);
      if (root) {
        // console.log(`[FIELD-ROOT] Found by [data-name="${fieldName}"] in formRoot`);
        return root;
      }

      root = formRoot.querySelector(`.o_field_widget[name="${fieldName}"]`);
      if (root) {
        // console.log(`[FIELD-ROOT] Found by .o_field_widget[name="${fieldName}"] in formRoot`);
        return root;
      }

      root = formRoot.querySelector(`.o_field_one2many[name="${fieldName}"]`);
      if (root) {
        // console.log(`[FIELD-ROOT] Found by .o_field_one2many[name="${fieldName}"] in formRoot`);
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
            // console.log(`[FIELD-ROOT] Found by [name="${fieldName}"] in page ${i}`);
            return root;
          }

          root = page.querySelector(`[data-name="${fieldName}"]`);
          if (root) {
            // console.log(`[FIELD-ROOT] Found by [data-name="${fieldName}"] in page ${i}`);
            return root;
          }

          root = page.querySelector(`.o_field_widget[name="${fieldName}"]`);
          if (root) {
            // console.log(`[FIELD-ROOT] Found by .o_field_widget[name="${fieldName}"] in page ${i}`);
            return root;
          }

          root = page.querySelector(`.o_field_one2many[name="${fieldName}"]`);
          if (root) {
            // console.log(`[FIELD-ROOT] Found by .o_field_one2many[name="${fieldName}"] in page ${i}`);
            return root;
          }
        }
      }

      // Field not found - silenciar log para reducir ruido

      return null;
    }catch(_e){
      // console.error('[FIELD-ROOT] Exception:', _e);
      return null;
    }
  }
  function countRowsInField(formRoot, code){
    const srvType = readStrField(formRoot, 'current_service_type');
    const fname = listFieldNameForCode(code, srvType);
    const root = fieldRoot(formRoot, fname);
    if (!root) return null; // desconocido/no renderizado
    // Evitar trabajo en tabs no visibles
    try { if (root.offsetParent === null) return 0; } catch(_e) {}
    const result = countListRows(root);
    return result;
  }
  function countRowsInFieldStrict(formRoot, code){
    const srvType = readStrField(formRoot, 'current_service_type');
    const fname = listFieldNameForCode(code, srvType);
    const root = fieldRoot(formRoot, fname);
    if (!root) return 0;
    return countListRowsStrict(root);
  }

  // === Construye índice tab→code y code→link por etiqueta visible ===
  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    // Lista blanca de códigos válidos de rubro para ignorar placeholders/tab ajenos
    const ALLOWED = new Set([
      'mano_obra','uniforme','epp','epp_alturas','equipo_especial_limpieza','comunicacion_computo',
      'herramienta_menor_jardineria','material_limpieza','perfil_medico','maquinaria_limpieza',
      'maquinaria_jardineria','fertilizantes_tierra_lama','consumibles_jardineria','capacitacion'
    ]);
    for(const a of getLinks(nb)){
      // Permitir marcar explícitamente placeholders para ignorar
      if (a.hasAttribute && (a.hasAttribute('data-ccn-placeholder') || a.getAttribute('name') === 'page__placeholder')) {
        continue;
      }
      // 1) Preferir code por atributos del link (no depende del texto visible)
      let code = linkCodeByAttrs(a);
      // 2) Si no hay atributos, intenta por etiqueta visible (nombres exactos)
      if (!code){ code = codeFromLabel(a); }
      // Importante: NO usar pageRoot/page fallback aquí para evitar mapear al tab vecino por índice
      code = canon(code);
      if(code && ALLOWED.has(code)) byCode[code] = a;
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
// Flag para forzar ROJO en todos los tabs tras cambio de servicio (ej. cotización nueva)
let __forceAllRed = false;
// ID único para el registro actual (evita regenerar para registros nuevos)
let __currentRecordUniqueId = null;
// Hold temporal de VERDE durante commit de many2one (evita parpadeo rojo)
let __greenHold = {};
  // === Forzar ROJO para un rubro (hard clear: limpia clases, memoria y persistencia) ===
  function forceRed(formRoot, nb, code, last){
    try{
      code = canon(code);
      if (!code) return;
      // Si el backend/DOM indica ACK (ámbar), NO forzar rojo
      try {
        const ds = readStatesFromDataset(formRoot) || {};
        const dsVal = ds?.[code];
        if (dsVal === 2 || dsVal === '2') {
          const curNbAck = getNotebook() || nb;
          const byAck = indexByCode(curNbAck);
          const linkAck = byAck[code] || null;
          if (linkAck) { applyTab(linkAck, 2); if (last) last[code] = 2; }
          return;
        }
        // Revisión adicional: leer campo per-servicio del DOM
        const stypeChk = readStrField(formRoot, 'current_service_type');
        let fChk = `rubro_state_${code}`;
        if (stypeChk === 'jardineria') fChk = `rubro_state_${code}_jard`;
        else if (stypeChk === 'limpieza') fChk = `rubro_state_${code}_limp`;
        const vChk = readIntField(formRoot, fChk);
        if (vChk === 2) {
          const curNbAck2 = getNotebook() || nb;
          const byAck2 = indexByCode(curNbAck2);
          const linkAck2 = byAck2[code] || null;
          if (linkAck2) { applyTab(linkAck2, 2); if (last) last[code] = 2; }
          return;
        }
      } catch(_e) {}
      // Reindex para obtener el nodo actual del tab
      const curNb = getNotebook() || nb;
      const byNow = indexByCode(curNb);
      const link = byNow[code] || null;
      const li = link && link.closest ? link.closest('li') : null;
      // Limpiar clases residuales
      try { [link, li].forEach((el)=>{ if (el) el.classList.remove('ccn-status-filled','ccn-status-ack','ccn-status-empty'); }); } catch(_e) {}
      // Limpiar memorias efímeras; no persistir 0 para evitar arrastre entre servicios
      delete __filledMemo[code];
      // Actualizar DOM de rubro_state_* per-servicio a 0
      try {
        const stype = readStrField(formRoot, 'current_service_type');
        let fieldName = `rubro_state_${code}`;
        if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
        else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
        writeIntField(formRoot, fieldName, 0);
      } catch(_e) {}
      // Actualizar dataset a 0
      try {
        const holder = formRoot.closest('.o_form_view') || formRoot;
        const ds = holder.dataset.ccnStates;
        if (ds){ const obj = JSON.parse(ds); obj[code] = 0; holder.dataset.ccnStates = JSON.stringify(obj); }
      } catch(_e) {}
      // Aplicar rojo inmediato y actualizar cache last si se pasó
      if (link) applyTab(link, 0);
      if (last) last[code] = 0;
      // Repaint final tras el commit visual
      setTimeout(()=>{ try{ const _nb = getNotebook() || nb; const _by = indexByCode(_nb); paintFromStates(formRoot, _nb, _by, last || {}); }catch(_e){} }, 200);
    }catch(_e){}
  }
  // Reset duro de contexto: limpiar memorias de verde persistente y colores aplicados
  function hardContextReset(formRoot, nb){
    try{
      // NO resetear __filledMemo directamente, se maneja en ensureCtx()
      __persistStates = {};
      __persistStatesMap = {};
      __ackOverrides = {};
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
      const persistedStates = {}; // deprecado: no usar estados persistidos
      const persistedAcks = (recordId === 'new') ? {} : (persisted.acks || {});
      if (!__filledMemoMap[key]) __filledMemoMap[key] = {};
      if (!__ackOverridesMap[key]) __ackOverridesMap[key] = { ...persistedAcks };
      if (!__persistStatesMap[key]) __persistStatesMap[key] = { ...persistedStates };
      // Forzar estado fresco solo para memorias efímeras; conservar overrides/persistidos por contexto
      if (__forceFresh) {
        __filledMemoMap[key] = {};
      }
      __filledMemo = __filledMemoMap[key];
      __ackOverrides = __ackOverridesMap[key];
      __persistStates = __persistStatesMap[key];
      // Cargar memorias verdes desde sessionStorage (marcadas desde catálogo)
      try {
        const quoteId = readIntField(formRoot, 'id') || 'new';
        const siteId = readIntField(formRoot, 'current_site_id') || '';
        const serviceType = readStrField(formRoot, 'current_service_type') || '';
        const ctxKey = `${quoteId}|${siteId}|${serviceType}`;
        // Buscar todas las claves ccnFilledMemo para este contexto
        for (let i = 0; i < sessionStorage.length; i++) {
          const storageKey = sessionStorage.key(i);
          if (storageKey && storageKey.startsWith(`ccnFilledMemo:${ctxKey}:`)) {
            const code = storageKey.split(':').pop();
            if (code && sessionStorage.getItem(storageKey) === 'true') {
              __filledMemo[code] = true;
            }
          }
        }
      } catch(_e) {}
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
  function savePersist(formRoot, _states, acks){
    // solo persistir overrides de ACK; no estados de color
    try{ sessionStorage.setItem(persistKey(formRoot), JSON.stringify({states: {}, acks: acks||{}})); }catch(_e){}
  }

  // === Pintado (prioriza conteo inmediato; sincroniza rubro_state_* en DOM para persistir) ===
  function paintFromStates(formRoot, nb, byCode, last){
    // Usar el índice inicial; evitar reindex en cada pintado
    const map = byCode;
    ensureCtx(formRoot);
    // Sin ventana de baseline rojo: repintar siempre con estados actuales/memos
    // Forzar ROJO total una vez (p. ej., tras cambiar servicio en una cotización nueva)
    if (__forceAllRed) {
      try { getLinks(nb).forEach((a)=> clearTab(a)); } catch(_e){}
      for (const [code, link] of Object.entries(map)) {
        try { applyTab(link, 0); if (last) last[code] = 0; } catch(_e){}
      }
      __forceAllRed = false;
      return true;
    }
    // Si el contexto acaba de cambiar (servicio/sitio), arrancar desde estado limpio
    if (__ctxChanged) {
      try { getLinks(nb).forEach((a)=> clearTab(a)); } catch(_e){}
      __ctxChanged = false;
    }
    // Preferir SIEMPRE el dataset per-servicio publicado por el FormController; si no hay, usar DOM
    let dsStates = readStatesFromDataset(formRoot) || {};
    if (!Object.keys(dsStates).length) {
      dsStates = fallbackStatesFromDOM(formRoot, nb) || {};
    }
    // Counts del backend (si existen) solo para mostrar contadores, no para colores
    let dsCounts = readCountsFromDataset(formRoot) || {};
    // Forzar estados frescos en cambio de contexto
    if (__forceFresh) { dsStates = fallbackStatesFromDOM(formRoot, nb) || {}; dsCounts = {}; __forceFresh = false; }
    // Salvaguarda SOLO durante ventana de cambio de servicio: si TODOS los estados son 0, no hay overrides
    // ni filas guardadas en este servicio, aplicar baseline ROJO (evita arrastre visual entre servicios)
    try {
      const inSwitchWindow = false; // deshabilitado: repintado inmediato
      const codesAll = Object.keys(byCode || {});
      const allZero = Object.keys(dsStates).length && Object.values(dsStates).every(v => (parseInt(v || 0, 10) === 0));
      const hasOverride = !!__ackOverrides && Object.keys(__ackOverrides).some(k => !!__ackOverrides[k]);
      let anySaved = false;
      for (const c of codesAll) { if (countRowsInFieldStrict(formRoot, c) > 0) { anySaved = true; break; } }
      // Si hay edición en curso en el tab activo (aunque no haya guardados), no aplicar baseline
      let activeAny = 0;
      try { const ap = nb && nb.querySelector ? nb.querySelector('.tab-pane.active') : null; activeAny = ap ? countPageRows(ap) : 0; } catch(_e){}
      if (inSwitchWindow && allZero && !hasOverride && !anySaved && activeAny === 0) {
        try { getLinks(nb).forEach((a)=> clearTab(a)); } catch(_e){}
        for (const [code, link] of Object.entries(byCode)) {
          try { applyTab(link, 0); if (last) last[code] = 0; } catch(_e){}
        }
        if (__dbgEnabled()) __dbg('[CCN-DBG] baseline red applied (allZero,noOverride,noSaved)');
        return true;
      }
    } catch(_e) {}
    let changed = false;
    const activeCode = __activeCodeOptimistic; // snapshot y limpiar al final
    const hasStates = !!dsStates && Object.keys(dsStates).length > 0;

    // Si aún no hay estados (ni fallback), baseline rojo y no considerar overrides/persistidos
    if (!dsStates || !Object.keys(dsStates).length) {
      for (const [code, link] of Object.entries(byCode)) {
        const liNode = link.closest ? link.closest('li') : null;
        const desiredClass = clsFor(0);
        const missing = !link.classList.contains(desiredClass) || (liNode && !liNode.classList.contains(desiredClass));
        if (missing) {
          try { applyTab(link, 0); if (last) last[code] = 0; changed = true; } catch(_e){}
        }
      }
      return changed;
    }

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
      let stateValue = dsStates?.[code]; // Leer estado del backend (mutable)
      const stateValueOriginal = stateValue; // snapshot para decisiones (evitar pisar ACK)
      // Conteos desde el widget del campo (solo usamos para el tab ACTIVO)
      const isNewRecord = !readIntField(formRoot, 'id');
      const fieldCountRaw = (code === activeTabCode) ? countRowsInField(formRoot, code) : 0;
      const fieldCount = (fieldCountRaw == null) ? 0 : fieldCountRaw;

      // Hold temporal: si hay hold vigente, tratar como si hubiera contenido
      const nowTs = Date.now();
      const holdActive = (__greenHold[code] && __greenHold[code] > nowTs) ? true : false;
      if (__greenHold[code] && __greenHold[code] <= nowTs) { delete __greenHold[code]; }

      // Si este es el tab activo, usar el conteo que ya hicimos
      if (code === activeTabCode && activeRowCount !== null) {
        rowCount = activeRowCount;
        // IMPORTANTE: NO actualizar memoria aquí - solo el backend puede confirmar verde
        // La memoria se limpia si el tab está vacío Y el backend dice 0
        if (rowCount === 0 && stateValue !== 1) {
          // Tab activo sin filas reales y backend no confirma verde: limpiar memoria
          delete __filledMemo[code];
          // También limpiar del mapa
          if (__ctxKey && __filledMemoMap[__ctxKey]) {
            delete __filledMemoMap[__ctxKey][code];
          }
        }
        // Marcar memoria verde si hay contenido (filas visibles) o backend confirma
        if ((rowCount > 0) || (fieldCount > 0) || stateValue === 1) {
          __filledMemo[code] = true;
          // Guardar en el mapa para que persista entre cambios de tab
          if (__ctxKey && __filledMemoMap[__ctxKey]) {
            __filledMemoMap[__ctxKey][code] = true;
          }
          // Limpiar sessionStorage temporal si el backend confirma verde
          if (stateValue === 1) {
            try {
              const quoteId = readIntField(formRoot, 'id') || 'new';
              const siteId = readIntField(formRoot, 'current_site_id') || '';
              const serviceType = readStrField(formRoot, 'current_service_type') || '';
              const ctxKey = `${quoteId}|${siteId}|${serviceType}`;
              sessionStorage.removeItem(`ccnFilledMemo:${ctxKey}:${code}`);
            } catch(_e) {}
          }
        }
      }

      // FORZAR ROJO INMEDIATO en el TAB ACTIVO si quedó vacío tras eliminar
      // (prioriza conteos locales sobre backend transitorio)
      if (code === activeTabCode) {
        const noRows = (fieldCount === 0) && (rowCount === null || rowCount === 0);
        // No forzar rojo si el backend/DOM indica ACK (ámbar)
        if (noRows && !__ackOverrides[code] && stateValueOriginal !== 2) {
          // limpiar memorias optimistas y marcar backend local a 0
          delete __filledMemo[code];
          delete __greenHold[code];
          stateValue = 0;
          try { __persistStates[code] = 0; } catch(_e) {}
          // Reflejar inmediatamente en DOM/dataset para que ningún repintado revierta a verde
          try{
            const stype = readStrField(formRoot, 'current_service_type');
            let fieldName = `rubro_state_${code}`;
            if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
            else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
            writeIntField(formRoot, fieldName, 0);
          }catch(_e){}
          try{
            const holder = formRoot.closest('.o_form_view') || formRoot;
            const dsRaw = holder.dataset.ccnStates || '{}';
            const obj = JSON.parse(dsRaw);
            obj[code] = 0;
            holder.dataset.ccnStates = JSON.stringify(obj);
          }catch(_e){}
        }
      }

      // No refrescar memoria desde backend: solo actualizar memoria cuando el tab activo
      // muestra conteo real (rowCount); así el verde persiste al cambiar de tab

      // Determinar estado normalizado (sNorm)
      // PRIORIDAD: VERDE gana a ÁMBAR si hay contenido real o backend=1.
      // Luego: ÁMBAR (override explícito o backend=2) > hold/memo > persistido > vacío.
      let debugSource = '';
      const countForCode = (()=>{ try{ return parseInt(dsCounts?.[code] || 0, 10) || 0; }catch(_e){ return 0; } })();
      const hasContent = (stateValue === 1)
                      || (countForCode > 0) // conteos publicados por backend (por servicio)
                      || (code === activeTabCode && ((fieldCount > 0) || (rowCount !== null && rowCount > 0)));
      if (hasContent) {
        // Hay contenido real o backend confirma: forzar verde y limpiar override
        sNorm = 1;
        debugSource = stateValue === 1 ? 'backend(1)' : (fieldCount > 0 ? `fieldCount(${fieldCount})` : `rowCount(${rowCount})`);
        if (__ackOverrides[code]) { try { delete __ackOverrides[code]; } catch(_e){} }
      } else if (__ackOverrides[code]) {
        // Override "No Aplica" (siempre aplica, incluso en registros nuevos)
        sNorm = 2;
        debugSource = 'ackOverride';
      } else if (stateValue === 2) {
        // Backend indica ÁMBAR (aplica tanto en registros nuevos como existentes)
        sNorm = 2;
        debugSource = 'backend(2)';
      } else if (holdActive) {
        // Sostener verde mientras OWL confirma el many2one (solo si no hay info del backend)
        sNorm = 1;
        debugSource = 'holdGreen';
      } else if (__filledMemo[code]) {
        // Memoria de verde (solo si no hay info del backend)
        sNorm = 1;
        debugSource = 'filledMemo';
      } else if (rowCount !== null && rowCount === 0) {
        // Tab activo vacío (ninguna memoria positiva)
        sNorm = 0;
        debugSource = `rowCount(0)`;
      } else {
        // Sin información: vacío
        sNorm = 0;
        debugSource = 'default(empty)';
      }

      // Log opcional
      if (false) {
        // eslint-disable-next-line no-console
        console.log(`[CCN] ${code}: ${debugSource} → ${sNorm === 1 ? 'VERDE' : sNorm === 2 ? 'ÁMBAR' : 'ROJO'}`);
      }

      // No persistir decisión; confiar en DOM/ACK/conteos para evitar estados fantasma

      // Limpiar override si ahora está verde (idempotente)
      if (sNorm === 1 && __ackOverrides[code] != null) {
        delete __ackOverrides[code];
      }

      // Log de decisión (debug)
      if (DEBUG && code === activeTabCode) {
        // eslint-disable-next-line no-console
        // console.log(`[CCN-PAINT] ${code} (ACTIVO): rowCount=${rowCount}, fieldCount=${fieldCount}, memo=${!!__filledMemo[code]}, state=${stateValue}, persist=${__persistStates[code]} → sNorm=${sNorm} (${debugSource})`);
      }
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
          // console.log(`✅ ${code}: ${rowCount} filas → VERDE`);
        }
      }
    }
    // Guardar persistencia por contexto (estados + overrides de ámbar)
    try{ __ackOverridesMap[__ctxKey] = { ...__ackOverrides }; }catch(_e){}
    // Limpiar optimismo: solo aplica a un ciclo de pintado
    __activeCodeOptimistic = null;
    __ctxChanged = false;
    return changed;
  }

  // Repaint estricto desde dataset per-servicio (ignora memos/actividad)
  function repaintStrictFromDataset(formRoot, nb){
    try{
      const dsStates = readStatesFromDataset(formRoot) || {};
      const dsCounts = readCountsFromDataset(formRoot) || {};
      const by = indexByCode(nb);
      for (const [code, link] of Object.entries(by)){
        let st = 0;
        const v = dsStates?.[code];
        if (v === 1 || v === '1') st = 1;
        else if (v === 2 || v === '2') st = 2;
        else {
          const c = parseInt(dsCounts?.[code] || 0, 10) || 0;
          st = c > 0 ? 1 : 0;
        }
        try { applyTab(link, st); } catch(_e){}
      }
      return true;
    }catch(_e){ return false; }
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
        try{
          const curNb = getNotebook() || nb;
          const curBy = indexByCode(curNb);
          paintFromStates(formRoot, curNb, curBy, last);
        }catch(_e){}
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
              // Publicar estados tras cambios en listas (una sola vez, trailing)
              setTimeout(()=>{ try{ window.__ccnPublishLastStates && window.__ccnPublishLastStates(); }catch(_e){} }, 180);
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
            // Re-pintar inmediatamente usando los rubro_state_* del DOM (fallback)
            // y publicar estados pronto para actualizar datasets por servicio.
            schedule();
            try { setTimeout(() => { try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e) {} }, 10); } catch(_e) {}
            try { setTimeout(() => schedule(), 20); } catch(_e) {}
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

    // Observar únicamente el tab activo del notebook, reduciendo ruido
    try{
      const activePane = nb && nb.querySelector ? (nb.querySelector('.tab-pane.active') || nb) : formRoot;
      mo.observe(activePane, {
        childList: true,
        subtree: true,
        attributes: true,
        // Solo cambios de datos; evitar 'class'. Incluir 'value' para selects.
        attributeFilter: ["data-value", "value"],
      });
    }catch(_e){
      // Fallback conservador
      mo.observe(formRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-value", "value"] });
    }

    // OBSERVAR también el contenedor oculto de estados (.o_ccn_rubro_states)
    // para repintar cuando el backend (compute) actualiza los rubro_state_*
    try{
      const rs = formRoot.querySelector('.o_ccn_rubro_states');
      if (rs) {
        const moStates = new MutationObserver(schedule);
        moStates.observe(rs, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-value", "value"] });
      }
    }catch(_e){}

    // Exponer para debug opcional
    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} },
      stats(){
        const out = {};
        const dsS = readStatesFromDataset(formRoot);
        const dsC = readCountsFromDataset(formRoot);
        const curNb = getNotebook() || nb;
        const curBy = indexByCode(curNb);
        for(const [code, link] of Object.entries(curBy)){
          const page = pageRootForLink(curNb, link);
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
      if (!formRoot || !nb) return false;
      return cb(formRoot, nb);
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

      // Detectar cambios de registro/contexto (soporta registros nuevos con UID temporal)
      let lastCtxKey = currentCtxKey(formRoot);
      const checkRecordChange = () => {
        const ctxKey = currentCtxKey(formRoot);
        if (ctxKey !== lastCtxKey) {
          // console.log(`[CCN] ⚠️ RESET COMPLETO - Ctx changed from ${lastCtxKey} to ${ctxKey}`);
          // Reset completo cuando cambia el contexto (incluye new→new)
          // No eliminar persistencias del contexto anterior: permite volver y restaurar colores
          lastCtxKey = ctxKey;
          __currentRecordUniqueId = null;
          __ctxKey = null;
          // NO crear nuevo objeto, se reasignará en ensureCtx()
          // Preservar memorias por contexto (no resetear __filledMemoMap)
          __forceFresh = true;
          for (const k in last) delete last[k];
          try {
            const curNb = getNotebook() || nb;
            const curBy = indexByCode(curNb);
            getLinks(curNb).forEach((a)=> clearTab(a));
            paintFromStates(formRoot, curNb, curBy, last);
          } catch(_e){}
        }
      };

      // Pintado inicial (sin clics, inmediato)
      try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){}
      // Observa cambios de los campos de estado
      watchStates(formRoot, nb, byCode, last);
      // Reintento breve tras carga por si el DOM/render llega tarde
      setTimeout(()=>{
        checkRecordChange();
        try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){}
      }, 80);
      // Repintar específico al cambiar sitio/servicio
      const onQuickRepaint = (ev)=>{
        const name = ev?.target?.getAttribute?.('name') || ev?.target?.getAttribute?.('data-name') || '';
        if (name === 'current_service_type' || name === 'current_site_id'){
          try{
            // LIMPIAR sessionStorage del nuevo contexto (solo estados publicados, no memos)
            try {
              const newKey = currentCtxKey(formRoot);
              sessionStorage.removeItem(`ccnTabs:${newKey}`);
              // NO limpiar __ackOverridesMap[newKey]; preserva overrides por contexto (Jard/Limp)
            } catch(_e) {}

            // Limpiar datasets publicados por servicio y genérico
            try {
              const holder = formRoot.closest('.o_form_view') || formRoot;
              if (holder) {
                holder.removeAttribute('data-ccn-states-jardineria');
                holder.removeAttribute('data-ccn-states-limpieza');
                holder.removeAttribute('data-ccn-counts-jardineria');
                holder.removeAttribute('data-ccn-counts-limpieza');
                try { delete holder.dataset.ccnStates; } catch(_e) {}
                try { delete holder.dataset.ccnCounts; } catch(_e) {}
              }
            } catch(_e) {}

            // Reset mínimo del contexto (sin baseline rojo)
            __ctxKey = null;
            // NO crear nuevo objeto, se reasignará en ensureCtx()
            __activeCodeOptimistic = null;
            __ctxChanged = true;
            __forceFresh = true;
            // CRÍTICO: Limpiar el objeto 'last' para forzar re-pintado completo
            for (const k in last) delete last[k];
            try {
              const curNb = getNotebook() || nb;
              hardContextReset(formRoot, curNb);
              const curBy = indexByCode(curNb);
              paintFromStates(formRoot, curNb, curBy, last);
              // Re-enganchar observadores en el nuevo DOM (crítico tras re-render)
              try { watchStates(formRoot, curNb, curBy, last); } catch(_e) {}
              // Debug inmediato al cambiar servicio/sitio
              try { if (__dbgEnabled()) __dumpStates(formRoot); } catch(_e){}
            } catch(_e){}
          }catch(_e){}
          // Publicar pronto y repintar de inmediato con reintentos breves
          setTimeout(()=>{ try{ window.__ccnPublishLastStates && window.__ccnPublishLastStates(); }catch(_e){} }, 10);
          setTimeout(()=>{ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} }, 20);
          setTimeout(()=>{ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} }, 60);
          setTimeout(()=>{ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} }, 180);
          setTimeout(()=>{ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} }, 350);
          setTimeout(()=>{ try{ const curNb = getNotebook() || nb; repaintStrictFromDataset(formRoot, curNb); }catch(_e){} }, 500);
        }
      };
      document.body.addEventListener('change', onQuickRepaint, true);
      // Interacciones dentro de listas (click o edición por teclado) → recalcular
      document.body.addEventListener('click', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_notebook .o_list_renderer, .o_notebook .o_list_view, .o_notebook .o_list_table')){
          try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){}
        }
      }, true);
      document.body.addEventListener('keydown', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_notebook .o_list_renderer, .o_notebook .o_list_view, .o_notebook .o_list_table')){
          // Teclas típicas de edición/navegación en listas
          const k = ev.key || '';
          if (k) {
            try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){}
          }
        }
      }, true);

      // Confirmación explícita del many2one (selección del dropdown): activar HOLD y repintar
      document.body.addEventListener('mousedown', (ev)=>{
        const item = ev.target.closest && ev.target.closest('.o-autocomplete--dropdown-item, .o-autocomplete--dropdown-item-highlighted');
        if (!item) return;
        try{
          const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
          let code = activeLink ? (linkCodeByAttrs(activeLink) || codeFromLabel(activeLink)) : null;
          code = canon(code);
          if (code) {
            __greenHold[code] = Date.now() + 1200; // hold extendido para evitar parpadeo
            __filledMemo[code] = true; // feedback inmediato conservador
            // Guardar en el mapa para que persista entre cambios de tab
            if (__ctxKey && __filledMemoMap[__ctxKey]) {
              __filledMemoMap[__ctxKey][code] = true;
            }
            // Aplicar VERDE inmediato en el tab activo
            try {
              if (activeLink) {
                applyTab(activeLink, 1);
                last[code] = 1;
                // También actualizar rubro_state_* en DOM y datasets (genérico y per-servicio)
                const stype = readStrField(formRoot, 'current_service_type');
                let fieldName = `rubro_state_${code}`;
                if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
                else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
                try{ writeIntField(formRoot, fieldName, 1); }catch(_e){}
                try{
                  const holder = formRoot.closest('.o_form_view') || formRoot;
                  const dsRaw = holder.dataset.ccnStates || '{}';
                  const obj = JSON.parse(dsRaw);
                  obj[code] = 1;
                  holder.dataset.ccnStates = JSON.stringify(obj);
                }catch(_e){}
                try{
                  const holder = formRoot.closest('.o_form_view') || formRoot;
                  const srv = readStrField(formRoot, 'current_service_type') || '';
                  if (srv) {
                    const key = `data-ccn-states-${srv}`;
                    let raw = holder.getAttribute(key) || '{}';
                    const pobj = JSON.parse(raw);
                    pobj[code] = 1;
                    holder.setAttribute(key, JSON.stringify(pobj));
                  }
                }catch(_e){}
              }
            } catch(_e) {}
          }
        }catch(_e){}
        // Re-pintar después de que OWL aplique la selección y dispare change
        // Publicar y repintar una sola vez
        setTimeout(()=>{
          try{ window.__ccnPublishLastStates && window.__ccnPublishLastStates(); }catch(_e){}
          try{ const __nb = getNotebook() || nb; const __by = indexByCode(__nb); paintFromStates(formRoot, __nb, __by, last); }catch(_e){}
        }, 200);
      }, true);
      // Confirmación via Enter en el input del many2one
      document.body.addEventListener('keydown', (ev)=>{
        const key = ev.key || '';
        const inp = ev.target.closest && ev.target.closest('td[data-name="product_id"], td[name="product_id"], [name="product_id"], [data-name="product_id"]');
        if (!inp) return;

        const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
        let code = activeLink ? (linkCodeByAttrs(activeLink) || codeFromLabel(activeLink)) : null;
        code = canon(code);
        if (!code) return;

        if (key === 'Enter') {
          try{
            __greenHold[code] = Date.now() + 1200;
            __filledMemo[code] = true;
            // Guardar en el mapa para que persista entre cambios de tab
            if (__ctxKey && __filledMemoMap[__ctxKey]) {
              __filledMemoMap[__ctxKey][code] = true;
            }
          }catch(_e){}
          // Esperar a que Odoo procese y publicar/repintar una sola vez
          setTimeout(()=>{
            try{ window.__ccnPublishLastStates && window.__ccnPublishLastStates(); }catch(_e){}
            try{ const __nb = getNotebook() || nb; const __by = indexByCode(__nb); paintFromStates(formRoot, __nb, __by, last); }catch(_e){}
          }, 220);
          // Actualizar DOM/dataset inmediatamente para consolidar VERDE
          try{
            const stype = readStrField(formRoot, 'current_service_type');
            let fieldName = `rubro_state_${code}`;
            if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
            else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
            writeIntField(formRoot, fieldName, 1);
          }catch(_e){}
          try{
            const holder = formRoot.closest('.o_form_view') || formRoot;
            const dsRaw = holder.dataset.ccnStates || '{}';
            const obj = JSON.parse(dsRaw);
            obj[code] = 1;
            holder.dataset.ccnStates = JSON.stringify(obj);
          }catch(_e){}
          try{
            const holder = formRoot.closest('.o_form_view') || formRoot;
            const srv = readStrField(formRoot, 'current_service_type') || '';
            if (srv) {
              const key = `data-ccn-states-${srv}`;
              let raw = holder.getAttribute(key) || '{}';
              const pobj = JSON.parse(raw);
              pobj[code] = 1;
              holder.setAttribute(key, JSON.stringify(pobj));
            }
          }catch(_e){}
        } else if (key === 'Escape') {
          try{
            // ESC cancela edición: repintar para verificar estado real
            // (silenciar log en producción)
            delete __greenHold[code];
            setTimeout(()=>{ try{ const __nb = getNotebook() || nb; const __by = indexByCode(__nb); paintFromStates(formRoot, __nb, __by, last); }catch(_e){} }, 100);
          }catch(_e){}
        }
      }, true);
      // Pintado inmediato al pulsar "Agregar línea" en cualquier lista del notebook
      document.body.addEventListener('click', (ev)=>{
        const addBtn = ev.target.closest && ev.target.closest('.o_list_button_add, button.o_list_button_add, .o_list_record_add, .o_list_view_add, .o_list_table_add, .o_field_x2many_list_row_add a');
        if (!addBtn) return;
        try{
          const page = addBtn.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]');
          const curNb = getNotebook() || nb;
          const link = linkForPage(curNb, page);
          // Prioritar deducir el code DESDE LA PÁGINA (más confiable)
          let code = codeFromPage(page) || (link ? linkCodeByAttrs(link) : null);
          if (!code && link) code = codeFromLabel(link);
          code = canon(code);
          // Publicar estados poco después para empujar recomputos y refrescos de dataset (único)
          setTimeout(()=>{
            try{ window.__ccnPublishLastStates && window.__ccnPublishLastStates(); }catch(_e){}
            try{ const __nb = getNotebook() || nb; const __by = indexByCode(__nb); paintFromStates(formRoot, __nb, __by, last); }catch(_e){}
          }, 180);
        }catch(_e){}
      }, true);
      // Reforzar en interacciones típicas de tabs/listas
      // Quitar repintado en click; usar únicamente eventos de Bootstrap (shown/hidden)
      document.body.addEventListener('change', (ev)=>{
        if (ev.target.closest && ev.target.closest('.o_form_view')){
          checkRecordChange();

          // Detectar cambio en product_id: usar conteo REAL para decidir
          try{
            const holder = ev.target.closest('td[data-name="product_id"], td[name="product_id"], [name="product_id"], [data-name="product_id"]');
            if (holder){
              let code = codeFromCell(holder) || codeFromPage(holder.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]'));
              code = canon(code);
              if (code){
                // Pintado inmediato optimista al confirmar product_id
                try {
                  const link = indexByCode(nb)[code] || null;
                  if (link) {
                    applyTab(link, 1);
                    last[code] = 1;
                    __filledMemo[code] = true;
                    // Guardar en el mapa para que persista entre cambios de tab
                    if (__ctxKey && __filledMemoMap[__ctxKey]) {
                      __filledMemoMap[__ctxKey][code] = true;
                    }
                  }
                } catch(_e) {}
                // Esperar a que Odoo guarde el cambio Y el backend recalcule estados
                setTimeout(()=>{
                  try{
                    // Forzar recalculo en el backend
                    window.__ccnPublishLastStates && window.__ccnPublishLastStates();
                  }catch(_e){}
                }, 200);

                // Esperar más para que el backend publique los nuevos estados
                setTimeout(()=>{
                  try{
                    const activePage = (getNotebook() || nb).querySelector('.tab-pane.active');
                    const realCount = activePage ? countPageRows(activePage) : 0;
                    const fieldCount = countRowsInField(formRoot, code) || 0;

                    // if (DEBUG) { /* eslint-disable-next-line no-console */ console.log(`[CCN-CHANGE] ${code}: realCount=${realCount}, fieldCount=${fieldCount}`); }

                    if (realCount === 0 && fieldCount === 0 && !__filledMemo[code]) {
                      // if (DEBUG) { /* eslint-disable-next-line no-console */ console.log(`[CCN-CHANGE] ❌ forceRed ${code} (sin líneas guardadas)`); }
                      forceRed(formRoot, getNotebook() || nb, code, last);
                    } else if (realCount > 0) {
                      __filledMemo[code] = true;
                      // Guardar en el mapa para que persista entre cambios de tab
                      if (__ctxKey && __filledMemoMap[__ctxKey]) {
                        __filledMemoMap[__ctxKey][code] = true;
                      }
                      { const __nb2 = getNotebook() || nb; const __by2 = indexByCode(__nb2); paintFromStates(formRoot, __nb2, __by2, last); }
                    }
                  }catch(_e){ if (DEBUG) console.error('[CCN-CHANGE] Error interno:', _e); }
                }, 500);
              }
            } else {
              // Cambio en otro campo (no product_id): publicar y repintar
              try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e){}
              setTimeout(()=>{ try{ const __nb3 = getNotebook() || nb; const __by3 = indexByCode(__nb3); paintFromStates(formRoot, __nb3, __by3, last); }catch(_e){} }, 200);
            }
          }catch(_e){ if (DEBUG) console.error('[CCN-CHANGE] Error:', _e);}
        }
      }, true);
      // REMOVIDO: optimisticPaint - causaba tabs verdes mientras se escribe
      // Evento input deshabilitado para evitar verde prematuro durante la edición
      // El evento change y MutationObserver manejan la detección de cambios reales
      // Pintado optimista al marcar "No Aplica": aplicar ámbar inmediatamente
      document.body.addEventListener('click', (ev)=>{
        const btn = ev.target.closest && ev.target.closest('button[name="action_mark_rubro_empty"]');
        if (!btn) return;
        try{
          const page = btn.closest('.o_notebook .tab-pane, .o_notebook [id^="page_"]');
          let code = codeFromPage(page);
          code = canon(code);
          const curNb2 = getNotebook() || nb;
          let link = code ? (indexByCode(curNb2)[code] || null) : null;
          // Fallback: buscar el <a> por la propia página
          if (!link) link = linkForPage(curNb2, page);
          if (code && link){
            // console.log(`[CCN] 🟡 Marcando "${code}" como No Aplica (ámbar)`);

            // IMPORTANTE: Actualizar override ANTES de pintar
            __ackOverrides[code] = true;

            // Persistir en el mapa por contexto
            const ctx = currentCtxKey(formRoot);
            if (!__ackOverridesMap[ctx]) __ackOverridesMap[ctx] = {};
            __ackOverridesMap[ctx][code] = true;

            // Aplicar color inmediatamente
            applyTab(link, 2);
            last[code] = 2;

            // Escribir en el campo per-servicio correcto
            const stype = readStrField(formRoot, 'current_service_type');
            let fieldName = `rubro_state_${code}`;
            if (stype === 'jardineria') fieldName = `rubro_state_${code}_jard`;
            else if (stype === 'limpieza') fieldName = `rubro_state_${code}_limp`;
            try{ writeIntField(formRoot, fieldName, 2); }catch(_e){}

            // Actualizar el dataset para que pintado lo use (genérico y per-servicio)
            try{
              const holder = formRoot.closest('.o_form_view') || formRoot;
              // Genérico
              try {
                let ds = holder.dataset.ccnStates;
                if (ds) {
                  const obj = JSON.parse(ds);
                  obj[code] = 2;
                  holder.dataset.ccnStates = JSON.stringify(obj);
                }
              } catch(_e) {}
              // Per-servicio
              const srv = readStrField(formRoot, 'current_service_type') || '';
              if (srv) {
                try {
                  const key = `data-ccn-states-${srv}`;
                  let raw = holder.getAttribute(key) || '{}';
                  const obj = JSON.parse(raw);
                  obj[code] = 2;
                  holder.setAttribute(key, JSON.stringify(obj));
                } catch(_e) {}
              }
            }catch(_e){}

            // Replicar la publicación para sincronizar servicios
            try { window.__ccnPublishLastStates && window.__ccnPublishLastStates(); } catch(_e){}

            // NO repintar aquí - el color ya está aplicado con applyTab
            // if (DEBUG) { /* eslint-disable-next-line no-console */ console.log(`[CCN] ✅ "${code}" marcado como ámbar - override guardado`); }
          }
        }catch(_e){ if (DEBUG) console.error('[CCN] Error al marcar No Aplica:', _e); }
      }, true);
      // Blur en campos product_id: verificar conteo REAL de filas válidas
      document.body.addEventListener('blur', (ev)=>{
        const inp = ev.target.closest && ev.target.closest('input[role="combobox"], input.o-autocomplete--input');
        if (!inp) return;
        const cell = inp.closest('td[data-name="product_id"], td[name="product_id"]');
        if (!cell) return;

        try{
          const activeLink = nb.querySelector('.nav-tabs .nav-link.active');
          let code = activeLink ? (linkCodeByAttrs(activeLink) || codeFromLabel(activeLink)) : null;
          code = canon(code);
          if (!code) return;

          // if (false) console.log(`[CCN-BLUR] Blur detectado en input de ${code}, verificando estado...`);

          // Esperar un poco para que Odoo procese y cierre el dropdown
          setTimeout(()=>{
            try{
              // Contar filas REALES en la página activa (sin input enfocado)
              const activePage = nb.querySelector('.tab-pane.active');
              const realCount = activePage ? countPageRows(activePage) : 0;
              const fieldCount = countRowsInField(formRoot, code) || 0;

              // if (false) console.log(`[CCN-BLUR] ${code}: realCount=${realCount}, fieldCount=${fieldCount}, memo=${!!__filledMemo[code]}`);

              // Solo limpiar memoria si NO hay filas guardadas Y no tenemos memo verde
              // NO marcar memoria verde - solo el backend puede hacerlo
              if (realCount === 0 && fieldCount === 0 && !__filledMemo[code]) {
                // if (false) console.log(`[CCN-BLUR] ❌ Limpiando memoria de ${code} (sin líneas guardadas)`);
                delete __filledMemo[code];
                // Limpiar hold también si existe
                delete __greenHold[code];
              }

              // Forzar actualización del backend y repintar (una sola vez)
              try{ window.__ccnPublishLastStates && window.__ccnPublishLastStates(); }catch(_e){}
              setTimeout(()=>{ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} }, 120);
          }catch(_e){ if (DEBUG) console.error('[CCN-BLUR] Error:', _e); }
          }, 150);
        }catch(_e){}
      }, true);

      // Eventos de Bootstrap para tabs (si están presentes)
      document.body.addEventListener('shown.bs.tab', ()=>{
        try{
          // Al mostrar un tab nuevo, forzar publicación de estados y repintar con delay
          window.__ccnPublishLastStates && window.__ccnPublishLastStates();
          setTimeout(()=>{ try{ const curNb = getNotebook() || nb; const curBy = indexByCode(curNb); paintFromStates(formRoot, curNb, curBy, last); }catch(_e){} }, 100);
        }catch(_e){}
      }, true);
      document.body.addEventListener('hidden.bs.tab', (ev)=>{
        try{
          // Al salir de un tab, forzar publicación inmediata del backend para guardar el estado actual
          window.__ccnPublishLastStates && window.__ccnPublishLastStates();
          // NO repintar aquí - esperar a que shown.bs.tab lo haga con estados frescos
        }catch(_e){}
      }, true);
      // NO forzar rojo al salir de un tab - el backend es la fuente de verdad
    });
  }catch(_e){}
})();
