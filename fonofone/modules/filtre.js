import Utils from "./_utils.js";
import Globales from "../globales.js";

import Power from "../../images/icon-power.svg";
import PowerActif from "../../images/icon-power-actif.svg";

const Filtre = Globales.modules.filtre;
const min_x = Filtre.border_width / 2;
const min_y = Filtre.border_width / 2;
const max_y = Filtre.hauteur_module - Filtre.hauteur_controlleur - Filtre.border_width / 2;

export default {
  mixins: [Utils],
  data: function () {
    return { debut: null, longueur: null, x: 0, y: 0 };
  },
  methods: {
    charger_props: function () {
      this.debut = this.value.debut;
      this.longueur = this.value.longueur;

      this.x = ((this.debut + this.longueur / 2) * (this.max_x - min_x)) + min_x;
      this.y = (this.longueur * (max_y - min_y)) + min_y;
    },
    update: function () {
      this.$emit('input', { actif: this.module_actif, debut: this.debut, longueur: this.longueur });
    },
    drag: function (e) {
      let coords = this.get_mouse_position(e);

      // Calculer hauteur en premier
      let y = coords.y - (Filtre.hauteur_controlleur / 2);
      this.y = this.borner(y, min_y, max_y);
      this.longueur = (this.y - min_y) / (max_y - min_y);

      let x = coords.x - (this.width / 2);
      this.x = this.borner(x, min_x, this.max_x);
      this.debut = (this.x - min_x) / (Filtre.largeur_module - Filtre.largeur_controlleur_minimale);

      this.update();
    },
  },
  computed: {
    max_x: function () { return Filtre.largeur_module - (this.width + Filtre.border_width / 2); },
    width: function () { return Math.max(this.longueur, Filtre.largeur_controlleur_minimale) - Filtre.border_width; }
  },
  template: `
    <generique>
      <svg viewBox="0 0 ${Filtre.largeur_module} ${Filtre.hauteur_module}" preserveAspectRatio="none" ref="canvas">
        <rect class="bg controlleur" x="${Filtre.border_width / 2}" width="${Filtre.largeur_module - Filtre.border_width}" y="${Filtre.border_width / 2}" height="${Filtre.hauteur_module - Filtre.border_width}" ref="controlleur"/>
        <rect class="centre" x="0.49" width="0.02" y="${Filtre.hauteur_module - (Filtre.border_width / 2) - Filtre.hauteur_centre}" height="${Filtre.hauteur_centre}"/>
        <rect class="curseur controlleur" :x="x" :y="y" :width="width" height="${Filtre.hauteur_controlleur}" rx="0.02" ref="controlleur_curseur"/>
      </svg>

      <template v-slot:footer>
        <img class="power" :src="module_actif ? '${PowerActif}' : '${Power}'" alt="${Power}" @click="toggle_actif">
      </template>
    </generique>
  `
};
