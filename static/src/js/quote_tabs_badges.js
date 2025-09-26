/** CCN Quote Tabs — pinta leyendo rubro_state_* desde el DOM (sin RPC/URL/res_id)
 *  - Re-pinta en:
 *    a) cambio de rubro_state_*
 *    b) clic/tecla en tabs
 *    c) cambio de Sitio o Tipo de servicio
 *  - Estados: 1 => verde, 2 => ámbar, 0/otros => rojo
 *  - Odoo 18 CE, sin imports
 */
(function () {
  "use strict";

  // === normalización (acentos, espacios)
  function norm(s){
    return String(s||"").trim().toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/\s+/g," ");
  }

  // === etiqueta visible -> rubro_code
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
  function LABEL_TOCODE_SAFE(){ return LABEL_TO_CODE; }
  const STATE_FIELD = (code) => `rubro_state_${code}`;
  const CODE_TO_FIELD = {
    "mano_obra": "line_ids_mano_obra",
    "uniforme": "line_ids_uniforme",
    "epp": "line_ids_epp",
    "epp_alturas": "line_ids_epp_alturas",
    "equipo_especial_limpieza": "line_ids_equipo_especial_limpieza",
    "comunicacion_computo": "line_ids_comunicacion_computo",
    "herramienta_menor_jardineria": "line_ids_herramienta_menor_jardineria",
    "material_limpieza": "line_ids_material_limpieza",
    "perfil_medico": "line_ids_perfil_medico",
    "maquinaria_limpieza": "line_ids_maquinaria_limpieza",
    "maquinaria_jardineria": "line_ids_maquinaria_jardineria",
    "fertilizantes_tierra_lama": "line_ids_fertilizantes_tierra_lama",
    "consumibles_jardineria": "line_ids_consumibles_jardineria",
    "capacitacion": "line_ids_capacitacion",
  };

  // === clases de color
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

  // === leer valor int desde un <field> renderizado en el DOM
  function readIntField(root, fieldName){
    // probamos por [name] y por [data-name] (según widget)
    const el = root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    const v = parseInt(String(raw).trim(), 10);
    return Number.isNaN(v) ? null : v;
  }

  // === helpers DOM
  function getForm(){ return document.querySelector(".o_form_view"); }
  function getNotebook(){ return document.querySelector(".o_form_view .o_notebook"); }
  function getLinks(nb){ return nb ? [...nb.querySelectorAll(".nav-tabs .nav-link")] : []; }

  function countLines(nb, code){
    const fieldName = CODE_TO_FIELD[code];
    if(!fieldName || !nb) return 0;
    const container = nb.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!container) return 0;
    const list = container.querySelector('.o_list_view');
    if(!list) return 0;
    const dataRows = list.querySelectorAll('tbody tr.o_data_row');
    let count = dataRows ? dataRows.length : 0;
    if(count === 0){
      // inline edición -> considerar el editor como 1 fila
      const inlineForm = list.querySelector('.o_form_view');
      if(inlineForm) count = 1;
    }
    return count;
  }

  // === índice code -> <a.nav-link>
  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    for(const a of getLinks(nb)){
      const code = LABEL_TO_CODE[norm(a.textContent)];
      if(code) byCode[code] = a;
    }
    return byCode;
  }

  // === pintado desde estados
  function paintFromStates(formRoot, nb, byCode, last){
    let changed = false;
    for(const [code, link] of Object.entries(byCode)){
      const st = readIntField(formRoot, STATE_FIELD(code));
      let sNorm = (st === 1 || st === 2) ? st : 0; // 0/otros => rojo
      const rows = countLines(nb, code);
      if(rows > 0){
        sNorm = 1;
      } else if(sNorm === 1){
        sNorm = 0;
      }
      if (last[code] !== sNorm){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
      }
    }
    return changed;
  }

  // === observadores/eventos que disparan repintado
  function watchAndBind(formRoot, nb, byCode, last){
    let scheduled = false;
    const schedule = (delays=[0,40,160,360]) => {
      if (scheduled) return;
      scheduled = true;
      const run = () => { try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} };
      delays.forEach((ms,i)=> setTimeout(()=>{ if(i===delays.length-1) scheduled=false; run(); }, ms));
    };

    // 1) cambios en campos rubro_state_* (reaccionan a compute en servidor)
    const mo = new MutationObserver((muts) => {
      try{
        for(const mut of muts){
          const t = mut.target;
          if (!(t instanceof Element)) continue;
          const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
          if (name.startsWith("rubro_state_")){ schedule(); return; }
          const holder = t.closest?.('[name^="rubro_state_"], [data-name^="rubro_state_"]');
          if (holder){ schedule(); return; }
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

    // 2) clic/tecla en tabs
    for(const a of getLinks(nb)){
      a.addEventListener("click", () => schedule());
      a.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") schedule();
      });
    }

    // 3) cambios visibles de Sitio / Tipo de servicio (selects en el header)
    const siteEl = formRoot.querySelector('[name="current_site_id"], [data-name="current_site_id"]');
    const svcEl  = formRoot.querySelector('[name="current_service_type"], [data-name="current_service_type"]');
    if (siteEl) {
      siteEl.addEventListener('change', ()=> schedule());
      siteEl.addEventListener('input',  ()=> schedule());
    }
    if (svcEl) {
      svcEl.addEventListener('change', ()=> schedule());
      svcEl.addEventListener('input',  ()=> schedule());
    }

    // 4) cambios en los x2many de cada rubro (altas/bajas/ediciones inline)
    for (const code of Object.keys(byCode)){
      const fieldName = CODE_TO_FIELD[code];
      if(!fieldName) continue;
      const container = nb.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
      if(!container) continue;
      const target = container.querySelector('.o_x2m, .o_list_view');
      if(!target) continue;
      const moList = new MutationObserver(() => schedule());
      moList.observe(target, {childList: true, subtree: true});
    }

    // Debug
    window.__ccnTabsWatch = {
      repaint(){ schedule([0]); },
      dump(){ console.log(JSON.parse(JSON.stringify(last))); }
    };
  }

  // === boot
  function start(){
    const formRoot = getForm();
    const nb = getNotebook();
    if(!formRoot || !nb) return false;

    const byCode = indexByCode(nb);
    if (!Object.keys(byCode).length) return false;

    const last = {};
    try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
    watchAndBind(formRoot, nb, byCode, last);
    return true;
  }

  // espera a que exista el form/notebook
  try{
    if(!start()){
      const obs = new MutationObserver(()=>{ if(start()) obs.disconnect(); });
      obs.observe(document.documentElement, {childList:true,subtree:true});
    }
  }catch(_e){}
})();
