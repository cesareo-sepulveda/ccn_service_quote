/** CCN Quote Tabs — pinta leyendo rubro_state_* desde el DOM (sin RPC/URL/res_id)
 *  Estados: 1 => verde, 2 => ámbar, 0/otros => rojo.
 *  Odoo 18 CE, sin imports.
 */
(function () {
  "use strict";

  function norm(s){
    return String(s||"").trim().toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/\s+/g," ");
  }

  // Etiqueta visible -> code de rubro
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
    const el = root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    const v = parseInt(String(raw).trim(), 10);
    return Number.isNaN(v) ? null : v;
  }

  function getNotebook(){
    return document.querySelector(".o_form_view .o_notebook");
  }
  function getLinks(nb){
    return nb ? [...nb.querySelectorAll(".nav-tabs .nav-link")] : [];
  }

  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    for(const a of getLinks(nb)){
      const code = LABEL_TO_CODE[norm(a.textContent)];
      if(code) byCode[code] = a;
    }
    return byCode;
  }

  function paintFromStates(formRoot, nb, byCode, last){
    let changed = false;
    for(const [code, link] of Object.entries(byCode)){
      const st = readIntField(formRoot, STATE_FIELD(code));
      const sNorm = (st === 1 || st === 2) ? st : 0;
      if (last[code] !== sNorm){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
      }
    }
    return changed;
  }

  function watchStates(formRoot, nb, byCode, last){
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; try{ paintFromStates(formRoot, nb, byCode, last); }catch(_){} }, 0);
      setTimeout(() => { try{ paintFromStates(formRoot, nb, byCode, last); }catch(_){} }, 60);
      setTimeout(() => { try{ paintFromStates(formRoot, nb, byCode, last); }catch(_){} }, 200);
    };

    const mo = new MutationObserver((muts) => {
      try{
        for(const mut of muts){
          const t = mut.target;
          if (!(t instanceof Element)) continue;
          const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
          if (name.startsWith("rubro_state_")) { schedule(); return; }
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

    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ paintFromStates(formRoot, nb, byCode, last); }
    };
  }

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
      if (!Object.keys(byCode).length) return;
      const last = {};
      try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      watchStates(formRoot, nb, byCode, last);
    });
  }catch(_e){}
})();
