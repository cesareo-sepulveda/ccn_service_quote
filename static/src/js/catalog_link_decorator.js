/** @odoo-module **/

import { registry } from "@web/core/registry";

function closestPage(el){
  return el.closest('[id^="page_"]');
}

const service = {
  name: "ccn_catalog_link_decorator",
  start() {
    const root = document.body;

    function wireLinks(){
      // Recorre cada x2many de líneas por rubro
      document.querySelectorAll('.o_field_x2many[name^="line_ids_"]').forEach((field)=>{
        // Buscar el link de "Agregar una línea" en el pie de la tabla
        const add = field.querySelector('.o_list_button_add');
        if (!add) return;
        // Evitar duplicar si ya existe nuestro enlace junto a este add
        if (add.parentElement && add.parentElement.querySelector('.o_ccn_catalog_link')) return;

        // Botón oculto del catálogo en la pestaña
        const page = closestPage(field) || document;
        const hiddenBtn = page.querySelector('button.o_ccn_catalog_hidden_btn[name="action_open_catalog_wizard"]');
        if (!hiddenBtn) return;

        // Construir separador + enlace
        const sep = document.createElement('span');
        sep.textContent = ' · ';
        sep.className = 'o_ccn_catalog_sep';
        sep.style.marginLeft = '6px';
        sep.style.marginRight = '6px';

        const a = document.createElement('a');
        a.href = '#';
        a.className = 'o_ccn_catalog_link';
        a.textContent = 'Catálogo';
        a.addEventListener('click', (ev)=>{
          ev.preventDefault();
          hiddenBtn.click();
        });

        // Insertar justo después del link de "Agregar una línea"
        const container = add.parentElement || field;
        container.insertBefore(sep, add.nextSibling);
        container.insertBefore(a, sep.nextSibling);
      });
    }

    const obs = new MutationObserver(()=>{
      try{ wireLinks(); }catch(_e){}
    });
    obs.observe(root, { childList: true, subtree: true });
    // Primera pasada
    wireLinks();
  },
};

registry.category("services").add("ccn_catalog_link_decorator", service);
