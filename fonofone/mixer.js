/* Fonctionnement du mixer
 *
 * Gestion des session d'enregistrement : mixins/graphe_audio
 *
 */

import toWav from 'audiobuffer-to-wav';

import Piste from './piste.js';
import Wavesurfer from './mixins/wavesurfer.js';
import GrapheAudio from './mixins/graphe_audio.js';

import Jouer from '../images/jouer.svg';
import JouerActif from '../images/jouer-actif.svg';
import Solo from '../images/solo.svg';
import SoloActif from '../images/solo-actif.svg';
import Loop from '../images/btn-loop.svg';
import LoopActif from '../images/btn-loop-actif.svg';
import Sens from '../images/fleche-sens.svg';
import Record from '../images/record.svg';
import Crop from '../images/crop.svg';
import ModeMix from '../images/mode-mix.svg';
import ModePic from '../images/mode-pic.svg';
import piste from './piste.js';
import { conforms } from 'lodash';

const attack = 0.01;
const release = 0.01;
const min_bpm = 5;
const max_bpm = 400; // TODO Utiliser les valeurs de global

export default {
  props: ["integration", "ctx_audio", "modules", "noeud_sortie", "is_licenced_app"],
  mixins: [Wavesurfer, GrapheAudio],
  components: { "piste": Piste },
  data: function () {
    
    return {
      buffer: null,
      buffer_inverse: null,
      etat: {
        inverse: false,
        loop: false,
        jouer: false,
        mode: 'mix', // Fonoimage
        solo: false,
        playhead_pos: 0,
      },
      prochaine_pulsation: null,
      prochaine_syncope_courte: true,
      pistes: [],

    };
  },

  methods: {

    // IMPORT / EXPORT
    // Chargement du blob et assertion son en stereo
    serialiser: function () { return this.etat },
    charger_son: async function (blob) {

      // Charger dans le buffer du mixer
      await this.lire_son(blob);

      // S'assurer qu'on travaille en stereo
      if(this.buffer.numberOfChannels < 2) { this.buffer = mono2stereo(this.ctx_audio, this.buffer); }

      // Creer le buffer inverse
      this.creer_buffer_inverse();

      // Charger dans le wavesurfer
      this.wavesurfer.loadBlob(blob);
      this.paint_region();
    },

//was never supported on ios 12... it is not supported until version 13.1

    // lire_son: function (blob) {
    //   return blob.arrayBuffer().then(async (array_buffer) => {
    //     return buffer2audio_buffer(this.ctx_audio, array_buffer);
    //   }).then((audio_buffer) => {
    //     this.buffer = audio_buffer;
    //   });
    // },

    lire_son: async function (blob) {
      try {
        const arrayBuffer = await this.readFileAsArrayBuffer(blob);
        const audioBuffer = await buffer2audio_buffer(this.ctx_audio, arrayBuffer);
        this.buffer = audioBuffer;
        //this.buffer = this.createA440Buffer(this.ctx_audio, 5);
      } catch (error) {
        console.error('An error occurred', error);
      }
    },

    createA440Buffer: function (audioContext, durationInSeconds) {
      const sampleRate = audioContext.sampleRate;
      const numChannels = 1; // Mono
      const numFrames = durationInSeconds * sampleRate;
    
      const buffer = audioContext.createBuffer(numChannels, numFrames, sampleRate);
      const channelData = buffer.getChannelData(0);
    
      const frequency = 440; // A440 Hz
      const amplitude = 0.5; // Adjust as needed
    
      for (let i = 0; i < numFrames; i++) {
        const t = i / sampleRate;
        channelData[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
      }
    
      return buffer;
    },
    
    
    readFileAsArrayBuffer: function (blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
    },

    creer_buffer_inverse: function () {

      // Creer le buffer
      this.buffer_inverse = this.ctx_audio.createBuffer(2, this.buffer.length, this.buffer.sampleRate);

      // Copier les donnees
      // this method is not supported in all browsers. Specifically, it is not supported in Internet Explorer and Safari versions prior to 14.1.
      // this.buffer_inverse.copyToChannel(this.buffer.getChannelData(0), 0);
      // this.buffer_inverse.copyToChannel(this.buffer.getChannelData(1), 1);

      var sourceChannelData = this.buffer.getChannelData(0);
      var targetChannelData = this.buffer_inverse.getChannelData(0);
      for (var i = 0; i < sourceChannelData.length; i++) {
        targetChannelData[i] = sourceChannelData[i];
      }

      sourceChannelData = this.buffer.getChannelData(1);
      targetChannelData = this.buffer_inverse.getChannelData(1);
      for (var i = 0; i < sourceChannelData.length; i++) {
        targetChannelData[i] = sourceChannelData[i];
      }

      // Inverser
      Array.prototype.reverse.call(this.buffer_inverse.getChannelData(0));
      Array.prototype.reverse.call(this.buffer_inverse.getChannelData(1));
    },

    // CONTROLLEURS
    // Lancer la lecture selon les parametres
    toggle_pause: async function (ordre_fonoimage = false) {
      this.etat.jouer ? this.arreter() : await this.jouer();
      if(!ordre_fonoimage) this.$emit("update:etat:jouer", this.etat.jouer);
    },
    toggle_mode_fonoimage: function () {
      this.etat.mode = this.etat.mode == 'pic' ? 'mix' : 'pic';
      this.$emit('update:mode', this.etat.mode);
    },
    toggle_mode_solo: function () {
      this.etat.solo = !this.etat.solo;
      this.$emit('update:solo', this.etat.solo);
    },
    jouer: function () {
      // Execute seulement une fois pour permettre au contexte audio de jouer
      return this.initialiser().then(() => {
        this._jouer();
        if(this.modules.metronome.actif) this.jouer_metronome();
      });
      
    },
    _jouer: function () {
      
      if(this.en_attente_jouer) this.debuter_session();
      //if(this.etat.jouer==false) this.pulsation(); 

      this.pulsation(); 
      this.etat.jouer = true;
    },
    arreter: function () {
          
      this.etat.jouer = false;
      this.$emit("update:etat:jouer", this.etat.jouer);
      clearTimeout(this.prochaine_pulsation);
      //get current playhead position
      //get first piste
  

      this.pistes = [];
    },
    fin_piste: function (piste) {

      // Toujours marquer la piste comme inactive
      piste.actif = false;

      // Ne pas arreter si le metronome est actif, sinon un drag de l'oreille lance d'autres sons
      if(this.modules.metronome.actif) return;

      this.etat.playhead_pos = 0;
      this.etat.jouer = false;
      if(!this.etat.loop) return this.arreter();

      // Si le metronome n'est pas actif et que toutes les pistes sont terminees, relancer
      if(!this.modules.metronome.actif && !_.some(this.pistes, p => p.actif)) this.jouer();
    },
    jouer_metronome: function () {


      
      // Initialisation
      let valeur = this.modules.metronome;
      if(!valeur.actif) return;

      // Interval simple
      let bpm = Math.pow(valeur.bpm, 2) * (max_bpm - min_bpm) + min_bpm;
      //console.log("bpm: ", bpm, max_bpm, min_bpm);
      let interval = (60 / bpm) * 1000;
      //console.log("i: ", interval);

      // Partie syncope
      if(valeur.syncope) {
        interval *= !this.prochaine_syncope_courte ? 1 - valeur.syncope : valeur.syncope;
        interval *= 2; // Pour balancer la reduction en %
        this.prochaine_syncope_courte = !this.prochaine_syncope_courte;
      }

      // Partie aleatoire
      interval = interval * (1 - (valeur.aleatoire / 2)) + (Math.random() * interval * valeur.aleatoire);

      // Lancer
      this.prochaine_pulsation = setTimeout(() => { this._jouer(); this.jouer_metronome() }, interval);
      //this.prochaine_pulsation = setTimeout(() => { this._jouer()}, interval);
    },

    // Sens de lecture du buffer
    toggle_sens: function () { this.set_sens(!this.etat.inverse) },
    set_sens: function (v) { this.etat.inverse = v },

    // Repeter la lecture
    toggle_loop: function () { this.set_loop(!this.etat.loop) },
    set_loop: function (v) { this.etat.loop = v }, 

    // Transformer la selection en sons complet
    crop: function () {
      let buffer = crop_audio_buffer(this.ctx_audio, this.buffer, this.debut_region, this.fin_region);
      this.$emit("nouveau:son", new Blob([toWav(buffer)]));
    },

    // UI
    paint: function (height_wavesurfer) {
      this.wavesurfer.setHeight(height_wavesurfer);
    },

    store_playhead_pos: function (value) {
      //allows for the playhead to be stored and used when the playhead is stopped, if loop is deactivated
      if(value<100){
        this.etat.playhead_pos = value;
      }else this.etat.playhead_pos = 0;
    },

    // Faire jouer
    get_prochaine_sequence_arpegiateur: function () { 
      return this.modules.arpegiateur.actif ? this.$parent.get_next_sequence : false;
    },
    pulsation: function () { this.pistes.push({actif: true}) },
    
  },
  computed: {
    debut_region: function () { return this.buffer.duration * this.modules.selecteur.debut },
    fin_region: function () { return this.debut_region + (this.buffer.duration * this.modules.selecteur.longueur) },
    longueur_region: function () { return this.fin_region - this.debut_region },
    waveform_id: function () { return `${this.$parent.id}-waveform-${Date.now()}` }
  },
  created: function () {
    this.initialiser = _.once(() => { return this.ctx_audio.resume() });
  },
  mounted: function () {
    console.log("Mixer mounted", this.set_reverb_sub_master(0));
    this.$watch('modules.metronome', (v, v_old) => {

      // Quand le metronome est desactive
      if(!v.actif) {
        // reset syncope
        this.prochaine_syncope_courte = true;

        // Annuler le prochain timeout du metronome
        clearTimeout(this.prochaine_pulsation);

        // Si la boucle est active et qu'aucune piste n'est en cours, relancer le son
        if(this.etat.loop && !_.some(this.pistes, p => p.actif)) {
          this.jouer();
        }
      }

      else if((v_old && !v_old.actif) && v.actif && this.etat.jouer) this.jouer_metronome();
    });
  },
  template: ` 
    <div class="panneau-mixer">
      <div :id="waveform_id" class="wavesurfer" ref="wavesurfer">
        <piste v-for="p in pistes" 
          :buffer="etat.inverse ? buffer_inverse : buffer"
          :contexte="ctx_audio"
          :debut="modules.selecteur.debut * 100"
          :fin="(modules.selecteur.debut + modules.selecteur.longueur) * 100"
          :inverse="etat.inverse"
          :noeud="nodes.n0"
          :vitesse="modules.vitesse"
          :arpegiateur="get_prochaine_sequence_arpegiateur()"
          :playhead_pct="etat.playhead_pos"
          :playhead_restart="etat.loop"
          @fin="fin_piste(p)"
          @stopped="store_playhead_pos"
        ></piste>
      </div>
      <div class="menu-controlleurs">
        <div class="gauche">
          <img :src="(etat.jouer && (pistes.length > 0 || etat.metronome)) ? '${JouerActif}' : '${Jouer}'" class="icone pause" @click="toggle_pause(false)"/>
          <img v-if="integration" :src="etat.solo ? '${SoloActif}' : '${Solo}'" class="icone solo" @click="toggle_mode_solo"/>
          <img :src="etat.loop ? '${LoopActif}' : '${Loop}'" class="icone loop" @click="toggle_loop"/>
          <img src="${Sens}" class="icone sens" :class="{actif: !etat.inverse}" @click="toggle_sens"/>
          <img src="${Record}" class="icone session" :class="{actif: en_session_enregistrement, demo: !(this.is_licenced_app)}" @click="toggle_session"/>
          <span v-show="en_attente_jouer">Appuyez sur le bouton jouer</span>
          <img src="${Crop}" class="icone" @click="crop"/>
        </div>
        <div v-if="integration" class="droite">
          <img class="icone" :src="etat.mode == 'mix' ? '${ModeMix}' : '${ModePic}'" @click="toggle_mode_fonoimage"/>
        </div>
      </div>
    </div>
  `
};

function buffer2audio_buffer (ctx_audio, array_buffer) {
  return new Promise((resolve, reject) => {
    ctx_audio.decodeAudioData(array_buffer, function(decodedData) {
        // 'decodedData' is an AudioBuffer
        resolve(decodedData);
    }, reject);
});
}

function mono2stereo (ctx_audio, mono) {
  let stereo = ctx_audio.createBuffer(2, mono.length, mono.sampleRate);
  for(let i = 0; i < mono.length; i++) {
    stereo.getChannelData(0)[i] = mono.getChannelData(0)[i];
    stereo.getChannelData(1)[i] = mono.getChannelData(0)[i];
  }
  return stereo;
}

// https://miguelmota.com/bytes/slice-audiobuffer/
function crop_audio_buffer(ctx_audio, buffer, begin, end) {

  let channels = buffer.numberOfChannels;
  let rate = buffer.sampleRate;

  let startOffset = rate * begin;
  let endOffset = rate * end;
  let frameCount = endOffset - startOffset;

  let newArrayBuffer = ctx_audio.createBuffer(channels, endOffset - startOffset, rate);

  let channel0 = buffer.getChannelData(0);
  let channel1 = buffer.getChannelData(1);
  let offset = Math.round(startOffset);

  for(let i = 0; i < frameCount; i++) {
    newArrayBuffer.getChannelData(0)[i] = channel0[i + offset];
    newArrayBuffer.getChannelData(1)[i] = channel1[i + offset];
  }

  return newArrayBuffer;
}

// function crop_audio_buffer(ctx_audio, buffer, begin, end, fadeDuration = 0.5) {
//   let channels = buffer.numberOfChannels;
//   let rate = buffer.sampleRate;

//   let startOffset = Math.floor(rate * begin);
//   let endOffset = Math.ceil(rate * end);
//   let frameCount = endOffset - startOffset;

//   // Validate frameCount and adjust if necessary
//   frameCount = Math.max(0, Math.min(frameCount, buffer.length - startOffset));

//   let newArrayBuffer = ctx_audio.createBuffer(channels, frameCount, rate);

//   for (let channel = 0; channel < channels; channel++) {
//     let channelData = buffer.getChannelData(channel);
//     let newData = newArrayBuffer.getChannelData(channel);

//     for (let i = 0; i < frameCount; i++) {
//       // Apply fade-in effect at the loop start
//       let fade = i / (rate * fadeDuration);
//       fade = Math.min(1, fade);

//       newData[i] = channelData[i + startOffset] * fade;
//     }
//   }

//   return newArrayBuffer;
// }