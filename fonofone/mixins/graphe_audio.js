import { buffer2audio_buffer, noteToFreq, logMap } from "../../utils.js";

import { saveAs } from 'file-saver';
import Enregistreur from '../../lib/enregistreur.js';

import { ImpulsePetit, ImpulseGrand } from "../donnees/reverberation/config.js";
import { create, fromPairs } from "lodash";
import { provide } from "vue";



function validateUrlParams(params) {
  return {
    enableEffects: (typeof params.fx !== 'undefined') ? params.fx : true,
    enableReverb: (typeof params.reverb !== 'undefined') ? params.reverb : true,
    enableFilter: (typeof params.filter !== 'undefined') ? params.filter : true,
    enableSpeed: (typeof params.vitesse !== 'undefined') ? params.speed : true,
    enableMetronome: (typeof params.metronome !== 'undefined') ? params.metro : true,
    enableArpeggiator: (typeof params.arpeggiator !== 'undefined') ? params.arp : true,
  }
}

export default {
  data: function () {

    return {
      nodes: {},
      en_session_enregistrement: false,
      en_attente_jouer: false,
      validParams: validateUrlParams(this.params),


    };
  },
  inject: ['params', 'getReverb'],
  methods: {
    set_reverb_sub_master: function (gain) {
      this.nodes.reverb_sub_master.gain.setValueAtTime(gain, this.ctx_audio.currentTime)
      //console.log(`Reverb sub master: ${gain}`)
    },
    mute: function () {
      this.nodes.n0.gain.setValueAtTime(0, this.ctx_audio.currentTime);
    },
    unmute: function () {
      this.nodes.n0.gain.setValueAtTime(1, this.ctx_audio.currentTime);
    },
    toggle_session: function () {

      if (this.is_licenced_app) {

        if (!this.en_session_enregistrement && this.en_attente_jouer) this.en_attente_jouer = false;
        else if (!this.en_session_enregistrement) this.etat.jouer ? this.debuter_session() : this.en_attente_jouer = true;
        else this.terminer_session();

      }

    },
    debuter_session: function () {
      if (!this.etat.jouer) return;

      this.en_attente_jouer = false;
      this.en_session_enregistrement = true;

      this.enregistreur.debuter();
    },
    terminer_session: function () {
      this.en_session_enregistrement = false;

      if (!this.en_attente_jouer) {
        this.enregistreur.terminer().then((blob) => {
          saveAs(blob, `${this.$parent.configuration.parametres.nom} ${new Date().toLocaleString()}.wav`);
        });
      }
    },
    ajuster_filtre: function (debut, longueur) {

      // Calcul des valeurs
      let frequence = debut + (longueur);
      //clamp frequence between 0 and 1
      frequence = Math.min(Math.max(frequence, 0), 1);
      let resonnance = longueur;

      // Ajustement des filtres
      //let q = Math.pow(1 - resonnance, 8) * 2;
      let q = 0.;

      //ajustement des filtres
      let freqLp = logMap(frequence ** 1.11, 22, 22050);
      let freqHp = logMap(debut ** 1.11, 22, 22050);

      //console.log(freqLp, freqHp);
      //console.log(q);

      this.nodes.lowpass_filter.frequency.value = freqLp;
      this.nodes.lowpass_filter.Q.value = q;
      this.nodes.lowpass_filter2.frequency.value = freqLp;
      this.nodes.lowpass_filter2.Q.value = q;
      this.nodes.lowpass_filter3.frequency.value = freqLp;
      this.nodes.lowpass_filter3.Q.value = q;
      this.nodes.lowpass_filter4.frequency.value = freqLp;
      this.nodes.lowpass_filter4.Q.value = q;
      this.nodes.lowpass_filter5.frequency.value = freqLp;
      this.nodes.lowpass_filter5.Q.value = q;
      this.nodes.lowpass_filter6.frequency.value = freqLp;
      this.nodes.lowpass_filter6.Q.value = q;

      //freqHp = 0;
      this.nodes.highpass_filter.frequency.value = freqHp;
      this.nodes.highpass_filter.Q.value = q;
      this.nodes.highpass_filter2.frequency.value = freqHp;
      this.nodes.highpass_filter2.Q.value = q;
      this.nodes.highpass_filter3.frequency.value = freqHp;
      this.nodes.highpass_filter3.Q.value = q;
      this.nodes.highpass_filter4.frequency.value = freqHp;
      this.nodes.highpass_filter4.Q.value = q;
      this.nodes.highpass_filter5.frequency.value = freqHp;
      this.nodes.highpass_filter5.Q.value = q;
      this.nodes.highpass_filter6.frequency.value = freqHp;
      this.nodes.highpass_filter6.Q.value = q;

      //function that progressively lower gain as resonnance is increased
      let compensation = Math.abs(1 - ((debut * 0.9) ** 2));

      this.nodes.gain_filter.gain.setValueAtTime(compensation, this.ctx_audio.currentTime)
    },
    createFilter: function () {
      this.nodes.lowpass_filter = this.ctx_audio.createBiquadFilter();
      this.nodes.lowpass_filter.type = 'lowpass'
      this.nodes.lowpass_filter.frequency.value = 20000
      this.nodes.lowpass_filter2 = this.ctx_audio.createBiquadFilter();
      this.nodes.lowpass_filter2.type = 'lowpass'
      this.nodes.lowpass_filter2.frequency.value = 20000
      this.nodes.lowpass_filter3 = this.ctx_audio.createBiquadFilter();
      this.nodes.lowpass_filter3.type = 'lowpass'
      this.nodes.lowpass_filter3.frequency.value = 20000
      this.nodes.lowpass_filter4 = this.ctx_audio.createBiquadFilter();
      this.nodes.lowpass_filter4.type = 'lowpass'
      this.nodes.lowpass_filter4.frequency.value = 20000
      this.nodes.lowpass_filter5 = this.ctx_audio.createBiquadFilter();
      this.nodes.lowpass_filter5.type = 'lowpass'
      this.nodes.lowpass_filter5.frequency.value = 20000
      this.nodes.lowpass_filter6 = this.ctx_audio.createBiquadFilter();
      this.nodes.lowpass_filter6.type = 'lowpass'
      this.nodes.lowpass_filter6.frequency.value = 20000


      this.nodes.highpass_filter = this.ctx_audio.createBiquadFilter();
      this.nodes.highpass_filter.type = 'highpass'
      this.nodes.highpass_filter.frequency.value = 20
      this.nodes.highpass_filter2 = this.ctx_audio.createBiquadFilter();
      this.nodes.highpass_filter2.type = 'highpass'
      this.nodes.highpass_filter2.frequency.value = 20
      this.nodes.highpass_filter3 = this.ctx_audio.createBiquadFilter();
      this.nodes.highpass_filter3.type = 'highpass'
      this.nodes.highpass_filter3.frequency.value = 20
      this.nodes.highpass_filter4 = this.ctx_audio.createBiquadFilter();
      this.nodes.highpass_filter4.type = 'highpass'
      this.nodes.highpass_filter4.frequency.value = 20
      this.nodes.highpass_filter5 = this.ctx_audio.createBiquadFilter();
      this.nodes.highpass_filter5.type = 'highpass'
      this.nodes.highpass_filter5.frequency.value = 20
      this.nodes.highpass_filter6 = this.ctx_audio.createBiquadFilter();
      this.nodes.highpass_filter6.type = 'highpass'
      this.nodes.highpass_filter6.frequency.value = 20

      this.nodes.gain_filter = this.ctx_audio.createGain();

      // Filtre
      this.nodes.lowpass_filter.connect(this.nodes.lowpass_filter2);
      this.nodes.lowpass_filter2.connect(this.nodes.lowpass_filter3);
      this.nodes.lowpass_filter3.connect(this.nodes.lowpass_filter4);
      this.nodes.lowpass_filter4.connect(this.nodes.lowpass_filter5);
      this.nodes.lowpass_filter5.connect(this.nodes.lowpass_filter6);
      this.nodes.lowpass_filter6.connect(this.nodes.highpass_filter);
      this.nodes.highpass_filter.connect(this.nodes.highpass_filter2);
      this.nodes.highpass_filter2.connect(this.nodes.highpass_filter3);
      this.nodes.highpass_filter3.connect(this.nodes.highpass_filter4);
      this.nodes.highpass_filter4.connect(this.nodes.highpass_filter5);
      this.nodes.highpass_filter5.connect(this.nodes.highpass_filter6);
      this.nodes.highpass_filter6.connect(this.nodes.gain_filter);

    }
  },
  created: function () {

    // Enregistrement de session
    this.nodes.media_stream_destination = this.ctx_audio.createMediaStreamDestination();
    this.enregistreur = new Enregistreur(this.ctx_audio, this.nodes.media_stream_destination.stream);

    // Initialisation
    this.nodes.n0 = this.ctx_audio.createGain(); // Noeud initial qu'on passe a toutes les tracks pour qu'elles se connectent a la destination
    this.nodes.splitter = this.ctx_audio.createChannelSplitter(2);
    this.nodes.pan_gauche = this.ctx_audio.createGain();
    this.nodes.pan_droite = this.ctx_audio.createGain();
    this.nodes.merger = this.ctx_audio.createChannelMerger(2);
    this.nodes.convolver = this.getReverb();
    this.nodes.reverberation_dry = this.ctx_audio.createGain();
    this.nodes.reverberation_wet = this.ctx_audio.createGain();
    this.nodes.reverb_sub_master = this.ctx_audio.createGain();
    this.nodes.master = this.ctx_audio.createGain();
    this.createFilter();



    this.nodes.n0.connect(this.nodes.splitter);

    // Pan
    this.nodes.splitter.connect(this.nodes.pan_gauche, 0, 0);
    this.nodes.splitter.connect(this.nodes.pan_droite, 1, 0);
    this.nodes.pan_gauche.connect(this.nodes.merger, 0, 1);
    this.nodes.pan_droite.connect(this.nodes.merger, 0, 0);


    // Reverb 
    this.nodes.merger.connect(this.nodes.lowpass_filter);
    this.nodes.reverb_send = this.ctx_audio.createGain();


    this.nodes.gain_filter.connect(this.nodes.reverb_sub_master);
    this.nodes.gain_filter.connect(this.nodes.reverberation_dry);

    this.nodes.reverb_sub_master.connect(this.nodes.reverberation_wet);
    this.nodes.reverberation_wet.connect(this.nodes.convolver);


    this.nodes.reverberation_dry.connect(this.nodes.master);

    // (Gain) Sortie standard et sortie enregistrement
    this.nodes.master.connect(this.noeud_sortie);
    this.nodes.master.connect(this.nodes.media_stream_destination);

    // Bug Chrome valeurs par defaut pour le filtre
    this.ajuster_filtre(0, 1);
    // Initialize reverb_sub_master gain
    let initialVolume = this.modules.volume.volume;
    let initialReverbWet = this.modules.reverberation.wet;
    let initialReverbSubMasterGain = Math.pow(initialVolume * 1.66667, 2) * initialReverbWet;
    this.nodes.reverb_sub_master.gain.setValueAtTime(initialReverbSubMasterGain, this.ctx_audio.currentTime);


  },
  mounted: function () {
    this.$watch('modules.volume', (v) => {

      // Volume
      //remap v.volume so that 0.6 is 0dB
      // Mapping non-linéaire de la valeur de volume
      let targetGain = Math.pow(v.volume * 1.66667, 2);
      this.nodes.master.gain.linearRampToValueAtTime(targetGain, this.ctx_audio.currentTime + 0.1);

      // Pan
      let targetLeftPan = (v.pan >= 0.5) ? 1 : Math.sin(v.pan * Math.PI);
      let targetRightPan = (v.pan <= 0.5) ? 1 : Math.cos((0.5 - v.pan) * Math.PI);

      this.nodes.pan_gauche.gain.linearRampToValueAtTime(targetLeftPan, this.ctx_audio.currentTime + 0.1);
      this.nodes.pan_droite.gain.linearRampToValueAtTime(targetRightPan, this.ctx_audio.currentTime + 0.1);

      // Adjust reverb_sub_master proportionally
      let currentReverbWet = this.modules.reverberation.wet;
      let targetReverbSubMasterGain = targetGain * currentReverbWet;
      this.nodes.reverb_sub_master.gain.linearRampToValueAtTime(targetReverbSubMasterGain, this.ctx_audio.currentTime + 0.1);




    });

    this.$watch('modules.filtre', (v) => {

      // Filtre inactif
      if (!v.actif) { v.debut = 0; v.longueur = 1; }
      this.ajuster_filtre(v.debut, v.longueur);
    });

    this.$watch('modules.reverberation', (v) => {

      // Sans reverberation
      if (!v.actif) v.wet = 0;

      function equalPowerDryWet(mix) {
        if (typeof mix !== 'number' || mix < 0 || mix > 1) {
          throw new Error("Mix value must be a number between 0 and 1");
        }
        const dry = Math.cos((mix * Math.PI) / 2);
        const wet = Math.sin((mix * Math.PI) / 2);
        return {
          dry: parseFloat(dry.toFixed(6)),
          wet: parseFloat(wet.toFixed(6))
        }
      }

      let wet = parseFloat(v.wet.toFixed(6));
      let equalPowerRatio = equalPowerDryWet(wet);
      const targetDryGain = equalPowerRatio.dry;
      //const targetDryGain = 0;
      const targetWetGain = equalPowerRatio.wet;
      //const targetWetGain = 0;

      //console.log(`Wet: ${wet} TARGET DRY: ${targetDryGain} TARGET WET: ${targetWetGain}`)
      // Update reverb_sub_master gain
      let currentVolume = this.modules.volume.volume;
      let targetReverbSubMasterGain = Math.pow(currentVolume * 1.66667, 2) * targetWetGain;
      this.nodes.reverb_sub_master.gain.linearRampToValueAtTime(targetReverbSubMasterGain, this.ctx_audio.currentTime + 0.1);

      this.nodes.reverberation_dry.gain.linearRampToValueAtTime(targetDryGain, this.ctx_audio.currentTime + 0.1);
      this.nodes.reverberation_wet.gain.linearRampToValueAtTime(targetWetGain, this.ctx_audio.currentTime + 0.1);

    });

  }
}

