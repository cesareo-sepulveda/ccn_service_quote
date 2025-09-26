/** CCN Quote Tabs — pinta leyendo rubro_state_* desde el DOM
 *  y fuerza refrescos fiables de las listas sin recargar la página.
 *  - Estados: 1 => verde (ccn-status-filled), 2 => ámbar (ccn-status-ack), 0/otros => rojo.
 *  - Odoo 18 CE, sin imports.
 */
(function () {
  "use strict";

  // ===== util =====
  function norm(s){
    return String(s||"").trim().toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/\s+/g," ");
  }

  // Etiqueta visible -> code de rubro (debe coincidir con tus pages)
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

  // ===== clases de color =====
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

  // ===== lectura de campos en DOM =====
  function readIntField(root, fieldName){
    // Se publican en una caja .o_ccn_rubro_states (d-none) para que siempre existan en el DOM
    const el = root.querySelector(`.o_ccn_rubro_states [name="${fieldName}"], .o_ccn_rubro_states [data-name="${fieldName}"]`)
            || root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    const v = parseInt(String(raw).trim(), 10);
    return Number.isNaN(v) ? null : v;
  }

  // ===== notebook/tabs =====
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

  // ===== fallback: deducir estado por filas visibles en la page activa =====
  function deduceStateFromActivePage(link){
    try{
      const paneId = link.getAttribute("data-bs-target") || link.getAttribute("href");
      if(!paneId || !paneId.startsWith("#")) return null;
      const pane = document.querySelector(paneId);
      if(!pane) return null;
      // Busca filas reales en el listado (excluye row vacía de edición)
      const rows = pane.querySelectorAll('.o_list_view table tbody tr');
      // Si hay alguna fila con data-id o que no sea "o_empty_row", lo tomamos como lleno
      for(const tr of rows){
        if (!tr.classList.contains('o_empty_row')) return 1;
      }
      // Sin filas -> 0 (rojo). El ACK no se puede inferir aquí.
      return 0;
    }catch(_e){ return null; }
  }

  // ===== repintado =====
  function paintFromStates(formRoot, nb, byCode, last){
    let changed = false;
    for(const [code, link] of Object.entries(byCode)){
      let st = readIntField(formRoot, STATE_FIELD(code));
      if (st !== 1 && st !== 2 && st !== 0){
        // Fallback solo para la pestaña activa
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

  // Fuerza un “micro-remonte” del listado activo para que aplique el dominio actual
  // (sin navegar ni cambiar de pestaña)
  function softRemountActiveList(nb){
    try{
      const activePane = nb.querySelector('.tab-pane.active');
      if(!activePane) return;
      const holder = activePane.querySelector('.o_list_view, .o_x2m_control_panel, .o_x2m_view');
      if(!holder) return;
      // truco: clonar y reemplazar nodos contenedores mínimos (fuerza re-render del widget)
      // sin perder el estado del record
      const wrap = holder.parentElement;
      const marker = document.createComment('ccn-remount');
      wrap.insertBefore(marker, holder);
      wrap.removeChild(holder);
      // Deja respirar el loop de render
      setTimeout(()=> {
        marker.parentNode && marker.parentNode.insertBefore(holder, marker);
        marker.parentNode && marker.parentNode.removeChild(marker);
      }, 0);
    }catch(_e){}
  }

  // ===== observar cambios =====
  function watchEverything(formRoot, nb, byCode, last){
    let scheduled = false;
    const schedule = (extraRemount=false) => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        try{
          if (extraRemount) softRemountActiveList(nb);
          paintFromStates(formRoot, nb, byCode, last);
        }catch(_e){}
      }, 0);
    };

    // 1) Mutaciones en la zona de estados y en listados
    const mo = new MutationObserver((muts) => {
      for(const mut of muts){
        const t = mut.target;
        if (!(t instanceof Element)) continue;
        // si cambia algún rubro_state_ => repinta
        const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
        if (name.startsWith("rubro_state_")) { schedule(false); return; }

        // cambios dentro de las x2many (agregar / quitar filas / editar)
        if (t.closest?.('.o_list_view') || t.closest?.('.o_x2m_view')) { schedule(false); return; }
      }
    });
    mo.observe(formRoot, { childList:true, subtree:true, characterData:true, attributes:true });

    // 2) Click en tabs => repinta con retardo corto
    nb.addEventListener('click', (ev)=>{
      const a = ev.target.closest?.('.nav-tabs .nav-link');
      if (!a) return;
      setTimeout(()=> schedule(false), 60);
      setTimeout(()=> schedule(false), 180);
    }, true);

    // 3) Cambios de Sitio / Tipo de servicio => repintar + remonte suave
    const siteField = formRoot.querySelector('[name="current_site_id"], [data-name="current_site_id"]');
    const svcField  = formRoot.querySelector('[name="current_service_type"], [data-name="current_service_type"]');

    const moScope = new MutationObserver(()=> {
      // remonte para forzar que la lista aplique el nuevo dominio
      schedule(true);
      setTimeout(()=> schedule(true), 100);
      setTimeout(()=> schedule(true), 250);
    });
    if (siteField) moScope.observe(siteField, {attributes:true, childList:true, subtree:true, characterData:true});
    if (svcField)  moScope.observe(svcField,  {attributes:true, childList:true, subtree:true, characterData:true});

    // 4) Eventos de input/guardado dentro de las listas (fallback)
    formRoot.addEventListener('change', (ev)=>{
      if (ev.target.closest('.o_list_view')) schedule(false);
    }, true);
    formRoot.addEventListener('input', (ev)=>{
      if (ev.target.closest('.o_list_view')) schedule(false);
    }, true);

    // Debug opcional
    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ paintFromStates(formRoot, nb, byCode, last); },
      remount(){ softRemountActiveList(nb); schedule(false); },
    };
  }

  // ===== boot =====
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
      if (!Object.keys(byCode).length) return; // no hay tabs mapeadas
      const last = {};
      // Pintado inicial
      try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      // Observadores
      watchEverything(formRoot, nb, byCode, last);
    });
  }catch(_e){}
})();
