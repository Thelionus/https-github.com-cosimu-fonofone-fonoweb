import Vue, { inject } from 'vue';
import _ from 'lodash';
import { saveAs } from 'file-saver';
import toWav from 'audiobuffer-to-wav';
import WaveSurfer from 'wavesurfer.js';
import Regions from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';

import { blob2base64, convertURIToBinary } from '../utils.js';
import Filepond from '../lib/filepond.js';
import Enregistreur from '../lib/enregistreur.js';

import { SonParDefaut } from './donnees/son_par_defaut.js';

import Banque from '../banque.js';
import Mixer from './mixer.js';

import Filtre from './modules/filtre.js';
import Metronome from './modules/metronome.js';
import Reverberation from './modules/reverberation.js';
import Selecteur from './modules/selecteur.js';
import Volume from './modules/volume.js';
import Vitesse from './modules/vitesse.js';
import Arpegiateur from './modules/arpegiateur.js';

// Configuration de base pour l'application
import Globales from './globales.js';

// Icones
import './style.less';
import Record from '../images/record.svg';
import Reload from '../images/reload.png';
import Folder from '../images/icon-folder.svg';
import FlecheDroite from '../images/fleche-droite.svg';
import Poubelle from '../images/trash.svg';
import Export from '../images/export.svg';
import Import from '../images/folder-open.svg';
import Micro from '../images/micro.svg';
import ModeMix from '../images/mode-mix.svg';
import ModePic from '../images/mode-pic.svg';
import Maximiser from '../images/maximiser.svg';
import Minimiser from '../images/minimiser.svg';
import Main from '../images/main.png';
import Jouer from '../images/jouer.svg';
import JouerActif from '../images/jouer-actif.svg';

// Traduction
import VueI18n from 'vue-i18n';
import i18n from './traductions.js';
Vue.use(VueI18n);

// Son par defaut
import ConfigurationParDefaut from './configurations/defaut.fnfn';


const max_width_colonne = 305;



export default {
  inject: ['params', 'getReverb'],
  mixins: [Filepond],
  components: {
    "mixer": Mixer,
    "filtre": Filtre,
    "metronome": Metronome,
    "reverberation": Reverberation,
    "selecteur": Selecteur,
    "volume": Volume,
    "vitesse": Vitesse,
    "arpegiateur": Arpegiateur
  },
  props: ['id', 'archive', 'ctx_audio', 'noeud_sortie', 'integration'],



  data: function () {


    return {
      en_importation: false,
      banque_locale: null,
      configuration: { parametres: {} }, // Donnees permanentes
      ecran: "normal",
      enregistrement: { encours: false, enregistreur: null },
      filepond: null,
      mixer_layout: "ligne",
      en_ecoute_source: {
        id_source_active: null,
        audio: null
      },
      wait_mode: 'inactive',
      session_active_timeout: null,
      session_wait_interval: null,
      is_licenced_app: (typeof is_licenced_user !== 'undefined' && !!is_licenced_user), // vérifie si la licence est présente
      enabledModules: {},
    };
  },
  i18n,
  methods: {

    validateUrlParams : function () {
      //console.log('Validating URL Params');
      //console.log('params',this.params);
      const getValue = (paramValue, paramName) => {
        const v = paramValue === undefined || paramValue !== 'false'
        console.log({
          paramName,
          received:paramValue,
          validated:v        
        });
        return v
      };
      const p = {
        volume: getValue(this.params.volume, "Volume"),
        selecteur: getValue(this.params.selecteur, "Selecteur"),
        vitesse: getValue(this.params.vitesse, "Vitesse"),
        filtre: getValue(this.params.filtre, "Filtre"),
        reverberation: getValue(this.params.reverberation, "Reverberation"),
        metronome: getValue(this.params.metronome, "Metronome"),
        arpegiateur: getValue(this.params.arpegiateur, "Arpegiateur"),

      };
      this.enabledModules = p;
      return p
    },
    

    // IMPORT / EXPORT
    exporter: function () {

      if (this.is_licenced_app) {
        saveAs(new Blob([this.serialiser()]), `${this.configuration.parametres.nom}.fnfn`)
      }

    },
    serialiser: function () {
      return JSON.stringify({
        parametres: _.assign(this.configuration.parametres, this.$refs.mixer.serialiser()),
        modules: this.configuration.modules,
        banque: this.integration ? null : this.banque_locale.get_sources()
      });
    },
    importer: async function (fichier) {

      this.en_importation = true;
      if (!fichier) fichier = _.cloneDeep(ConfigurationParDefaut);

      // Obtenir et setter la configuration
      this.configuration = await this.get_obj_config(fichier);
      //console.log('Configuration', Object.keys(this.configuration.modules));

      //console.log('Configuration - modules', Object.keys(this.configuration.modules));
for (let key in this.configuration.modules) {
  //console.log('key',key);
  //console.log(this.enabledModules[key]);
  //console.log(this.enabledModules[key] == true ? 'activation' : 'désactivation');

          if (!this.enabledModules[key] == true) {delete this.configuration.modules[key]};
        
      };
     

     
      



      // Initialiser la banque de son, integree (partagee) ou non
      this.charger_banque();


      //S'assurer que le son par défaut tel que nommé dans defaut.fnfn est bien présent dans la banque
      let nom = ConfigurationParDefaut.parametres.id_source_active;
      let dossier = this.trouver_dossier(this.configuration.parametres.chemin_source_active);
      if (_.find(dossier.sources, { id: nom }) == undefined) {
        console.log("Ajout du son par défaut");
        let source = {
          id: nom,
          local: true,
          dossier: "local",
          url: SonParDefaut
        };

        this.configuration.parametres.chemin_actif = ['local'];
        this.banque_locale.ajouter_source(this.dossier_actif, source);
      }
      // Charger le son sans changer le nom de l'archive
      await this.charger_source(this.source_active);
   




      this.charger_configuration_modules();
      this.charger_configuration_mixer();

      // Gerer l'affichage
      this.toggle_ecran('normal');
      this.paint();
      this.en_importation = false;
    },
    get_obj_config: async function (fichier) {

      // Telecharger l'archive
      if (typeof fichier === "string" && fichier.match(/^https.*fnfn$/)) {
        await fetch(fichier).then((response) => {
          return response.text();
        }).then((archive) => {
          fichier = JSON.parse(archive);
        });
      }

      // Charger l'archive
      else if (_.includes(["File", "Blob"], fichier.constructor.name)) { await fichier.text().then((archive) => { fichier = JSON.parse(archive); }); }

      // Pour les configurations deja telechargees en string
      else if (typeof fichier === "string") { fichier = JSON.parse(fichier); }

      // Si c'est la configuration par defaut (deja un objet), ne rien faire 
      else if (fichier.constructor.name === "Object") { }

      else { throw "Mauvais fichier" }

      

      // Retourner le fichier telecharge ou parse ou tout court
      return fichier;
    },

    charger_banque: function () {
      this.banque_locale = this.integration ? this.integration.banque : new Banque(this.configuration.banque);
    },

    charger_source: async function (source, reset = false) {
      //if(!source) source = this.configuration.parametres.dossier_actif.sources[0];

      // Mettre à jour les informations
      if (!this.en_importation) this.configuration.parametres.chemin_source_active = _.cloneDeep(this.chemin_actif)
      if (source.id) this.configuration.parametres.id_source_active = source.id;
      else this.configuration.parametres.id_source_active = null;

      // Aller chercher son (url ou base64)
      let response = await fetch(source.url, { mode: 'cors', headers: { 'Access-Control-Allow-Origin': '*' } });
      let blob = await response.blob();

      await this.$refs.mixer.charger_son(blob);

      this.toggle_ecran("normal");
      if (reset) this.reset_selecteur();
    },

    supprimer_source: function (source) { this.banque_locale.supprimer_source(this.dossier_actif, source) },

    charger_configuration_mixer: function () {
      let mixer = this.$refs.mixer;

      mixer.etat.inverse = this.configuration.parametres.inverse;
      mixer.etat.loop = this.configuration.parametres.loop;
      mixer.etat.solo = this.configuration.parametres.solo;
      mixer.etat.mode = this.configuration.parametres.mode;

      if (this.configuration.parametres.jouer) mixer.jouer();
    },

    charger_configuration_modules: function () {

            _.each(this.configuration.modules, (v, key) => {
              const state = this.enabledModules[key] ? 'activation' : 'désactivation';
              //console.log(`${state}  du module ${key}`);
              if (this.enabledModules[key]) {
                this.$refs[key][0].charger_props();
                //console.log(`module activé ${key}`);
              }
            }
          );
      },

    dupliquer_son_nouvel_id: async function () {
      let nom = this.configuration.parametres.id_source_active;
      let dossier = this.trouver_dossier(this.configuration.parametres.chemin_source_active);

      //Si le son n'existe pas dans le dossier actif, on l'ajoute
      if (_.find(dossier.sources, { id: nom }) == undefined) {
        let son = this.trouver_dossier(this.configuration.parametres.chemin_source_active).sources[0].url;
        let source = {
          id: nom,
          local: true,
          dossier: "local",
          url: son
        };

        this.configuration.parametres.chemin_actif = ['local'];
        this.banque_locale.ajouter_source(this.dossier_actif, source);
      }

    },

    ajouter_son: async function (blob, id) {
      let source = {
        id: (id || Date.now()),
        local: true,
        dossier: "local",
        url: await blob2base64(blob)
      };

      this.configuration.parametres.chemin_actif = ['local'];
      this.banque_locale.ajouter_source(this.dossier_actif, source);

      return source;
    },

    telecharger_source: async function (source) {

      let link = document.createElement('a');
      let fileName = source.id + '.wav';


      let binary = convertURIToBinary(source.url);
      let blob = new Blob([binary], {
        type: 'audio/wav'
      });
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

    },

    // CONTROLLEURS
    toggle_dossier: function (dossier) {
      let chemin_actif = this.configuration.parametres.chemin_actif;

      if (_.last(chemin_actif) == dossier.id) this.configuration.parametres.chemin_actif = [];
      else this.configuration.parametres.chemin_actif.push(dossier.id);
    },

    reset: function () { this.importer() },

    get_is_playing: function () { return this.$refs.mixer.etat.jouer },
    // Solo
    get_etat_solo: function () { return this.$refs.mixer.etat.solo },
    set_solo: function (val) { this.$refs.mixer.etat.solo = val },
    mute: function () { this.$refs.mixer.mute() },
    unmute: function () { this.$refs.mixer.unmute() },

    toggle_pause: function () { this.$refs.mixer.toggle_pause(true) },
    jouer: function () { return this.$refs.mixer.jouer() },
    arreter: function () { return this.$refs.mixer.arreter() },

    toggle_affichage_fonoimage: function () {
      this.configuration.parametres.minimiser = !this.configuration.parametres.minimiser;

      this.$emit('update:minimiser', this.configuration.parametres.minimiser);
    },
    set_reverb_sub_master: function (val) { this.$refs.mixer.set_reverb_sub_master(val) },
    toggle_ecran: function (ecran) {

      if (!(ecran == 'importation' && this.is_licenced_app == false)) {

        this.ecran = (ecran == this.ecran ? "normal" : ecran);
        this.$nextTick(this.paint);

      }

    },

    // UI
    paint: function () {

      // Largeur modules
      let mixer = this.$refs.container;
      let colonne_modules = this.$refs.colonne_modules;
      let colonne_arpegiateur = this.$refs.colonne_arpegiateur;

      // Gestion des colonnes et de l'arpegiateur
      let nb_colonnes = Math.ceil(mixer.offsetWidth / max_width_colonne);
      if (nb_colonnes <= 2) {
        colonne_modules.style.columnCount = nb_colonnes;
        colonne_arpegiateur.style.width = 0;
        colonne_modules.style.width = "100%";

        if (this.$refs.arpegiateur) { this.$refs.colonne_modules.appendChild(this.$refs.arpegiateur[0].$el) }

        this.mixer_layout = "colonne";
      }
      else {
        colonne_arpegiateur.style.width = ((100 / nb_colonnes) * 2) + "%";
        colonne_modules.style.width = ((100 / nb_colonnes) * (nb_colonnes - 2)) + "%";
        colonne_modules.style.columnCount = nb_colonnes - 2;

        if (this.$refs.arpegiateur) { this.$refs.colonne_arpegiateur.appendChild(this.$refs.arpegiateur[0].$el) }

        this.mixer_layout = "ligne";
      }

      // Metronome
      if (this.$refs.metronome) { this.$refs.metronome[0].update_font_size_bpm() }

      // Hauteur wavesurfer
      if (this.integration && this.integration.type == "fonoimage") {
        this.$refs.mixer.paint(this.configuration.parametres.minimiser ? 50 : 100);
      }
    },

    // OUTILS
    jouer_source: function (source) {
      // Arreter
      if (this.en_ecoute_source.id_source_active == source.id) {
        this.en_ecoute_source.id_source_active = null;
        this.en_ecoute_source.audio.pause();
      }
      // Arreter et partir nouveau
      else if (this.en_ecoute_source.id_source_active) {
        this.en_ecoute_source.audio.pause();
        this.en_ecoute_source.id_source_active = source.id;
        this.en_ecoute_source.audio.src = source.url;
        this.en_ecoute_source.audio.onended = () => {
          this.en_ecoute_source.id_source_active = null;
        };
        this.en_ecoute_source.audio.play();
      }
      // lancer
      else {
        this.en_ecoute_source.id_source_active = source.id;
        this.en_ecoute_source.audio.src = source.url;
        this.en_ecoute_source.audio.onended = () => {
          this.en_ecoute_source.id_source_active = null;
        };
        this.en_ecoute_source.audio.play();
      }
    },
    creer_son: function (son) {
      this.ajouter_son(son, `${this.source_active.id}_crop_${Date.now()}`).then((source) => { this.charger_source(source, true) });
    },
    reset_selecteur: function () { this.$refs.selecteur[0].set_plage(0, 1) },
    set_plage: function (plage) { this.$refs.selecteur[0].set_plage(plage.debut, plage.longueur) },

    get_enregistreur: function () {
      return new Promise((resolve) => {

        // S'il est deja initialise
        if (this.enregistrement.enregistreur) resolve(this.enregistrement.enregistreur);

        // Sinon
        else {
          navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            this.enregistrement.enregistreur = new Enregistreur(this.ctx_audio, stream);
            resolve(this.enregistrement.enregistreur);
          });
        }
      })
    },
    toggle_enregistrement: function () {
      this.get_enregistreur().then((enregistreur) => {
        if (this.wait_mode.match(/wait/)) {
          clearInterval(this.session_wait_interval);
          this.session_wait_interval = null;
          clearTimeout(this.session_active_timeout);
          this.session_active_timeout = null;
          this.wait_mode = 'inactive';
        } else if (!this.enregistrement.encours) {
          let i = 3;
          let self = this;
          this.wait_mode = 'wait' + i;
          this.session_wait_interval = setInterval(
            function () {
              i--;
              self.wait_mode = "wait" + i;
            },
            1000
          );

          this.session_active_timeout = setTimeout(
            function () {
              clearInterval(self.session_wait_interval);
              self.session_wait_interval = null;
              self.wait_mode = 'inactive';

              enregistreur.debuter();
              self.enregistrement.encours = !self.enregistrement.encours;
            },
            3000
          );
        } else {
          enregistreur.terminer().then((blob) => { this.ajouter_son(blob) });
          this.configuration.parametres.dossier_actif = "local";
          this.enregistrement.encours = !this.enregistrement.encours;
        }
      });
    },



    remonter_au_dossier_parent: function () { this.configuration.parametres.chemin_actif.pop() },
    trouver_dossier: function (chemin) {
      let dossier = this.banque_locale.sources; // Racine

      for (let i = 0; i < chemin.length; ++i) dossier = _.find(dossier.dossiers, { id: chemin[i] }); // Parcourir
      return dossier;
    },

    get_next_sequence: function () { return this.$refs.arpegiateur[0].get_next_colonne() },
    update_etat: function (ev) {
      if (ev == false) { this.$refs.arpegiateur[0].dirty = true; }
      this.$emit('update:etat:jouer', ev);
    }
  },
  computed: {
    source_active: function () {

      let dossier_source = this.en_importation ? this.trouver_dossier(this.configuration.parametres.chemin_source_active) : this.dossier_actif;

      /*
      ** début
      ** Il faudrait probablement revoir la logique plus haut dans la hiérarchie, mais pour l'instant, je gère un cas particulier
      */
      if (!("sources" in dossier_source)) {
        if ("dossiers" in dossier_source) {

          let tmp_chemin = this.configuration.parametres.chemin_source_active;
          let dossier_source_tmp = "";

          for (let i = 0; i < tmp_chemin.length; ++i) dossier_source_tmp = _.find(dossier_source.dossiers, { id: tmp_chemin[i] }); // Parcourir

          dossier_source = dossier_source_tmp;
        }
      }
      // fin

      return _.find(dossier_source.sources, { id: this.configuration.parametres.id_source_active });
    },
    chemin_actif: function () { return (this.configuration.parametres.chemin_actif || []) },
    dossier_actif: function () {
      return this.banque_locale ? this.trouver_dossier(this.configuration.parametres.chemin_actif) : { id: "Chargement", dossiers: [] }
    }

  },
  created: function () {
    //console.log(`fonofone.js: reverb node: ${this.getReverb()}`)
    //console.log('Fonofone created');



    this.validateUrlParams();
    //console.log('Enabled Modules', this.enabledModules);


    this.importer(this.archive)
    this.en_ecoute_source.audio = new Audio();

  },
  mounted: function () {
    


    // Ajuster l'affichage
    window.addEventListener("resize", this.paint);

    // Importation de nouveau fichier audio
    this.init_filepond(this.$refs.filepond_son, (fichier) => {

      if (!fichier.fileType.match(/audio|webm/)) throw "type de fichier non valide";
      new Response(fichier.file).blob().then((blob) => { this.ajouter_son(blob, fichier.filenameWithoutExtension); });
    });

    // Importation d'une nouvelle configuration
    this.init_filepond(this.$refs.filepond_archive, (fichier) => {
      if (!fichier.fileExtension == "fnfn") throw "type de fichier non valide";
      this.importer(fichier.file);
    });

    if (this.integration) this.$emit("mounted", true);

  },

  template: `
      <div :id="id" class="fonofone" ref="fonofone">
        <section v-show="ecran == 'normal'" class="ecran app-fonofone">
          <div class="nom-archive" v-if="!integration">
            <input v-model="configuration.parametres.nom" class="texte-nom-archive" placeholder="Archive"/>
          </div>
          <header>
            <menu>
              <div class="nom-son">
                <img src="${Folder}" @click="toggle_ecran('selection_son')"/>
                <input class="texte-nom-son" v-model="configuration.parametres.id_source_active" @blur="dupliquer_son_nouvel_id()"/>
                <!--<input class="texte-nom-son" v-model="configuration.parametres.id_source_active"/>-->

              </div>
              <div class="actions">
                <img src="${Reload}" class="invert" @click="toggle_ecran('reinitialisation')">
                <img v-if="!integration" src="${Import}" @click="toggle_ecran('importation')" :class="{demo: !(is_licenced_app)}">
                <img v-if="!integration" src="${Export}" @click="exporter" :class="{demo: !(is_licenced_app)}">
                <img v-if="integration && integration.type == 'fonoimage'" class="invert" :src="configuration.parametres.minimiser ? '${Maximiser}' : '${Minimiser}'" @click="toggle_affichage_fonoimage"/>
              </div>
            </menu>
            <mixer ref="mixer"
              :integration="integration" 
              :ctx_audio="ctx_audio"
              :modules="configuration.modules"
              :noeud_sortie="noeud_sortie"
              :is_licenced_app="is_licenced_app"
              @update:selection="set_plage($event)"
              @update:mode="$emit('update:mode', $event)"
              @update:solo="$emit('update:solo', $event)"
              @update:etat:jouer="update_etat($event)"
              @nouveau:son="creer_son($event)"
            ></mixer>
          </header>
          <main>
            <div class="container-modules" :class="mixer_layout" ref="container">
              <div class="colonne-modules" ref="colonne_modules">
              <component
              v-for="(module, key) in configuration.modules"
              :is="key"
              :key="key"
              :class="key"
              :ref="key"
              v-model="configuration.modules[key]"
            ></component>
              </div>
              <div class="colonne-arpegiateur" ref="colonne_arpegiateur"></div>
            </div>
          </main>
        </section>
        <section v-show="ecran == 'reinitialisation'" class="ecran">
          <div class="fenetre reinitialisation">
            <button @click="toggle_ecran('reinitialisation')">Annuler</button>
            <button @click="reset">Rétablir les réglages d'origine</button>
          </div>
        </section>
        <section v-show="ecran == 'importation'" class="ecran">
          <div class="fenetre importation">
            <h3 class="titre">
              <span class="texte">Importer une archive Fonofone</span>
              <img class="icone" src="${Import}" @click="toggle_ecran('importation')">
            </h3>
            <div class="wrapper-filepond" ref="filepond_archive"></div>
          </div>
        </section>
        <section v-show="ecran == 'selection_son'" class="ecran">
          <div class="fenetre selection">
            <h3 class="titre">
              <img src="${Folder}" @click="toggle_ecran('selection_son')"/>
              <span class="texte no_cursor">Liste des sons</span>
            </h3>
            <main>
              <div class="fil-ariane" @click="remonter_au_dossier_parent">
                <img class="retour" src="${FlecheDroite}" v-show="chemin_actif.length">
                <span class="id-dossier-actif">{{ dossier_actif.id }}</span>
              </div>
              <ul>
                <li class="dossier" v-for="dossier in dossier_actif.dossiers" @click="toggle_dossier(dossier)">
                  <div class="entete">
                    <span><img class="icone" :src="banque_locale.icones_dossiers(dossier.id)" :alt="dossier.id"/>{{ dossier.id.replace(/^\w/, (c) => c.toUpperCase()) }}</span>
                    <img class="icone" src="${FlecheDroite}" alt="fleche de selection" :class="{actif: configuration.parametres.dossier_actif == dossier}"/>
                  </div>
                </li>
                <li class="source" v-for="source in dossier_actif.sources" @click="charger_source(source, true)">
                  <input @click.stop v-model="source.id" type="text"/>
                  <div>
                    <img class="icone" :src="(en_ecoute_source.id_source_active == source.id) ? '${JouerActif}' : '${Jouer}'" @click.stop="jouer_source(source)">
                    <img v-if="dossier_actif.id == 'local'" class="icone icone_invert" src="${Export}" @click.stop="telecharger_source(source)">
                    <img class="icone" v-show="source_active != source" src="${Main}">
                    <img class="icone" v-show="(source != source_active) && (dossier_actif.id == 'local')" src="${Poubelle}" @click.stop="supprimer_source(source)">
                  </div>
                </li>
              </ul>
              <h3 class="titre no_cursor">Importer un son</h3>
              <div class="wrapper-filepond" ref="filepond_son"></div>
              <h3 class="titre no_cursor">
                <div id="record_btn" :class="{actif: enregistrement.encours, wait3: wait_mode == 'wait3', wait2: wait_mode == 'wait2', wait1: wait_mode == 'wait1'}" @click="toggle_enregistrement">
                  <div id="record_btn_bkg">
                    <div id="record_btn_light">
                      <div id="record_btn_light_active"></div>
                    </div>
                  </div>
                </div>
                <span class="texte">Enregistrer un son</span>
              </h3>
            </main>
          </div>
        </section>



      </div>`
}










