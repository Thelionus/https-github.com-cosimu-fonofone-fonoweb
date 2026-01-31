import Utils from "./_utils.js";
import Globales from "../globales.js";

import Power from "../../images/icon-power.svg";
import PowerActif from "../../images/icon-power-actif.svg";
import IconeMetronome from "../../images/metronome.png";
import IconeMetronomeFou from "../../images/metronome-fou.png";
import S1_1 from "../../images/1_1.png";
import S2_1 from "../../images/2_1.png";
import S3_1 from "../../images/3_1.png";
import S5_1 from "../../images/5_1.png";

const Metronome = Globales.modules.metronome;
const min_x = Metronome.border_width;
const max_x = Metronome.largeur_module - Metronome.largeur_controlleur - Metronome.border_width;

export default {
  mixins: [Utils],
  data: function () {
    return { aleatoire: null, bpm: null, syncope: null, font_size_bpm: "medium", x_aleatoire: 0 };
  },
  methods: {
    charger_props: function () {
      this.bpm = this.value.bpm;

      this.aleatoire = this.value.aleatoire;
      this.x_aleatoire = (this.aleatoire * (max_x - min_x)) + min_x;

      this.syncope = this.value.syncope;

      if(this._isMounted) { this.update_position_point_arc(); }
    },
    drag: function (e) {
      let coords = this.get_mouse_position(e);

      // Aleatoire
      if(this.controlleur_actif == this.$refs.controlleur_aleatoire || this.controlleur_actif == this.$refs.controlleur_bg_aleatoire) {
        let x_aleatoire = coords.x - (Metronome.largeur_controlleur / 2);
        this.x_aleatoire = this.borner(x_aleatoire, min_x, max_x);
        this.aleatoire = (this.x_aleatoire - min_x) / (max_x - min_x);
      }

      // BPM
      else {
        // Recentrer les coordonnees de drag
        let x = coords.x - Metronome.centre_cercle.x;
        let y = coords.y - Metronome.centre_cercle.y;

        // Hack, aucune idée pourquoi il faut inverser x et y et multiplier y par -1.
        // Donne les bonnes coordonnes
        let angle = cartesianToPolar(-y, x).degrees;

        // Reporter l'angle sur l'arc
        let segment_arc = angle / (Metronome.taille_arc / 2);

        // Projeter sur l'interval [0..1]
        this.bpm = this.borner_0_1((segment_arc / 2) + 0.5);
        this.update_position_point_arc();
      }
      this.update();
    },
    // Parce que computed fonctionne pas ...
    update_position_point_arc: function () {
      // Deplacement du point : https://bl.ocks.org/mbostock/1705868
      let arc = this.$refs.arc;
      let point = arc.getPointAtLength(arc.getTotalLength() * (1 - this.bpm));
      this.$refs.controlleur_bpm.setAttribute('cx', point.x);
      this.$refs.controlleur_bpm.setAttribute('cy', point.y);
    },
    update: function () {
      this.$emit('input', { actif: this.module_actif, syncope: this.syncope, aleatoire: this.aleatoire, bpm: this.bpm });
    },
    update_syncope: function (val) {
      this.syncope = val;
      this.update();
    },
    update_bpm_manuel: function (e) {
      if(isInt(e.target.value)) {
        let val = parseInt(e.target.value);
        this.bpm = this.borner_0_1(Math.pow((val - Metronome.min_bpm) / (Metronome.max_bpm - Metronome.min_bpm), 1/2) || 0);
      }
      else if (e.target.value == "") {
        this.bpm = 0;
      }

      e.target.value = this.text_bpm;
      this.update_position_point_arc();
      this.update();
    },
    update_font_size_bpm: function () {
      this.font_size_bpm = `${this.$refs.text.offsetHeight}px`;
      this.bpm = this.bpm; // Hack : set bpm dirty pour forcer affichage quand on charge un son
    }
  },
  computed: {
    x_controlleur_aleatoire: function () {
      return this.aleatoire * (1 - Metronome.largeur_controlleur_aleatoire);
    },
    text_bpm: function () {
      return Math.round(Math.pow(this.bpm, 2) * (Metronome.max_bpm - Metronome.min_bpm) + Metronome.min_bpm);
    }
  },
  mounted: function () {
    this.update_position_point_arc();
    this.update_font_size_bpm();
  },
  template: `
    <generique>
      <svg viewBox="0 0 ${Metronome.largeur_module} ${Metronome.hauteur_module}" preserveAspectRatio="none" ref="canvas">
        <circle class="concentrique" cx="${Metronome.centre_cercle.x}" cy="${Metronome.centre_cercle.y}" r="0.18"/>
        <circle class="concentrique" cx="${Metronome.centre_cercle.x}" cy="${Metronome.centre_cercle.y}" r="0.145"/>
        <circle class="concentrique" cx="${Metronome.centre_cercle.x}" cy="${Metronome.centre_cercle.y}" r="0.09"/>
        <path d="${describeArc(Metronome.centre_cercle.x, Metronome.centre_cercle.y, 0.27, (Metronome.taille_arc / -2), (Metronome.taille_arc / 2))}" class="arc" ref="arc"/>
        <path d="${describeArc(Metronome.centre_cercle.x, Metronome.centre_cercle.y, 0.27, (Metronome.taille_arc / -2), (Metronome.taille_arc / 2))}" class="bg-arc controlleur" ref="controlleur_bg_arc"/>
        <circle class="curseur-bpm controlleur" r="${Metronome.taille_cercle_controlleur}" ref="controlleur_bpm"/>

        <rect class="image-bg" :class="{actif: syncope == 1/2}" x="0" width="0.25" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />
        <rect class="image-bg" :class="{actif: syncope == 1/3}" x="0.25" width="0.25" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />
        <rect class="image-bg" :class="{actif: syncope == 1/4}" x="0.5" width="0.25" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />
        <rect class="image-bg" :class="{actif: syncope == 1/5}" x="0.75" width="0.25" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />
        <rect class="bordure-images" x="${Metronome.border_width / 2}" width="${Metronome.largeur_module - Metronome.border_width}" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" rx="0.02" />
        <image preserveAspectRatio="none" href="${S1_1}" @click="update_syncope(1/2)" x="0.035" width="0.18" y="${Metronome.y_relatif_centre_syncope - (Metronome.hauteur_syncope / 2 - Metronome.border_width / 2)}" height="${Metronome.hauteur_syncope * 0.7}" />
        <image preserveAspectRatio="none" href="${S2_1}" @click="update_syncope(1/3)" x="${0.035 + 0.25}" width="0.18" y="${Metronome.y_relatif_centre_syncope - (Metronome.hauteur_syncope / 2 - Metronome.border_width / 2)}" height="${Metronome.hauteur_syncope * 0.7}" />
        <image preserveAspectRatio="none" href="${S3_1}" @click="update_syncope(1/4)" x="${0.035 + 0.5}" width="0.18" y="${Metronome.y_relatif_centre_syncope - (Metronome.hauteur_syncope / 2 - Metronome.border_width / 2)}" height="${Metronome.hauteur_syncope * 0.7}" />
        <image preserveAspectRatio="none" href="${S5_1}" @click="update_syncope(1/5)" x="${0.035 + 0.75}" width="0.18" y="${Metronome.y_relatif_centre_syncope - (Metronome.hauteur_syncope / 2 - Metronome.border_width / 2)}" height="${Metronome.hauteur_syncope * 0.7}" />
        <rect class="milieu-images" x="${1 * Metronome.largeur_module / 4 - Metronome.border_width / 2}" width="${Metronome.border_width}" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />
        <rect class="milieu-images" x="${2 * Metronome.largeur_module / 4 - Metronome.border_width / 2}" width="${Metronome.border_width}" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />
        <rect class="milieu-images" x="${3 * Metronome.largeur_module / 4 - Metronome.border_width / 2}" width="${Metronome.border_width}" y="${Metronome.y_relatif_centre_syncope - Metronome.hauteur_syncope / 2}" height="${Metronome.hauteur_syncope}" />

        <image href="${IconeMetronome}" x="0" width="${Metronome.largeur_module / 10}" y="${Metronome.y_relatif_image_aleatoire}" height="${Metronome.largeur_module / 10}" />
        <image href="${IconeMetronomeFou}" x="0.85" width="0.15" y="0.74" height="0.12" />
        <rect class="ligne-aleatoire" x="0" width="${Metronome.largeur_module}" y="${Metronome.y_relatif_centre_aleatoire - Metronome.taille_centre_controlleur / 2}" height="${Metronome.taille_centre_controlleur}" rx="0.02"/>
        <rect class="hidden bg-aleatoire controlleur" x="0" width="${Metronome.largeur_module}" y="${Metronome.hauteur_module * Metronome.y_relatif_centre_aleatoire - Metronome.hauteur_controlleur / 2}" height="${Metronome.hauteur_controlleur}" ref="controlleur_bg_aleatoire"/>
        <rect class="curseur-aleatoire controlleur" :x="x_aleatoire" width="${Metronome.largeur_controlleur}" y="${Metronome.hauteur_module * Metronome.y_relatif_centre_aleatoire - Metronome.hauteur_controlleur / 2}" height="${Metronome.hauteur_controlleur}" rx="0.02" ref="controlleur_aleatoire"/>
      </svg>
      <input class="affichage_bpm" type="text" ref="text" :value="text_bpm" @keydown.capture.stop @change="update_bpm_manuel" :style="{fontSize: font_size_bpm}"/>

      <template v-slot:footer>
        <img class="power" :src="module_actif ? '${PowerActif}' : '${Power}'" alt="${Power}" @click="toggle_actif">
      </template>
    </generique>
  `
};

// https://stackoverflow.com/questions/5736398/how-to-calculate-the-svg-path-for-an-arc-of-a-circle#18473154
function describeArc(x, y, radius, startAngle, endAngle){
  var start = polarToCartesian(x, y, radius, endAngle);
  var end = polarToCartesian(x, y, radius, startAngle);

  var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  var d = [
    "M", start.x, start.y, 
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
  return d;       
}
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

//https://stackoverflow.com/questions/32219051/how-to-convert-cartesian-coordinates-to-polar-coordinates-in-js#33043899
function cartesianToPolar(x, y){
  return { rayon: Math.sqrt(x*x + y*y), radians: Math.atan2(y,x), degrees: Math.atan2(y, x) * (180/Math.PI)};
}

function theta (x, y) {
  return Math.atan2(y, x);
}

function isInt (val) {
  return /^[-+]?(\d+|Infinity)$/.test(val);
}
