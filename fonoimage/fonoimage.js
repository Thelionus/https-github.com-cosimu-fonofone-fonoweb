import Vue from 'vue';
import _ from 'lodash';
import { saveAs } from 'file-saver';
import { mixin as clickaway } from 'vue-clickaway';
const Fabric = require("fabric").fabric;

import './fonoimage_gestion.js'; // Contient GFonoimage

import ApplicationFonofone from '../fonofone/fonofone.js';
import Filepond from '../lib/filepond.js';
import Enregistreur from '../lib/enregistreur.js';
import ClavierListener from '../lib/clavier.js';
import History from '../lib/history.js';
import Zone from './zone.js';
import Banque from '../banque.js';

import './style.less';
import Eye from '../images/eye.png';
import EyeMix from '../images/eye-mix.svg';
import EyePic from '../images/eye-pic.svg';
import EyeFerme from '../images/eye-ferme.png';
import VerticalDots from '../images/vertical-dots.svg';
import Undo from '../images/undo.svg';
import Redo from '../images/redo.svg';
import Images from '../images/image.svg';
import Oreille from '../images/oreille.svg';
import BackgroundTemp from '../images/Fond_noir.jpg';
import OreilleOff from '../images/oreille_off.svg';
import ParcoursFerme from '../images/icone_parcours_ferme.svg';
import ParcoursOuvert from '../images/icone_parcours_ouvert.svg';
import ParcoursRecordOff from '../images/icone_parcours_record_off.svg';
import ParcoursRecordOn from '../images/icone_parcours_record_on.svg';
import ParcoursPlayRewind from '../images/icone_parcours_play_rewind.svg';
import ParcoursLoopOn from '../images/icone_parcours_loop_on.svg';
import ParcoursLoopOff from '../images/icone_parcours_loop_off.svg';
import ParcoursPlayOn from '../images/icone_parcours_play_on.svg';
import ParcoursPlayOff from '../images/icone_parcours_play_off.svg';
import Poubelle from '../images/trash.svg';
import Export from '../images/export.svg';
import Import from '../images/folder-open.svg';
import Maison from '../images/maison.jpg';
import FlecheDroite from '../images/fleche-droite.svg';
import Fonofone from '../images/logo-fonofone.svg';
import Maximiser from '../images/maximiser.svg';
import Minimiser from '../images/minimiser.svg';

import HautParleur from '../images/hp.svg';
import HautParleurActif from '../images/hp-actif.svg';
import PlayGeneral from '../images/play_general.svg';
import PauseGeneral from '../images/pause_general.svg';
import PartialPlay from '../images/partial_play_general.svg';

import VueI18n from 'vue-i18n';
import i18n from './traductions.js';
Vue.use(VueI18n);

import ConfigurationParDefaut from './configurations/defaut.fnmg';
import ConfigurationFonofoneParDefaut from '../fonofone/configurations/defaut.fnfn';
import SourcesParDefaut from './sources_defaut.json';
import ImagesParDefaut from './images_defaut.js';
import { ImpulsePetit, ImpulseGrand } from "../fonofone/donnees/reverberation/config.js";
const largeur_ff_minimise = 250;
const hauteur_ff_minimise = 400;
const TOLERANCE_MIN_ZONE = 75;

window.Fonoimage = class Fonoimage {
  constructor(el, archive, params) {
    let audioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const paramsSimpleObj = {}
    //    console.log("PARAMS from Fonoimage constructor", params);

    if (!Array.isArray(params)) {
      // we got called from php
      Object.keys(params).forEach((key) => {
        paramsSimpleObj[key] = params[key];
      });
    } else {
      // we're local
      params.forEach((value, key) => {
        paramsSimpleObj[key] = value;
      })
    };


    //console.log("PARAMS Fonoimage constructor", paramsSimpleObj);


    // Creer l'element pour le Vue
    let app_container = document.createElement("div");
    app_container.id = "fnmg-" + window.GestionnaireFonoimage.prochainIndex();
    el.appendChild(app_container);

    return new Vue({
      el: "#" + app_container.id,
      i18n,
      mixins: [Filepond, clickaway], // extensions d'un component
      components: { "fonofone": ApplicationFonofone },
      data: {
        params: paramsSimpleObj,

        //if is_fonofone_edition exists
        presentation_edition: (typeof is_fonoimage_edition !== 'undefined') ? is_fonoimage_edition : false, // vérifie si la licence est présente

        //presentation_edition: false,
        // Operations courantes, sans memoire

        archive,
        enregistrement: { encours: false, enregistreur: null },
        filepond: null,
        id: app_container.id,
        mode: 'normal', // Pas le bon nom
        adding_zone: false,
        ctx_audio: new audioContextConstructor({ bufferSize: 8192 }),
        master: null,
        media_stream_destination: null,
        mode_importation: false,
        history: new History(), // Pour les undo / redo
        afficher_zone_active: false,
        session_active_timeout: null,
        session_wait_interval: null,
        is_licenced_app: (typeof is_licenced_user !== 'undefined' && !!is_licenced_user), // vérifie si la licence est présente
        is_embedded_app: (typeof is_embedded !== 'undefined' && !!is_embedded), // vérifie si l'app est dans un iframe si oui menu minimaliste (play + titre voir html ci-bas)
        menu_parcours_ouvert: false,
        more_features_ouvert: false,
        parcours_record: false,
        //saving_parcours_init_time: 0,
        parcours_play: false,
        parcours_play_loop: false,
        play_parcours_index: 0,
        menu_visible: true,
        click_count: 0,
        click_timeout: null,
        reverb: null,


        // Etat a sauvegarder, les valeurs par defaut sont dans la configuration par defaut
        afficher_zones: true, // états possibles: true, false, "mix", "pic"
        afficher_oreille: true,
        index_arriere_plan: 0,
        arrieres_plans: [],
        banque_locale: new Banque([]),
        gestion_bg: false,
        nom: "Fonoimage",
        sourdine: false,
        pleinecran: false,
        general_play: false,
        zone_solo: null,
        zone_active: null,
        zones: {},
        parcours: []
      },
      provide() {
        return {
          params: paramsSimpleObj,
          getReverb: this.getReverb,
        }
      },
      methods: {
        getReverb() {
          return this.reverb;
        },

        away() {
          this.more_features_ouvert = false;
        },

        undo: function () { this.history.undo() },
        redo: function () { this.history.redo() },

        // detects mulitple clicks to toggle the menu
        handleQuadClick() {
          this.menu_visible = !this.menu_visible;
          //if(this.menu_visible) this.pleinecran = false;
          //update the canvas size according to the new window size
          this.update_canva_size_and_bg(this.arrieres_plans[this.index_arriere_plan]);
        },

        handleBrowserResize() {
          //If we resize the browser window, we need to recalculate the canvas size
          this.update_canva_size_and_bg(this.arrieres_plans[this.index_arriere_plan]);
        },

        handleExitFullscreen(state) {
          //If we exit fullscreen using the browser's Esc shortcut, show the menu
          if (document.fullscreenElement === null) {
            this.pleinecran = false;
            this.menu_visible = true;
            this.update_canva_size_and_bg(this.arrieres_plans[this.index_arriere_plan]);
          }
        },



        get_eye_icon: function (afficher_zones) {
          switch (afficher_zones) {
            case true:
              return Eye;
            case "mix":
              return EyeMix;
            case "pic":
              return EyePic;
            case false:
              return EyeFerme;
            default:
              return Eye;
          }
        },

        // Import / Export
        mode_importation_fn: function () {

          if (this.is_licenced_app) {

            this.mode_importation = !this.mode_importation;

          }

        },
        exporter_parcours: function () {

          saveAs(new Blob([JSON.stringify(this.parcours)]), `${this.nom}.parcours`)

        },
        exporter: function () {

          if (this.is_licenced_app) {

            saveAs(new Blob([this.serialiser()]), `${this.nom}.fnmg`)

          }

        },
        serialiser: function () {
          return JSON.stringify({
            afficher_zones: this.afficher_zones,
            afficher_zone_active: this.afficher_zone_active,
            afficher_oreille: this.afficher_oreille,
            index_arriere_plan: this.index_arriere_plan,
            arrieres_plans: this.arrieres_plans,
            coords_oreille: this.get_coords_relatives_oreille(),
            gestion_bg: this.gestion_bg,
            nom: this.nom,
            sources: this.banque_locale.get_sources(),
            sourdine: this.sourdine,
            general_play: this.general_play,
            zones: _.map(this.zones, (zone) => {
              return this.serialiser_zone(zone);
            }),
            parcours: this.parcours
          });
        },

        serialiser_zone: function (zone) {
          let ff = this.get_fonofone(zone);

          return {
            id: zone.id,
            active: zone == this.zone_active,
            solo: zone == this.zone_solo,
            coords_ellipse: this.get_coords_relatives_ellipse(zone.ellipse),
            fonofone: ff ? ff.serialiser() : undefined
          };
        },

        importer_parcours: async function (fichier = ConfigurationParDefaut) {
          //En ce moment le parcours est importer via importer(), avec les autres paramètres
          this.parcours = await this.get_obj_config(fichier);
        },

        importer: async function (fichier = ConfigurationParDefaut) {

          // Charger l'archive
          let archive = await this.get_obj_config(fichier);

          // Arrieres-plans
          await this.charger_arrieres_plans(archive.arrieres_plans, archive.index_arriere_plan);
          this.gestion_bg = archive.gestion_bg;
          //let width = await this.changer_arriere_plan(archive.index_arriere_plan);

          // Initialisation
          let largeur = this.canva.width;
          let hauteur = this.canva.height;

          // Faire le menage
          _.each(this.zones, (zone) => { this.supprimer_zone(zone) });
          this.unset_zone_active();
          this.zone_solo = null;


          // Appliquer les configurations simples
          //Afficher les zones seulement en mode éditions
          if (this.presentation_edition) {
            this.afficher_zones = archive.afficher_zones;
            this.afficher_zone_active = !!archive.afficher_zone_active; // N'était pas dans la configuration avant
          } else {
            this.afficher_zones = false;
            this.afficher_zone_active = false;
          }

          // Creer la banque de sons
          this.banque_locale = new Banque(archive.sources);

          // Afficher le nom du fichier
          this.nom = archive.nom;

          // Sourdine generale
          this.set_sourdine(archive.sourdine);

          // Afficher et positionner l'oreille
          this.oreille.set('left', archive.coords_oreille.left * largeur);
          this.oreille.set('top', archive.coords_oreille.top * hauteur);
          this.oreille.setCoords();

          this.set_affichage_oreille(archive.afficher_oreille)

          // Creer les zones et les fonofones
          _.each(archive.zones, (zone) => {
            let coords_ellipse = zone.coords_ellipse;
            let z = this.ajouter_zone(
              coords_ellipse.x * largeur,
              coords_ellipse.y * hauteur,
              coords_ellipse.rx * largeur,
              coords_ellipse.ry * hauteur,
              coords_ellipse.angle,
              zone.fonofone ? JSON.parse(zone.fonofone) : undefined
            );

            if (zone.solo) this.toggle_solo(z);
            if (zone.active) this.afficher_zone(z);

            if (!this.presentation_edition) this.zone_active = null;

          });


          //importer parcours

          if (archive.parcours) {
            this.parcours = archive.parcours;
          }
          this.moduler_son_zones();
        },
        get_obj_config: async function (fichier) {

          let archive_serialisee = null;

          // Configuration par defaut
          if (fichier.constructor.name == "Object") return fichier;

          // Url distant
          else if (typeof fichier === "string") {
            await fetch(fichier).then((response) => {
              return response.text();
            }).then((archive) => {
              archive_serialisee = archive;
            });
          }

          // DEADCODE?
          else {
            archive_serialisee = await new Promise((resolve) => {
              let fileReader = new FileReader();
              fileReader.onload = (e) => resolve(fileReader.result);
              fileReader.readAsText(fichier);
            });
          }

          return JSON.parse(archive_serialisee);
        },

        // Arrieres-plans
        supprimer_arriere_plan: function (index_ap) {
          if (index_ap < this.index_arriere_plan) --this.index_arriere_plan;
          this.arrieres_plans.splice(index_ap, 1)
        },
        changer_arriere_plan: function (index_ap) {
          this.index_arriere_plan = index_ap;
          this.update_canva_size_and_bg(this.arrieres_plans[index_ap]);
        },

        charger_arrieres_plans: async function (aps, index_ap) {
          this.arrieres_plans = aps.length > 0 ? aps : ImagesParDefaut;
          this.index_arriere_plan = index_ap;
          await this.update_canva_size_and_bg(this.arrieres_plans[index_ap]);
        },

        update_canva_size_and_bg: async function (imageUrl) {

          let img;
          //Le loading de l'image requier un promise
          const imageLoadPromise = new Promise(resolve => {
            img = new Image();
            img.onload = resolve;
            img.src = imageUrl;

          });
          await imageLoadPromise;

          //Get size of browser window
          let windowWidth = window.innerWidth;
          let windowHeight = window.innerHeight;

          //Subtract the heigth of the menu if edition mode is on
          if (this.menu_visible)
            windowHeight -= 60;

          //make the image fit inside the window without being stretched or cropped
          let scale = Math.min(windowWidth / img.naturalWidth, windowHeight / img.naturalHeight);
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;

          //update the oreille    
          let coords_oreille = this.get_coords_relatives_oreille();
          this.oreille.set('left', coords_oreille.left * img.width);
          this.oreille.set('top', coords_oreille.top * img.height);
          this.oreille.setCoords();

          //Update ellipse relative positions of coords ellipse according to the new canvas size
          //This must be done before we update the canvas size in order to get the correct relative positions
          _.each(this.zones, (zone) => {

            let coords_ellipse = zone.ellipse;
            let largeur = this.canva.width;
            let hauteur = this.canva.height;
            let x = coords_ellipse.left / largeur;
            let y = coords_ellipse.top / hauteur;
            let rx = coords_ellipse.rx / largeur;
            let ry = coords_ellipse.ry / hauteur;
            let angle = coords_ellipse.angle;

            zone.ellipse.set({
              left: x * img.width,
              top: y * img.height,
              rx: rx * img.width,
              ry: ry * img.height,
              angle: angle
            });


            //update aCoords (Fabric.js) to reflect the new position of the ellipse and allow proper mixing of the sounds
            zone.ellipse.setCoords();

            //update the fonofone icon and the play icon
            zone.paint_menu();
            this.moduler_son_zone(zone);
          });

          //resize this.parcours according to the new canvas size
          for (let i = 0; i < this.parcours.length; i++) {
            let x = this.parcours[i][0];
            let y = this.parcours[i][1];
            this.parcours[i][0] = x * img.width / this.canva.width;
            this.parcours[i][1] = y * img.height / this.canva.height;

          }

          //resize the canvas according to the image size
          this.update_resol_canvas(img.width, img.height);

          fabric.Image.fromURL(imageUrl, (img2) => {
            // Scale the image to fit the canvas
            var scale = Math.max(
              this.canva.width / img2.width,
              this.canva.height / img2.height
            );
            img2.set({
              scaleX: scale,
              scaleY: scale,
              originX: 'left',
              originY: 'top'
            });
            // set the image as the background of the canvas
            this.canva.setBackgroundImage(img2, this.canva.renderAll.bind(this.canva));
          });

          //get zone that is solo
          if (this.zone_solo) {
            this.set_masque(this.get_coords_ellipse(this.zone_solo.ellipse));
          }
        },

        update_resol_canvas: function (width, height) {
          this.canva.setWidth(width);
          this.canva.setHeight(height);
          this.largeur = width;
          this.hauteur = height;
        },

        // UI
        afficher_zone: function (zone) {
          this.afficher_zone_active = true;
          this.set_zone_active(zone);
          this.$nextTick(() => {
            if (!zone.mounted) return;

            this.get_fonofone(zone).paint();
            this.placer_ff_minimise(zone);
          });
        },
        set_masque: function (coords) {
          let el = this.$refs.masque;
          let cx = coords.left + coords.width / 2;
          let cy = coords.top + coords.height / 2;
          let svg_masque = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.canva.width} ${this.canva.height}" preserveAspectRatio="none"><ellipse cx="${cx}" cy="${cy}" rx="${coords.rx}" ry="${coords.ry}" transform="rotate(${coords.angle} ${cx} ${cy})" fill="black" /></svg>'), linear-gradient(#fff,#fff)`;

          el.style.width = this.canva.width + 'px';
          el.style.height = this.canva.height + 'px';
          el.style['-webkit-mask-image'] = svg_masque; // Chrome / Safari
          el.style['mask-image'] = svg_masque; // FF
        },

        // Sessions
        toggle_session: function () {
          if (this.is_licenced_app) {

            if (this.mode.match(/wait/)) {

              clearInterval(this.session_wait_interval);
              this.session_wait_interval = null;
              clearTimeout(this.session_active_timeout);
              this.session_active_timeout = null;
              this.mode = "normal";

            } else if (this.mode == "session:active") {

              this.fin_session();

            } else {

              let i = 3;
              let self = this;
              this.mode = 'session:wait' + i;
              this.session_wait_interval = setInterval(
                function () {
                  i--;
                  self.mode = "session:wait" + i;
                },
                1000
              );

              this.session_active_timeout = setTimeout(
                function () {
                  clearInterval(self.session_wait_interval);
                  self.session_wait_interval = null;
                  self.debut_session();
                },
                3000
              );

            }

          }
        },

        debut_session: function () {
          this.mode = "session:active";
          this.get_enregistreur().debuter();
        },
        fin_session: function () {
          this.mode = "normal";
          this.get_enregistreur().terminer().then((blob) => {
            saveAs(blob, `session_${Date.now().toString()}.wav`)
          })
        },
        get_enregistreur: function () {
          if (!this.enregistrement.enregistreur) this.enregistrement.enregistreur = new Enregistreur(this.ctx_audio, this.media_stream_destination.stream);
          return this.enregistrement.enregistreur;
        },


        // Manipulation des zones
        supprimer_zone_active: function () {
          if (this.zone_active !== null) {
            this.supprimer_zone(this.zone_active);
            this.unset_zone_active();
          }
        },
        supprimer_zone: function (zone) {

          this.history.push("SUPPRIMER_ZONE", this.serialiser_zone(zone));

          this.canva.remove(zone.ellipse);
          this.canva.remove(zone.icone_fonofone);
          this.canva.remove(zone.icone_etat_jouer);

          if (zone == this.zone_solo) {
            this.zone_solo = null;
            _.each(this.zones, z => z.activer_son());
          }

          delete this.zones[zone.id];
        },

        // Controlleurs

        toggle_solo: function (zone) {

          // Enlever le masque
          if (this.zone_solo == zone) {
            _.each(this.zones, z => z.activer_son());
            this.zone_solo = null;
          }

          // Appliquer le masque
          else {
            _.each(this.zones, (z) => {
              if (z == zone) return; // si c'est la zone en question, on passe à l'autre zone

              this.get_fonofone(z).set_solo(false);

              z.desactiver_son();
            });

            // normalise le gain du son mis en solo
            zone.master.gain.setValueAtTime(1, this.ctx_audio.currentTime);

            this.zone_solo = zone;

            this.set_masque(this.get_coords_ellipse(zone.ellipse));
          }

          // Recalcule la modulation des sons pour prendre en compte le placement de l'oreille
          // (au cas où elle aurait été déplacée pendant le mode solo)
          this.moduler_son_zones();
        },

        update_mode: function (zone, mode) {
          zone.toggle_mode(mode);

          // pas besoin de moduler le son des autres zones car ils ne sont pas impactés par le changement de mode
          this.moduler_son_zone(zone);
        },

        toggle_ff_minimiser: function (zone, val) {

          if (val !== undefined) zone.minimiser = val;
          let ff = this.get_fonofone(zone);
          if (!ff) return;

          // Mode minimiser
          if (zone.minimiser) this.placer_ff_minimise(zone);

          // Mode maximiser
          else {
            ff.$el.style.left = 0;
            ff.$el.style.top = '@hauteur_menu';
          }

          this.$nextTick(ff.paint);
        },
        placer_ff_minimise: function (zone) {

          let ff = this.get_fonofone(zone);
          if (!ff) return;

          let ff_el = ff.$el;

          if (zone.ellipse.left < (this.canva.width / 2)) {
            ff_el.style.left = "initial";
            ff_el.style.right = 0;
          }
          else {
            ff_el.style.left = 0;
            ff_el.style.right = "initial";
          }
        },

        toggle_gestion_bg: function () { this.gestion_bg = !this.gestion_bg },

        switch_afficher_zones: function () {
          let zone_precedente = this.afficher_zones;

          // Détermine quelles zones à afficher
          // Ordre d'affichage des zones:
          // par défaut: true
          // 1er clique: "mix"
          // 2ieme clique: "pic"
          // 3ieme clique: false

          switch (zone_precedente) {
            case true:
              this.afficher_zones = "mix";
              break;
            case "mix":
              this.afficher_zones = "pic";
              break;
            case "pic":
              this.afficher_zones = false;
              break;
            case false:
              this.afficher_zones = true;
              break;
            default:
              this.afficher_zones = true;
          }

          _.each(
            this.zones,
            (zone) => {
              zone.toggle_visibilite(this.afficher_zones);
            }
          );
          this.unset_zone_active();
          this.canva.discardActiveObject();
        },

        toggle_affichage_oreille: function () { this.set_affichage_oreille(!this.afficher_oreille); },
        set_affichage_oreille: function (valeur) {
          this.afficher_oreille = valeur;
          this.oreille.visible = valeur;
          this.oreille.selectable = valeur;
          this.canva.renderAll();
        },



        multi_click: function () {

          clearTimeout(this.click_timeout);

          let that = this;
          this.click_timeout = setTimeout(() => {
            that.click_count = 0;
          }, 1000);

          if (this.click_count >= 3) {
            this.handleQuadClick();
            this.click_count = 0;
            clearTimeout(this.click_timeout);
          }

          this.click_count++;

        },


        toggle_sourdine: function () { this.set_sourdine(!this.sourdine) },
        set_sourdine: function (val) {
          this.sourdine = val;
          this.master.gain.setValueAtTime(this.sourdine ? 0 : 1, this.ctx_audio.currentTime);
        },

        toggle_pleinecran: function () {
          var elem = document.documentElement;
          if (this.pleinecran) {
            this.menu_visible = true;
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
              document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
              document.msExitFullscreen();
            }
          } else {
            //if going to fullscreen, hide the menu
            this.menu_visible = false;
            if (elem.requestFullscreen) {
              elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { /* Safari */
              elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { /* IE11 */
              elem.msRequestFullscreen();
            }
          }
          this.pleinecran = !this.pleinecran;

          //and resize the canvas to fit the screen
          this.update_canva_size_and_bg(this.arrieres_plans[this.index_arriere_plan]);
        },

        get_oreille_icon: function () {
          if (this.afficher_oreille) {
            return Oreille;
          } else {
            return OreilleOff;
          }
        },

        toggle_more_features: function () {
          this.more_features_ouvert = !this.more_features_ouvert;
        },

        toggle_menu_parcours: function () {
          this.menu_parcours_ouvert = !this.menu_parcours_ouvert;
        },

        toggle_general_play: function () {

          switch (this.general_play) {

            case true:
            case "partial":
              this.set_general_play(false);
              break;

            default:
              this.general_play = true;
              this.set_general_play(true);
              break;

          }

        },
        check_general_play: function () {

          let playing_sounds = 0;
          let mute_sounds = 0;

          _.each(this.zones, (zone) => {

            if (zone.etat_jouer) {

              playing_sounds++;

            } else {

              mute_sounds++;

            }
          });

          if (
            playing_sounds > 0
            &&
            mute_sounds > 0
          ) {
            // on veut juste modifier l'icône donc pas besoin de passer par set_general_play 

            this.general_play = "partial";

          } else {
            // réinitialise la variable

            if (playing_sounds == 0) {

              this.general_play = false;

            } else if (mute_sounds == 0) {

              this.general_play = true;

            }
          }

        },
        get_general_play_icon: function () {

          switch (this.general_play) {

            case true:
              return PauseGeneral;

            case "partial":
              return PartialPlay;

            default:
              return PlayGeneral;

          }

        },
        set_general_play: function (val) {

          //resume audio context
          if (this.ctx_audio.state === 'suspended') {
            this.ctx_audio.resume();
          }
          this.general_play = val;

          this.moduler_son_zones();

          if (this.general_play) {
            _.each(this.zones, (zone) => {

              zone.set_etat_jouer(true);

              this.get_fonofone(zone).jouer();

            });
          } else {
            _.each(this.zones, (zone) => {

              zone.set_etat_jouer(false);

              this.get_fonofone(zone).arreter()

            });
          }
        },
        toggle_parcours_play: function () {

          switch (this.parcours_play) {

            case true:
              this.parcours_play = false;
              break;

            case false:
              if (this.parcours_record) this.toggle_record_parcours();
              this.play_parcours();
              this.parcours_play = true;
              break;

          }


        },

        toggle_parcours_loop: function () {
          this.parcours_play_loop = !this.parcours_play_loop;
        },

        parcours_rewind: function () {
          this.play_parcours_index = 0;
          if (!this.parcours_play) {
            this.parcours_prevoir();
          }
        },

        moduler_son_zones: function () {
          // Use requestAnimationFrame for a throttled update
          if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
              _.each(this.zones, (z) => { this.moduler_son_zone(z) });
              this.animationFrameId = null; // Reset the animation frame ID
            });
          }
        },

        moduler_son_zone: function (zone) {
          // Use requestAnimationFrame for a throttled update
          if (!zone.animationFrameId) {
            zone.animationFrameId = requestAnimationFrame(() => {
              // Reset animation frame ID before the actual update
              zone.animationFrameId = null;

              // Your update logic for the specific zone goes here
              // Seulement le mode mix et si le fonoimage n'est pas en mode solo
              //if (zone.mode == 'mix' && !this.zone_solo) {
              //Retirer la condition pour que le son soit modulé même si le fonoimage est en mode solo
              if (zone.mode == 'mix') {
                let coords_oreille = { x: this.oreille.left, y: this.oreille.top }; // Centree a son origine
                let coords_zone = { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 };
                let proximite = proximite_centre_ellipse(coords_oreille, zone.ellipse);

                //zone.master.gain.setValueAtTime(proximite, this.ctx_audio.currentTime);

                let rampDuration = 0.05; // Adjust as needed
                zone.master.gain.linearRampToValueAtTime(proximite, this.ctx_audio.currentTime + rampDuration);
                this.get_fonofone(zone).set_reverb_sub_master(proximite);


                //Stop sound if the zone is not in the listening area
                if (proximite == 0 && this.get_fonofone(zone).get_is_playing()) {

                  this.get_fonofone(zone).arreter();
                }
                else if (proximite > 0 && !this.get_fonofone(zone).get_is_playing()) {

                  this.get_fonofone(zone).jouer();

                }

              }
            });
          }
        },

        // Gestion des zones
        dessiner_nouvelle_zone: function (options) {

          // Initialisation des variables de scope
          let init_options = options;
          let init_event = options.e;
          let coords = [{
            x: options.absolutePointer.x,
            y: options.absolutePointer.y
          }];

          // Creer a la fin du drag
          this.canva.on('mouse:up', (options) => {
            this.canva.setCursor("default");

            this.canva.off('mouse:move');
            this.canva.off('mouse:up');

            coords.push({
              x: options.absolutePointer.x,
              y: options.absolutePointer.y
            });

            // Si on a pas assez bougé
            if (Math.abs(coords[0].x - coords[1].x) > TOLERANCE_MIN_ZONE || Math.abs(coords[0].y - coords[1].y) > TOLERANCE_MIN_ZONE) {
              this.ajouter_zone(
                (coords[0].x + coords[1].x) / 2, // x
                (coords[0].y + coords[1].y) / 2, // y
                Math.abs(coords[0].x - coords[1].x) / 2, // rayon width
                Math.abs(coords[0].y - coords[1].y) / 2// rayon height
              );
            }

            this.adding_zone = false;
          });
        },

        ajouter_zone: function (x, y, rx, ry, angle = 0, fonofone = ConfigurationFonofoneParDefaut) {
          // #UNDO
          //console.log("Ajout d'une zone", fonofone);
          fonofone = _.cloneDeep(fonofone); // Necessaire pour separer les instances

          let is_visible = false;
          if (
            this.afficher_zones == true
            ||
            this.afficher_zones == fonofone.parametres.mode
          ) {
            is_visible = true;
          }

          // Creation
          let zone = new Zone({
            id_fonoimage: this.id,
            x, y, rx, ry, angle,
            mode: fonofone.parametres.mode,
            etat_jouer: fonofone.parametres.jouer,
            visible: is_visible,
            ctx_audio: this.ctx_audio,
            canva: this.canva,
            master_fonoimage: this.master,
            on_selected: (zone) => {
              // TODO verifier que la zone est active, sinon ne pas afficher.
              if (this, this.adding_zone) return;
              this.zone_active = zone;
              this.$nextTick(() => {
                this.toggle_ff_minimiser(zone);
                this.placer_ff_minimise(zone);
              });
            },
            on_moving: (zone, donnees) => {

              this.history.push("DEPLACER_ZONE", donnees);
              // #UNDO
              this.set_masque(this.get_coords_ellipse(zone.ellipse));
              this.moduler_son_zone(zone);
              if (zone.minimiser) this.placer_ff_minimise(zone);

            },
            on_toggle_play: (zone) => { this.get_fonofone(zone).toggle_pause(true) },
            on_toggle_fonofone: (zone, was_moving) => {
              let fonofone_has_to_be_opened = false; // considérant que false est que le fonofone doit être fermé

              // Si elle est deja ouverte
              if (this.zone_active == zone && this.afficher_zone_active) {
                fonofone_has_to_be_opened = false;
              }
              // Sinon
              else {
                fonofone_has_to_be_opened = true;
              }

              if (was_moving) {
                fonofone_has_to_be_opened = !fonofone_has_to_be_opened;
              }

              if (fonofone_has_to_be_opened) {
                this.afficher_zone(zone);
              } else {
                this.afficher_zone_active = false;
              }

            },
            dupliquer: (zone) => {

              // Met à jour les configurations du fonofone de la zone dupliquée
              let ff = this.get_fonofone(zone);
              _.assign(ff.configuration.parametres, ff.$refs.mixer.serialiser());

              this.ajouter_zone(
                zone.ellipse.left,
                zone.ellipse.top,
                zone.ellipse.rx,
                zone.ellipse.ry,
                zone.ellipse.angle,
                zone.configuration_fonofone
              );
            },
            update_general_play: () => {
              this.check_general_play();
            }
          }, fonofone);

          // Mise en service
          this.zones[zone.id] = zone;
          this.set_zone_active(zone);

          this.moduler_son_zone(zone);
          this.$nextTick(() => { this.canva.discardActiveObject(); });

          if (this.zone_solo) zone.desactiver_son();

          this.history.push("AJOUTER_ZONE", this.serialiser_zone(zone));

          return zone;
        },
        set_etat_zone_active: function (zone, etat) {
          this.moduler_son_zone(zone);
          zone.set_etat_jouer(etat);

          this.$nextTick(() => {
            this.check_general_play();
          });

        },
        unset_zone_active: function () {
          this.zone_active = null;
          this.afficher_zone_active = false;
        },
        set_zone_active: function (zone) {
          this.zone_active = zone;
          this.$nextTick(() => {
            if (zone.minimiser) this.placer_ff_minimise(zone);
          })
        },

        // Outils
        get_fonofone: function (zone) {
          try {
            return this.$refs[zone.id][0];
          } catch { return undefined } // Si on a jamais cliquer sur la zone
        },
        get_coords_relatives_oreille: function () {
          let aCoords = this.oreille.aCoords;

          return {
            left: ((aCoords.tl.x + aCoords.br.x) / 2) / this.canva.width,
            top: ((aCoords.tl.y + aCoords.br.y) / 2) / this.canva.height
          };
        },
        get_coords_ellipse: function (ellipse) {
          let coords = ellipse.getBoundingRect();

          coords.angle = ellipse.angle;
          coords.rx = ellipse.rx;
          coords.ry = ellipse.ry;

          return coords;
        },
        get_coords_relatives_ellipse: function (ellipse) {

          // Canva
          let largeur = this.canva.width;
          let hauteur = this.canva.height;

          // Coordonnees
          let coords = {
            x: (ellipse.aCoords.tl.x + ellipse.aCoords.br.x) / 2,
            y: (ellipse.aCoords.tl.y + ellipse.aCoords.br.y) / 2
          }

          coords.angle = ellipse.angle;
          coords.rx = ellipse.rx;
          coords.ry = ellipse.ry;

          // Relativiser
          coords.x /= largeur;
          coords.rx /= largeur;

          coords.y /= hauteur;
          coords.ry /= hauteur;

          return coords;
        },
        get_sources_par_defaut: function () {
          return SourcesParDefaut
        },
        toggle_record_parcours: function () {

          if (this.parcours_record == false) {
            if (this.parcours_play) {
              this.toggle_parcours_play();
            }

            // reset parcours précédent
            this.parcours = [];
            this.oreille.onMovingOffset = [];
            //this.saving_parcours_init_time = performance.now();
            this.play_parcours_reverse = false;

          }
          else {
            //this.mode = "session:normal";
          }

          this.parcours_record = !this.parcours_record;

        },
        play_parcours: function () {
          //this.play_parcours_reverse = false;
          if (this.parcours.length > 0) {

            this.parcours_prevoir();

          }

        },

        parcours_prevoir: function () {
          let index = this.play_parcours_index;

          if (index < this.parcours.length) {

            let x = this.parcours[index][0];
            let y = this.parcours[index][1];
            let delay = 0;

            if (index != 0) {
              let thisTimestamp = this.parcours[index][2];
              let prevTimestamp = this.parcours[index - 1][2];
              delay = thisTimestamp - prevTimestamp;
            }
            setTimeout(this.parcours_placer, delay, x, y);
            this.play_parcours_index++;
          } else {

            this.play_parcours_index = 0;

            if (!this.parcours_play_loop) {
              this.parcours_play = false;
            }
            else {
              this.parcours_prevoir();
            }

          }

        },

        parcours_placer: function (x, y) {

          this.oreille.set('left', x);
          this.oreille.set('top', y);
          this.oreille.setCoords();
          this.canva.renderAll();
          this.moduler_son_zones(this.oreille);
          if (this.parcours_play) {
            this.parcours_prevoir();
          }

        }

      },
      computed: {
        donnees_integration: function () { return { banque: this.banque_locale, type: 'fonoimage' } }
      },
      created: function () { // hook https://vuejs.org/guide/essentials/lifecycle.html

        //console.log('Fonoimage Params:', this.params);


        // Undo / Redo
        this.history.add_type_action("AJOUTER_ZONE",
          (zone_serialisee) => {
            let largeur = this.canva.width;
            let hauteur = this.canva.height;

            let zone = this.ajouter_zone(
              zone_serialisee.coords_ellipse.x * largeur,
              zone_serialisee.coords_ellipse.y * hauteur,
              zone_serialisee.coords_ellipse.rx * largeur,
              zone_serialisee.coords_ellipse.ry * hauteur,
              zone_serialisee.coords_ellipse.angle,
              zone_serialisee.fonofone ? JSON.parse(zone_serialisee.fonofone) : undefined
            );

            zone_serialisee.id = zone.id;

            _.each(this.history.actions, (action) => {
              if (action.donnees.id && action.donnees.id == zone_serialisee.id)
                action.donnees.id = zone.id;
              if (action.donnees.zone && action.donnees.zone.id == zone_serialisee.id) action.donnees.zone.id = zone.id;
            })
          },
          (zone_serialisee) => {
            let zone = _.find(this.zones, { id: zone_serialisee.id });
            if (zone === undefined) throw new Error("Error in redo AJOUTER_ZONE")
            this.supprimer_zone(zone);
          });

        this.history.add_type_action("SUPPRIMER_ZONE",
          (zone_serialisee) => {
            let zone = _.find(this.zones, { id: zone_serialisee.id });
            if (zone === undefined) throw new Error("Error in undo SUPPRIMER_ZONE")
            this.supprimer_zone(zone);
          },
          (zone_serialisee) => {

            let largeur = this.canva.width;
            let hauteur = this.canva.height;

            let zone = this.ajouter_zone(
              zone_serialisee.coords_ellipse.x * largeur,
              zone_serialisee.coords_ellipse.y * hauteur,
              zone_serialisee.coords_ellipse.rx * largeur,
              zone_serialisee.coords_ellipse.ry * hauteur,
              zone_serialisee.coords_ellipse.angle,
              zone_serialisee.fonofone ? JSON.parse(zone_serialisee.fonofone) : undefined
            );

            _.each(this.history.actions, (action) => {
              if (action.donnees.id && action.donnees.id == zone_serialisee.id)
                action.donnees.id = zone.id;
              if (action.donnees.zone && action.donnees.zone.id == zone_serialisee.id) action.donnees.zone.id = zone.id;
            })
          });

        this.history.add_type_action("DEPLACER_ZONE",
          (donnees) => {
            let zone = _.find(this.zones, (z) => { return z.id == donnees.zone.id });

            if (zone === undefined) throw new Error("Undos/Redos messed up the zone id. id cannot be restored")

            zone.ellipse.set("top", donnees.destination.top);
            zone.ellipse.set("left", donnees.destination.left);
            zone.ellipse.set("angle", donnees.destination.angle);

            if (donnees.original.rx) {
              zone.ellipse.set("rx", donnees.original.rx);
            }

            if (donnees.original.ry) {
              zone.ellipse.set("ry", donnees.original.ry);
            }

            zone.ellipse.setCoords();
            zone.paint_menu();
            this.canva.renderAll();
          },
          (donnees) => {
            let zone = _.find(this.zones, (z) => { return z.id == donnees.zone.id });

            if (zone === undefined) throw new Error("Undos/Redos messed up the zone id. id cannot be restored")

            zone.ellipse.set("top", donnees.original.top);
            zone.ellipse.set("left", donnees.original.left);
            zone.ellipse.set("angle", donnees.original.angle);

            if (donnees.original.rx) {
              zone.ellipse.set("rx", donnees.original.rx);
            }

            if (donnees.original.ry) {
              zone.ellipse.set("ry", donnees.original.ry);
            }

            zone.ellipse.setCoords();
            zone.paint_menu();
            this.canva.renderAll();
          });

        // Raccourcis clavier
        let clavier_listener = new ClavierListener();
        clavier_listener.register("s", this.exporter);
        clavier_listener.register("z", this.undo);
        clavier_listener.register("y", this.redo);
        clavier_listener.register("Backspace", this.supprimer_zone_active);


        // Diagramme audio
        this.master = this.ctx_audio.createGain();
        this.media_stream_destination = this.ctx_audio.createMediaStreamDestination();

        this.master.connect(this.ctx_audio.destination);
        this.master.connect(this.media_stream_destination);

        //Reverb
        this.reverb = this.ctx_audio.createConvolver();
        this.reverb.normalize = true;

        fetch(ImpulseGrand).then((response) => {
          return response.arrayBuffer();
        }).then((buffer) => {
          this.ctx_audio.decodeAudioData(buffer, (audioBuffer) => {
            this.reverb.buffer = audioBuffer;
            //this.$forceUpdate();
          });
        });



        //console.log(`fonoimage.js: reverb node: ${this.reverb}`)


        //send master to reverb

        /* this.master.connect(this.reverb);
        this.reverb.connect(this.ctx_audio.destination); */

        // just create a reverb node and connect to master
        this.reverb.connect(this.master);




        this.banque_locale = new Banque(this.get_sources_par_defaut());
      },
      mounted: function () { // hook https://vuejs.org/guide/essentials/lifecycle.html
        // Filepond
        this.init_filepond(this.$refs.filepond_archive, (fichier) => {

          if (fichier.fileExtension == "fnmg" || fichier.fileExtension == "fnpr") { this.importer(fichier.file); }
          else { throw "type de fichier non valide"; }

          this.mode_importation = false;
        });

        this.init_filepond(this.$refs.filepond_image, (image) => {

          if (image.fileType.match(/image/)) {
            this.arrieres_plans.push(image.getFileEncodeDataURL());
          }
          else { throw "Type de fichier non valide"; }

          this.mode_importation = false;
        })

        // Créer le canvas
        let application = this.$refs.application_fonoimage;

        //Si en mode presentation on change le comportement du canvas
        if (this.presentation_edition) {
          this.canva = new Fabric.Canvas('canva-fonoimage-' + this.id, {
            hoverCursor: 'pointer',
            width: application.offsetWidth,
            height: application.offsetHeight

          }).on('mouse:down', (options) => {
            this.canva.setCursor("cell");

            // Si on ne clique pas sur un élément (zone, oreille, ou autre)
            if (!options.target) {
              this.adding_zone = true;
              this.gestion_bg = false;
              this.unset_zone_active();
              this.dessiner_nouvelle_zone(options);

            }
          });
        } else {
          this.canva = new Fabric.Canvas('canva-fonoimage-' + this.id, {
            width: application.offsetWidth,
            height: application.offsetHeight
          });



        }
        //Not needed, the background is set in the importer function
        //Could be useful if we want a loading background
        /* 
        fabric.Image.fromURL(BackgroundTemp, (img2) => {
          // Scale the image to fit the canvas
          var scale = Math.max(
            this.canva.width / img2.width,
            this.canva.height / img2.height
          );
          img2.set({
            scaleX: scale,
            scaleY: scale,
            originX: 'left',
            originY: 'top'
          });

          // Add the image to the canvas
          this.canva.setBackgroundImage(img2, this.canva.renderAll.bind(this.canva), {
            backgroundImageOpacity: 1, // Set the background image opacity to 1
            backgroundImageStretch: false
          });
          this.canva.renderAll();
        });
        */

        // Creer l'oreille
        new Fabric.Image.fromURL(Oreille, (oreille) => {
          this.oreille = oreille;
          //don't show rectangle around the image
          oreille.hasBorders = false;
          oreille.originX = "center";
          oreille.originY = "center";
          oreille.set('left', this.canva.width / 2);
          oreille.set('top', this.canva.height / 2);
          oreille.setCoords();
          oreille.onMovingOffset = [];
          oreille.on('moving', (ev) => {

            // Limiter deplacement
            let target = ev.transform.target;
            this.oreille.set('left', Math.min(this.canva.width, Math.max(0, target.left)));
            this.oreille.set('top', Math.min(this.canva.height, Math.max(0, target.top)));

            // enregistre le parcours
            if (this.parcours_record) {

              // calcule le offset du centre de l'oreille par rapport à la position du curseur (car on ne peut prendre que la position du curseur pour avoir des coords updatées)
              if (this.oreille.onMovingOffset.length === 0) {
                // this.oreille.oCoords.mb.x & this.oreille.oCoords.ml.y sont le milieu de l'oreille
                let offset_x = ev.pointer.x - this.oreille.oCoords.mb.x;
                let offset_y = ev.pointer.y - this.oreille.oCoords.ml.y;
                this.oreille.onMovingOffset = [offset_x, offset_y];

              }

              let true_path_x = ev.pointer.x - this.oreille.onMovingOffset[0];
              let true_path_y = ev.pointer.y - this.oreille.onMovingOffset[1];
              let deltaTime = performance.now();
              this.play_parcours_index = 0;
              this.parcours.push(
                [
                  true_path_x,
                  true_path_y,
                  deltaTime
                ]
              );
            }

            this.moduler_son_zones(ev);
          });
          oreille.on('selected', (options) => { this.moduler_son_zones(options); this.multi_click(); });

          // Empecher le resize
          oreille.hasControls = false;
          this.canva.add(oreille);

          //hide oreille for now because canvas size is not set yet
          this.set_affichage_oreille(false);

          // Lancer l'application
          this.importer(this.archive);

          //listen to browser's window resize
          window.addEventListener('resize', () => this.handleBrowserResize());
          window.addEventListener('fullscreenchange', () => this.handleExitFullscreen(document.fullscreenElement));

        });

      },
      template: `
      <div class="fonoimage" ref="fonoimage">
        
      
        <div class="panneau-fonoimage">
          <menu v-show="menu_visible">
            <div class="gauche">
            <div v-if="presentation_edition && !is_embedded_app" id="menu_more_features_wrapper" :class="{background_submenu: more_features_ouvert}">
            <div v-if="more_features_ouvert" class="menu_more_features_subwrapper">
              <img src="${Undo}" class="more_features_sub_btn" @click="undo" />
              <img src="${Redo}" class="more_features_sub_btn" @click="redo" />
            </div>
            <img v-if="!is_embedded_app" src="${VerticalDots}" class="more_features_btn" @click="toggle_more_features" v-on-clickaway="away"/>
          </div>
          <img v-if="presentation_edition" src="${Images}" class="background_btn invert" @click="toggle_gestion_bg"/>
              <img v-if="!is_embedded_app" :src="pleinecran ? '${Minimiser}' : '${Maximiser}'" class="pleinecran invert" @click="toggle_pleinecran"/>
              <img v-if="presentation_edition" :src="get_eye_icon(afficher_zones)" class="oeil" :class="{inverted: (afficher_zones == true) || !afficher_zones}" @click="switch_afficher_zones"/>
              <img v-if="presentation_edition" :src="sourdine ? '${HautParleur}' : '${HautParleurActif}'" class="hp" @click="toggle_sourdine"/>
              <img :src="get_general_play_icon()" class="play_general" @click="toggle_general_play"/>
              <div v-if="presentation_edition" id="record_btn" :class="{demo: !(is_licenced_app), actif: mode == 'session:active', wait3: mode == 'session:wait3', wait2: mode == 'session:wait2', wait1: mode == 'session:wait1'}" @click="toggle_session">
                <div id="record_btn_bkg">
                  <div id="record_btn_light">
                    <div id="record_btn_light_active"></div>
                  </div>
                </div>
              </div>
              <img v-if="presentation_edition" :src="get_oreille_icon()" class="oreille actif" @click="toggle_affichage_oreille"/>
              <div v-if="presentation_edition" id="menu_parcours_wrapper" :class="{background_submenu: menu_parcours_ouvert}" >
                <div v-if="menu_parcours_ouvert" class="menu_parcours_subwrapper">
                  <img :src="parcours_record ? '${ParcoursRecordOn}' : '${ParcoursRecordOff}'" class="parcours_record_btn" @click="toggle_record_parcours" />
                  <img :src="parcours_play ? '${ParcoursPlayOn}' : '${ParcoursPlayOff}'" class="parcours_record_btn" @click="toggle_parcours_play" />
                  <img src="${ParcoursPlayRewind}" class="parcours_record_btn" @click="parcours_rewind" />
                  <img :src="parcours_play_loop ? '${ParcoursLoopOn}' : '${ParcoursLoopOff}'" class="parcours_record_btn" @click="toggle_parcours_loop" />
                </div>
                <img :src="menu_parcours_ouvert ? '${ParcoursOuvert}' : '${ParcoursFerme}'" class="menu_parcours_ferme" @click="toggle_menu_parcours" />
              </div>
              <img  class="invert poubelle" :class="{actif: zone_active}" @click="supprimer_zone_active" src="${Poubelle}"/>
              <img v-if="false" src="${Fonofone}" class="ff_par_defaut" :class="{actif: zone_active}" @click="definir_fonofone_par_defaut"/>
            </div>
            <div class="milieu">
              <input type="text" v-model="nom" class="texte-nom-fonoimage" placeholder="Fonoimage" />
            </div>
            <div v-if="!is_embedded_app" class="droite">
              <img src="${Export}" v-if="presentation_edition" :class="{demo: !(is_licenced_app)}" @click="exporter"/>
              <img src="${Import}" :class="{demo: !(is_licenced_app)}" @click="mode_importation_fn"/>
            
            </div>
          </menu>
          <section class="principal">
          <div class="gestion-arriere-plan" :class="{actif: gestion_bg}" ref="gestion_arriere_plan">
          <h3 class="entete">
            <img src="${Images}" @click="toggle_gestion_bg"/>
            <span>{{ $t('arriereplan') }}</span>
          </h3>
          <div class="container-arrieres-plans">
            <div v-for="(_, index) in arrieres_plans" class="img" :style="{'background-image': 'url(' + arrieres_plans[index] + ')'}" @click="changer_arriere_plan(index)">
              <img v-show="index_arriere_plan != index" src="${Poubelle}" class="suppression" @click.stop="supprimer_arriere_plan(index)"/>
            </div>
          </div>
          <h3 class="entete">Importer une image</h3>
          <div class="importation-images" ref="filepond_image"></div>
          </div>
          <div class="app-fonoimage" ref="application_fonoimage">
              <canvas :id="'canva-fonoimage-' + id" ref="canva_fonoimage"></canvas>
            </div>
            <div class="pellicule" :class="{actif: zone_solo}" ref="masque"></div>

            <div class="panneau-importation" :class="{actif: mode_importation}">
              <div class="fenetre" ref="filepond_archive"></div>
            </div>
          </section>
        </div>
        
        <fonofone v-for="(zone, key) in zones" :class="{minimiser: zone.minimiser, affiche: (zone == zone_active) && afficher_zone_active}" 
          :id="key" :ref="key" :key="key" 
          :ctx_audio="ctx_audio" 
          :noeud_sortie="zone.master" 
          :integration="donnees_integration"
          :archive="zone.configuration_fonofone" 
          @update:mode="update_mode(zone, $event)" 
          @update:minimiser="toggle_ff_minimiser(zone, $event)" 
          @update:solo="toggle_solo(zone, $event)" 
          @update:etat:jouer="set_etat_zone_active(zone, $event)"
          @mounted="zone.mounted = true" 
        >
        </fonofone>
      </div>`
    });
  }
}

function theta(x, y) {
  return Math.atan2(y, x);
}

function cartesian2Polar(x, y) {
  return { distance: Math.sqrt(x * x + y * y), radians: Math.atan2(y, x) };
}

function rad2deg(rad) {
  return rad * 180 / Math.PI;
}

function deg2rad(deg) {
  return deg * Math.PI / 180;
}

function distance_euclidienne(point) {
  return Math.sqrt(Math.pow(point.x, 2) + Math.pow(point.y, 2));
}

function proximite_centre_ellipse(coords_oreille, ellipse) {

  // Initialisation
  let coords_ellipse = ellipse.aCoords;
  let centre = { x: (coords_ellipse.tl.x + coords_ellipse.br.x) / 2, y: (coords_ellipse.tl.y + coords_ellipse.br.y) / 2 };

  // Enlever la rotation
  let oreille_sans_rotation = annuler_rotation(ellipse.angle, centre, coords_oreille);

  // Calculer l'angle entre le centre et le curseur
  let oreille_sans_rotation_normalise = { x: oreille_sans_rotation.x - centre.x, y: oreille_sans_rotation.y - centre.y };
  let theta_oreille_sans_rotation = theta(oreille_sans_rotation_normalise.x, oreille_sans_rotation_normalise.y);

  // Calculer les x et y max pour l'angle donne
  let coord_max = { x: ellipse.rx * Math.cos(theta_oreille_sans_rotation), y: ellipse.ry * Math.sin(theta_oreille_sans_rotation) };
  let distance_max = distance_euclidienne(coord_max);

  // Calculer la distance entre le centre et les x/y max
  let distance_pointeur = distance_euclidienne(oreille_sans_rotation_normalise);

  return 1 - Math.min(distance_pointeur / distance_max, 1);
}

function annuler_rotation(angle, centre, obj) {

  // Cartesien en polaire
  let polaire = cartesian2Polar(obj.x - centre.x, obj.y - centre.y);

  // Annuler rotation
  polaire.radians -= angle * Math.PI / 180;

  // polaire en cartesien
  return { x: polaire.distance * Math.cos(polaire.radians) + centre.x, y: polaire.distance * Math.sin(polaire.radians) + centre.y };
}

Vue.directive('quad-click', {
  bind: function (el, binding) {
    let clicks = 0;
    let timeout;
    /**
     * Event handler for click events.
     * Increments the `clicks` counter and performs an action when `clicks` reaches 4.
     * Resets the `clicks` counter if no additional clicks occur within 500 milliseconds.
     */
    const handler = () => {
      clicks++;
      if (clicks === 4) {
        binding.value();
        clicks = 0;
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          clicks = 0;
        }, 500);
      }
    };
    el.addEventListener('click', handler);
  }
});


