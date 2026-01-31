import Vue from 'vue';
import _ from 'lodash';
import { saveAs } from 'file-saver';
import { mixin as clickaway } from 'vue-clickaway';
import History from '../lib/history.js';
import Filepond from '../lib/filepond.js';

import ApplicationFonofone from '../fonofone/fonofone';
import Enregistreur from '../lib/enregistreur.js';
import '../fonofone/fonofone_gestion'; // Contient GFonofone
import Banque from '../banque.js';

import './style.less';
import Exporter from '../images/export.svg';
import Importer from '../images/folder-open.svg';

import PlayGeneral from '../images/play_general.svg';
import PauseGeneral from '../images/pause_general.svg';

import ConfigurationParDefaut from './configurations/defaut.mfnf';
import { ImpulsePetit, ImpulseGrand } from "../fonofone/donnees/reverberation/config.js";

window.Multi = class Multi {
  constructor (el, archive = ConfigurationParDefaut, params = {}) {
    let AudioContext = window.AudioContext || window.webkitAudioContext;


    const paramsSimpleObj = {}

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


    this.app = new Vue({
      el,
      mixins: [Filepond, clickaway],
      components: {
        "fonofone": ApplicationFonofone
      },
      data: {
        params: paramsSimpleObj,
        archive,
        id: el.id,
        id_fonofones: {},
        mode: 'normal', // Pas le bon nom
        mode_importation: false,
        banque_locale: new Banque(),
        nom: null,
        configuration: {},
        master: null,
        ctx_audio: new AudioContext(),
        media_stream_destination: null,
        noeud_sortie: null,
        solo: null,
        general_play: false,
        fonofones: [],
        session_active_timeout : null,
        session_wait_interval : null,
        enregistrement: { encours: false, enregistreur: null },
        is_licenced_app: (typeof is_licenced_user !== 'undefined' && !!is_licenced_user), // vérifie si la licence est présente
        history: new History(),
        //is_licenced_app: true // fake que la licence est présente
        reverb: null,
        
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
        exporter: function () { saveAs(new Blob([this.serialiser()]), this.nom + ".mfnf"); },
        serialiser: function () {
          return JSON.stringify({
            nom: this.nom,
            general_play: this.general_play,
            fonofones:_.map(this.get_fonofones(), (fnfn) => { return fnfn.serialiser(); }),
            sources: this.banque_locale.get_sources()
          });
        },
        importer: async function (fichier) {

          let archive = await this.get_obj_config(fichier);

          this.nom = archive.nom;

          // Creation de la banque de sons
          this.banque_locale = new Banque(archive.sources);

          // Reset des fonofones
          this.fonofones = [];
          this.$nextTick(() => { // Laisser le temps a Vue de se mettre a jour
            for(let i = 0; i < archive.fonofones.length; ++i) {
              this.fonofones.push(archive.fonofones[i]);
            }
            
            // Set reverb sub-master to 1 for all fonofones
            this.$nextTick(() => {
              this.setReverbForAllFonofones();
            });
          });
        },

                // Add this new method
        setReverbForAllFonofones: function() {
          const fonofones = this.get_fonofones();
          fonofones.forEach(ff => {
            if (ff && typeof ff.set_reverb_sub_master === 'function') {
              ff.set_reverb_sub_master(1);
            }
          });
        },
        
        get_obj_config: async function (fichier) {

          let archive_serialisee = null;

          // Configuration par defaut
          if(fichier.constructor.name == "Object") return fichier;

          // Url distant
          else if(typeof fichier === "string") {
            await fetch(fichier).then((response) => {
              return response.text();
            }).then((archive) => {
              archive_serialisee = archive;
            });
          }

          return JSON.parse(archive_serialisee);
        },
        toggle_solo: function (index, ev) {
          let fonofones = this.get_fonofones();
          let ff_solo = fonofones[index];

          if(this.solo == ff_solo) {
            _.each(fonofones, (ff) => { ff.unmute() });
            this.solo = null;
          }
          else {
            _.each(fonofones, (ff) => { 
              ff.set_solo(false); 
              ff.mute();
            })

            ff_solo.set_solo(true);
            ff_solo.unmute();
            this.solo = ff_solo;
          }
        },
        get_fonofones: function () {
          let refs =  _.filter(this.$refs, (ref) => { return ref[0] && ref[0].id.match(/^multi/); });
          return _.map(refs, (ref) => { return ref[0] });
        },

        toggle_general_play: function () {

          switch ( this.general_play ) {

            case true:
            case "partial":
              this.set_general_play( false );
              break;
          
            default:
              this.general_play = true;
              this.set_general_play( true );
              break;
            
          }

        },
        check_general_play: function () {

          let fonofones = this.get_fonofones();
          let playing_ff = 0;
          let mute_ff = 0;
          let all_ff = fonofones.length;

          _.each(fonofones, (ff) => {

            if ( ff.$refs.mixer.etat.jouer ) {

              playing_ff++;

            } else {

              mute_ff++;

            }

          });

          if ( playing_ff == all_ff ) {

            this.general_play = true;

          } else if ( mute_ff == all_ff ) {

            this.general_play = false;

          }

        },
        get_general_play_icon: function() {
        
          switch (this.general_play) {

            case true:
              return PauseGeneral;

            default:
              return PlayGeneral;
            
          }
        
        },
        set_general_play: function (val) {

          let fonofones = this.get_fonofones();
          this.general_play = val;

          if(this.general_play) {

            _.each(fonofones, (ff) => {

              if ( !ff.$refs.mixer.etat.jouer ) {

                ff.jouer();

              }

            })

          } else {

            _.each(fonofones, (ff) => {

              ff.arreter();

            })

          }

        },
        // Sessions
      toggle_session: function () {

        console.log("toggle_session");
        if( this.is_licenced_app ){

          if(this.mode.match(/wait/)){

            clearInterval(this.session_wait_interval);
            this.session_wait_interval = null;
            clearTimeout(this.session_active_timeout);
            this.session_active_timeout = null;
            this.mode = "normal";

          }else if(this.mode == "session:active"){

            this.fin_session();

          }else{

            let i = 3;
            let self = this;
            this.mode = 'session:wait' + i;
            this.session_wait_interval = setInterval(
              function(){
                i--;
                self.mode = "session:wait" + i;
              },
              1000
            );

            this.session_active_timeout = setTimeout(
              function(){
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
        console.log("debut_session");
        this.get_enregistreur().debuter();
      },
      fin_session: function () {
        this.mode = "normal";
        console.log("fin_session");
        this.get_enregistreur().terminer().then((blob) => {
          console.log("blob",`session_${Date.now().toString()}.wav` );
          saveAs(blob, `session_${Date.now().toString()}.wav`)
        })
      },
      get_enregistreur: function () {
        if(!this.enregistrement.enregistreur) this.enregistrement.enregistreur = new Enregistreur(this.ctx_audio, this.media_stream_destination.stream);
        return this.enregistrement.enregistreur;
      },

      undo: function () { this.history.undo() },
      redo: function () { this.history.redo() },

      setReverbForAllFonofones: function() {
        const fonofones = this.get_fonofones();
        fonofones.forEach(ff => {
          if (ff && typeof ff.set_reverb_sub_master === 'function') {
            ff.set_reverb_sub_master(1);
          }
        });
      },

      },
      
      computed: {
        donnees_integration: function () { return { banque: this.banque_locale, type: 'multi' }}
      },
      created: function () { 

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

        this.reverb.connect(this.master);

        // Set up history actions
        this.history.add_type_action("AJOUTER_FONOFONE", 
          (fonofone_serialise) => {
            // Implement add fonofone action
            this.fonofones.push(JSON.parse(fonofone_serialise));
          },
          (fonofone_serialise) => {
            // Implement undo add fonofone action
            this.fonofones.pop();
          }
        );

        this.history.add_type_action("SUPPRIMER_FONOFONE",
          (index) => {
            // Implement remove fonofone action
            this.fonofones.splice(index, 1);
          },
          (fonofone_serialise) => {
            // Implement undo remove fonofone action
            this.fonofones.splice(JSON.parse(fonofone_serialise).index, 0, JSON.parse(fonofone_serialise).fonofone);
          }
        );
      },
      mounted: function () {
        this.init_filepond(this.$refs.filepond_archive, async (fichier) => { 

          if (fichier.fileExtension == "mfnf") { 
            let archive_serialisee = await new Promise((resolve) => {
              let fileReader = new FileReader();
              fileReader.onload = (e) => resolve(fileReader.result);
              fileReader.readAsText(fichier.file);
            });

            this.importer(JSON.parse(archive_serialisee));
          }

          this.mode_importation = false;
        });

        // Lancer
        this.importer(this.archive);

        // Set reverb for all fonofones after initial import
        this.$nextTick(() => {
          this.setReverbForAllFonofones();
        });
      },
      //<div class="multi" style="display: flex; width: 100%">
      template: `
      <div class="multi" ref="multi">
      
          <menu>
          <div class="gauche">
            <img :src="get_general_play_icon()" class="play_general" @click="toggle_general_play"/>
            <div id="record_btn" :class="{demo: !(is_licenced_app), actif: mode == 'session:active', wait3: mode == 'session:wait3', wait2: mode == 'session:wait2', wait1: mode == 'session:wait1'}" @click="toggle_session">
            <div id="record_btn_bkg">
            <div id="record_btn_light">
              <div id="record_btn_light_active"></div>
            </div>
            </div>
          </div>
        </div>
        <div class="milieu">
        <input type="text" v-model="nom" class="texte-nom-multi"/>
      </div>
      <div class="droite">
        <img src="${Exporter}" class="upload" @click="exporter"/>
        <img src="${Importer}" class="folder" @click="mode_importation = !mode_importation"/>
      </div> 
          </menu>
          
          <div class="fonofones">
            <fonofone v-for="(config, index) in fonofones" 
              :id="'multi-' + id + '-' + index" 
              :ref="'multi-' + id + '-' + index" 
              :archive="config" 
              :ctx_audio="ctx_audio" 
              :noeud_sortie="master" 
              :integration="donnees_integration" 
              @update:solo="toggle_solo(index, $event)" 
              @update:etat:jouer="check_general_play()"
            ></fonofone>
            <div class="panneau-importation" :class="{actif: mode_importation}">
              <div class="fenetre" ref="filepond_archive"></div>
            </div>
          </div>
    </div>
    `
    });
  }
}