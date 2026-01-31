import Utils from "./_utils.js";
import Globales from "../globales.js";

import Jouer from "../../images/play.png";
import Magnet from "../../images/icon-magnet.svg";
import MagnetActif from "../../images/icon-magnet-actif.svg";
import Power from "../../images/icon-power.svg";
import PowerActif from "../../images/icon-power-actif.svg";
import Fleche from "../../images/icon-arrow.svg";
import Lignes from "../../images/icon-v-lines.svg";
import Ligne from "../../images/ligne.svg";

const Arpegiateur = Globales.modules.arpegiateur;
const BW = Arpegiateur.border_width;
const taille_top = 0.025;

const debut_section2 = 0.125;
const hauteur_section2 = 0.475;

const debut_section3 = 0.65;
const hauteur_section3 = 0.3;

const MAX_COLONNES = 12;

export default {
  mixins: [Utils],
  data: function () {
    return { 
      colonnes: [],
      mode: 2,
      octaves: 1,
      sens: 1,
      aimant: true,
      dirty: false,
      prochaine_colonne: MAX_COLONNES
    };
  },
  methods: {
    charger_props: function () {
      this.aimant = this.value.aimant;
      this.colonnes = this.value.colonnes;
      this.mode = this.value.mode;
      this.octaves = this.value.octaves;
      this.sens = this.value.sens;
    },
    drag: function (e) {
      let coords = this.get_mouse_position(e);
      let colonne = this.colonnes[this.controlleur_actif.getAttribute("data-col")];
      let type = this.controlleur_actif.getAttribute("data-type");

      if(type == "vitesse") {
        let pos = this.borner(coords.y, this.min_y, this.max_y);
        colonne.vitesse = 1 - ((pos - this.min_y) / (this.max_y - this.min_y));
      }

      if(type == "volume") {
        colonne.volume = 1 - this.borner_0_1((coords.y - debut_section3) / hauteur_section3);
      }

      this.update();
    },
    toggle_aimant: function () { this.aimant = !this.aimant; this.update() },

    update: function () { this.$emit('input', { actif: this.module_actif, aimant: this.aimant, colonnes: this.colonnes, mode: this.mode, octaves: this.octaves, sens: this.sens }); },

    y: function (col) {
      let vitesse = this.colonnes[col].vitesse;
      let y = this.min_y + ((this.max_y - this.min_y) * (1 - vitesse));
      if(this.aimant) {
        let arrondi = 1 - (this.arrondir(vitesse, this.nb_divisions - 1));
        y = this.min_y + ((this.max_y - this.min_y) * arrondi);
      }

      return y;
    },
    get_next_colonne: function () {

      this.prochaine_colonne += this.sens;

      if(this.dirty) {
        this.prochaine_colonne = this.sens == 1 ? 0 : this.mode - 1;
        this.dirty = false;
      }
      else {
        if(this.prochaine_colonne < 0) this.prochaine_colonne = this.mode - 1;
        if(this.prochaine_colonne > (this.mode - 1)) this.prochaine_colonne = 0;
      }

      this.flash(this.prochaine_colonne);
      let col = this.colonnes[this.prochaine_colonne];
      return {
        jouer: col.jouer,
        vitesse: col.vitesse,
        volume: col.volume,
        octaves: this.octaves
      };
    },
    flash: function (colonne) {
      this.$refs["diode-" + colonne][0].classList.add("flash");
      setTimeout(() => { this.$refs["diode-" + colonne][0].classList.remove("flash"); }, 250);
    },
    change_mode: function () {
      this.mode = Math.max(2, (this.mode % MAX_COLONNES) + 1);
      this.update();
    },
    change_octaves: function () {
      this.octaves = (this.octaves % 2) + 1;
      this.update();
    },
    toggle_sens: function () {
      this.sens *= -1;
    },
    toggle_jouer: function (col) {
      col.jouer = !col.jouer;
      this.update();
    },
    y_division: function (i) {
      return debut_section2 + BW / 2 + (i / (this.nb_divisions + 1)) * (hauteur_section2 - BW);
    },
    classe_division_aimant: function (i) {
      let classes = [];
      let i_fortes_1_octave = [3, 12];
      let i_fortes_2_octaves = [1, 6, 9, 18, 21, 25];

      // Ajout des classes en mode 1 octave
      if(this.octaves == 1) {
        if(i == 7) {
          classes.push("centrale");
        }

        if(i_fortes_1_octave.includes(i)) {
          classes.push("forte");
        }

        if(!this.aimant && !i_fortes_1_octave.includes(i)) {
          classes.push("cachee");
        }
      }

      else if (this.octaves == 2) {
        if(i == 13) {
          classes.push("centrale");
        }

        if(i_fortes_2_octaves.includes(i)) {
          classes.push("forte");
        }

        if(!this.aimant && !i_fortes_2_octaves.includes(i)) {
          classes.push("cachee");
        }
      }

      // Concatener les classes
      return classes.join(" ");
    }
  },
  computed: {
    nb_divisions: function () { return this.octaves == 1 ? 13 : 25; },
    min_y: function () { return this.y_division(1) },
    max_y: function () { return this.y_division(this.nb_divisions) },
    nb_colonnes: function () { return this.mode; },
    largeur_colonne: function () { return (Arpegiateur.largeur_module - BW) / this.nb_colonnes },
    cote_diode: function () { return Math.min(0.05, this.largeur_colonne / 3); },
    cote_jouer: function () { return Math.min(0.045, this.largeur_colonne / 3); }
  },
  created: function () {
    while(this.colonnes.length < MAX_COLONNES) this.colonnes.push({ vitesse: 0.5, volume: 0.5, jouer: true });
  },
  template: `
    <generique>
      <svg viewBox="0 0 ${Arpegiateur.largeur_module} ${Arpegiateur.hauteur_module}" preserveAspectRatio="none" ref="canvas">

        <!-- diode -->
        <rect v-for="(v, col) in colonnes" class="diode" 
          :x="(col * largeur_colonne) + (largeur_colonne - cote_diode) / 2" :width="cote_diode"
          :y="(${Arpegiateur.section1.hauteur} - cote_diode) / 2" :height="cote_diode"
          :ref="'diode-' + col"
        />


        <!-- vitesse -->
        <rect  class="vitesse positive" v-for="(v, col) in colonnes" v-show="colonnes[col].vitesse > 0.5" 
          :x="${BW / 2} + col * largeur_colonne" :width="largeur_colonne" 
          :y="y(col)" :height="min_y + ((max_y - min_y) / 2) - y(col)" 
        />
        <rect class="vitesse negative" v-for="(v, col) in colonnes" v-show="colonnes[col].vitesse < 0.5" 
          :x="${BW / 2} + col * largeur_colonne" :width="largeur_colonne" 
          :y="${debut_section2} + (${hauteur_section2} / 2)" :height="y(col) - (max_y + min_y) / 2" 
        />
        <line class="vitesse-top" v-for="(v, col) in colonnes" 
          :x1="col * largeur_colonne + ${BW / 2} + 0.015"
          :x2="(col + 1) * largeur_colonne + ${BW / 2} - 0.015"
          :y1="y(col)"
          :y2="y(col)"
        />
        <!-- divisions -->
        <line class="division aimant" v-for="i in nb_divisions"
          :class="classe_division_aimant(i)"
          x1="0" x2="1" 
          :y1="y_division(i)"
          :y2="y_division(i)"
        />
        <rect class="bg-cadre" x="0" width="${Arpegiateur.largeur_module}" y="${debut_section2}" height="${hauteur_section2}" />
        <rect v-for="(v, col) in colonnes" class="bg-colonne controlleur" 
          :x="${BW / 2} + col * largeur_colonne" :width="largeur_colonne" 
          y="${debut_section2}" height="${hauteur_section2}" 
          :ref="'vitesse-' + col"
          :data-col="col" data-type="vitesse"
        />


        <!-- volume -->
        <rect class="volume" v-for="(v, col) in colonnes" 
          :x="${BW / 2} + col * largeur_colonne" :width="largeur_colonne" 
          :y="${debut_section3} + (${hauteur_section3} * (1 - colonnes[col].volume))" :height="${hauteur_section3} * colonnes[col].volume" 
        />
        <line class="volume-top" v-for="(v, col) in colonnes" 
          :x1="col * largeur_colonne + ${BW / 2} + 0.015"
          :x2="(col + 1) * largeur_colonne + ${BW / 2} - 0.015"
          :y1="${debut_section3} + (${BW} + ${taille_top}) / 2 + ((${hauteur_section3} - (${taille_top} + ${BW})) * (1 - colonnes[col].volume))"
          :y2="${debut_section3} + (${BW} + ${taille_top}) / 2 + ((${hauteur_section3} - (${taille_top} + ${BW})) * (1 - colonnes[col].volume))"
        />
        <rect class="bg-cadre" x="0" width="${Arpegiateur.largeur_module}" y="${debut_section3}" height="${hauteur_section3}" />
        <rect v-for="(v, col) in colonnes" class="bg-colonne controlleur"
          :x="${BW / 2} + col * largeur_colonne" :width="largeur_colonne" 
          y="${debut_section3}" height="${hauteur_section3}" 
          :ref="'volume-' + col"
          :data-col="col" data-type="volume"
        />


        <!-- jouer -->
        <image v-for="(v, col) in colonnes" preserveAspectRatio="xMidYMid meet" href="${Jouer}" class="image hidden" :class="{actif: colonnes[col].jouer}"
          :x="${BW / 2} + (col * largeur_colonne) + (largeur_colonne - cote_jouer) / 2"
          :y="0.9 + (0.075 - cote_jouer) / 2" :height="cote_jouer"
        /> 
        <rect class="bg-cadre hidden" x="${BW / 2}" width="${Arpegiateur.largeur_module - BW}" y="0.9" height="0.075" />
        <rect v-for="(v, col) in colonnes" class="bg-colonne hidden" 
          :x="${BW / 2} + col * largeur_colonne" :width="largeur_colonne" 
          y="0.9" height="0.075" 
          @click="toggle_jouer(colonnes[col])"
        />
      </svg>

      <template v-slot:footer>
        <img class="power" :src="module_actif ? '${PowerActif}' : '${Power}'" alt="${Power}" @click="toggle_actif">
        <div class="menu-droite">
          <span class="mode" @click="change_mode">{{ mode }}</span>
          <img class="sens" :class="{inverse: sens == -1}" src="${Fleche}" alt="${Fleche}" @click="toggle_sens">
          <img class="octaves" :src="octaves == 1 ? '${Ligne}' : '${Lignes}'" alt="${Lignes}" :class="{rotate: octaves == 1}" @click="change_octaves">
          <img class="magnet" :src="aimant ? '${MagnetActif}' : '${Magnet}'" alt="${Magnet}" @click="toggle_aimant">
        </div>
      </template>
    </generique>
  `
};
