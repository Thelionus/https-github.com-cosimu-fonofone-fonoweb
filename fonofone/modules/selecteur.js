import Utils from "./_utils.js";
import Globales from "../globales.js";

import Power from "../../images/icon-power.svg";
import PowerActif from "../../images/icon-power-actif.svg";

const Selecteur = Globales.modules.selecteur;
const min_x_module = Selecteur.border_width;
const max_x_module = Selecteur.largeur_module - Selecteur.border_width;
const min_y_module = Selecteur.border_width;
const max_y_module = Selecteur.hauteur_module - Selecteur.border_width / 2;

const min_x_controlleur = Selecteur.border_width / 2;
const max_x_controlleur = Selecteur.largeur_module - Selecteur.largeur_controlleur - Selecteur.border_width / 2;
const min_y_controlleur = Selecteur.border_width / 2;
const max_y_controlleur = Selecteur.hauteur_module - Selecteur.hauteur_controlleur - Selecteur.border_width / 2;

export default {
  mixins: [Utils],
  data: function () {
    return { 
      cote_gauche: {
        pente: (0 - Selecteur.hauteur_controlleur) / ((Selecteur.largeur_controlleur / 2) - 0),
        y0: null 
      },
      cote_droit: {
        pente: (Selecteur.hauteur_controlleur - 0) / (Selecteur.largeur_controlleur - (Selecteur.largeur_controlleur / 2)),
        y0: null
      },
      x: 0,
      y: 0,
      debut: null,
      longueur: null
    }
  },
  methods: {
    charger_props: function () {
      this.debut = this.value.debut;
      this.longueur = this.value.longueur;
      this.mixer_a_svg();
      if(this._isMounted) this.update_position_controlleur();
      this.update();
    },
    set_plage: function (debut, longueur) {
      this.debut = debut;
      this.longueur = longueur;
      this.mixer_a_svg();
      this.update_position_controlleur();

      this.update();
    },
    update: function () {
      this.$emit('input', { actif: this.module_actif, debut: this.debut, longueur: this.longueur });
    },
    drag: function (e) {
      let coords = this.get_mouse_position(e);

      let y = coords.y - (Selecteur.hauteur_controlleur / 2);
      this.y = this.borner(y, min_y_controlleur, max_y_controlleur);
      this.longueur = 1 - ((this.y - min_y_controlleur) / (max_y_controlleur - min_y_controlleur));

      let x_gauche = this.x_cote_gauche(this.y);
      let x_droit  = this.x_cote_droit(this.y);
      let x = coords.x - (Selecteur.largeur_controlleur / 2);
      this.x = this.borner(x, x_gauche, x_droit);
      this.debut = ((1 - this.longueur) * ((this.x - x_gauche) / (x_droit - x_gauche)) || 0);

      this.update_position_controlleur();
      this.update();
    },
    x_cote_gauche: function (y) {
      return ((y - this.cote_gauche.y0) / this.cote_gauche.pente) - Selecteur.largeur_controlleur / 2 + Selecteur.border_width / 2;
    },
    x_cote_droit: function (y) {
      return ((y - this.cote_droit.y0) / this.cote_droit.pente) - Selecteur.largeur_controlleur / 2 - Selecteur.border_width / 2;
    },
    update_position_controlleur: function () {
      this.$refs.controlleur_curseur.style.transform = `translate(${this.x * 100}%, ${this.y * 100}%)`;
    },
    mixer_a_svg: function () {
      let y = (1 - this.longueur) * (1 - Selecteur.hauteur_controlleur);
      this.y = this.borner(y, min_y_controlleur, max_y_controlleur);

      let x_gauche = this.x_cote_gauche(this.y);
      let x_droit  = this.x_cote_droit(this.y);
      let x = (((this.debut / (1 - this.longueur)) || 0) * (x_droit - x_gauche)) + x_gauche;
      this.x = this.borner(x, x_gauche, x_droit);
    }
  },
  mounted: function () {
    this.cote_gauche.y0 = 0 - (this.cote_gauche.pente * (Selecteur.largeur_module / 2)); // Pointe en haut
    this.cote_droit.y0 = 0 - (this.cote_droit.pente * (Selecteur.largeur_module / 2)); // Pointe en haut
    this.mixer_a_svg();
    this.update_position_controlleur();
  },
  template: `
    <generique>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" ref="canvas">
        <polygon class="bg controlleur" points="${min_x_module},${max_y_module} ${Selecteur.largeur_module / 2},${min_y_module} ${max_x_module},${max_y_module}" ref="controlleur"/>

        <polygon class="curseur controlleur" points="${min_x_controlleur},${Selecteur.hauteur_controlleur} ${Selecteur.largeur_controlleur / 2},${min_y_controlleur} ${Selecteur.largeur_controlleur},${Selecteur.hauteur_controlleur}" ref="controlleur_curseur"/>
      </svg>

      <template v-slot:footer>
        <img class="power" :src="module_actif ? '${PowerActif}' : '${Power}'" alt="${Power}" @click="toggle_actif">
      </template>
    </generique>
  `
};
