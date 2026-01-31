/*
 * Utils
 * Fonctions utilitaires pour la manipulation des modules
 *
 * Pour tous les modules, il faut mettre un ref pour le controlleur, l'element mobile et un ref pour le canvas, celui qui contient l'interaction
 */

import Generique from "./_generique.js";

export default {
  props: ['value'],
  components: { "generique": Generique },
  data: function () { return { is_dragging: false, controlleur_actif: null, module_actif: this.value.actif == true }; },
  methods: {
    arrondir: function (valeur, divisions) {
      return Math.round(valeur * divisions) / divisions;
    },
    borner: function (valeur, min, max) {
      return Math.min(Math.max(valeur, min), max);
    },
    borner_0_1: function (valeur) {
      return Math.min(Math.max(valeur, 0), 1);
    },
    start_drag: function (e) {
      this.controlleur_actif = e.target;
      this.el_externe.addEventListener('mousemove', this.call_drag);
      this.el_externe.addEventListener('touchmove', this.call_drag, { passive: false });
      this.is_dragging = true;
      this.drag(e);
    },
    call_drag: function () {
      event.preventDefault();
      this.drag(event);
    },
    // https://stackoverflow.com/questions/10298658/mouse-position-inside-autoscaled-svg et soustraire le translate de clientX et clientY
    // Reference pour le drag n drop : https://www.petercollingridge.co.uk/tutorials/svg/interactive/dragging/
    get_mouse_position: function (evt) {
      var pt = this.$refs.canvas.createSVGPoint();

      if(evt.type == "mousemove" || evt.type == "mousedown") {
        pt.x = evt.clientX;
        pt.y = evt.clientY;
      }
      // evt.type == "touchmove"
      else {
        pt.x = evt.touches[0].clientX;
        pt.y = evt.touches[0].clientY;
      }

      let transform = this.$el.style.transform;
      let translate = transform.match(/(\d+)/g);

      // Translate ne s'applique en mode colonne. Pourquoi? Je ne le sais pas
      if(false && translate && !this.$el.parentElement.classList.contains("colonne")) {
        pt.x -= translate[0];
        pt.y -= (translate[1] || 0);
      }

      return pt.matrixTransform(this.$refs.canvas.getScreenCTM().inverse());
    },
    end_drag: function (e) {
      this.el_externe.removeEventListener('mousemove', this.call_drag);
      this.el_externe.removeEventListener('touchmove', this.call_drag, { passive: false });
      this.controlleur_actif = null;
      this.is_dragging = false;
    },
    toggle_actif: function () {
      this.module_actif = !this.module_actif;
      this.update();
    }
  },
  created: function () {
    this.el_externe = document.body;
    this.charger_props();
  },
  mounted: function () {
    // Ajouter un listener a tous les controlleurs
    _.each(this.$refs, (ref) => {
      if(typeof ref.className == "object" && ref.className.baseVal.match(/controlleur/)) { 
        ref.addEventListener('mousedown', this.start_drag);
        ref.addEventListener('touchstart', this.start_drag);
      }
      else if (ref.constructor.name == "Array") {
        _.each(ref, (el) => {
          el.addEventListener('mousedown', this.start_drag);
          el.addEventListener('touchstart', this.start_drag);
        });
      }
    });

    // Ajouter des listeners pour la fin du drag
    // On peut dragger dans tout le fonofone
    this.el_externe.addEventListener('mouseup', this.end_drag);
    this.el_externe.addEventListener('mouseleave', this.end_drag);
    this.el_externe.addEventListener('touchend', this.end_drag);
  }
}

