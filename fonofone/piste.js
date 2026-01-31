const attack = 0.01;
const release = 0.01;

export default {
  props: ["debut", "fin", "contexte", "buffer", "inverse", "noeud", "vitesse", "arpegiateur", "playhead_pct","playhead_restart"],
  data: function () {
    return { 
      alive: true,
      moment_debut: null,
      checkpoint_lecture: null,
      left: `${this.inverse ? this.fin : this.debut}`,
      samples_restants: this.buffer.length,
      source: null,
      vitesse_initiale: 1,
      vitesse_arpegiateur: 1,
      vitesse_calculee: 1,
      has_played: false,
      cue: 0,
      cue_pct: 0,
    };
  },
  methods: {


    get_playhead_phase: function() {


      let now = this.contexte.currentTime;
      let temps_ecoule = now - this.moment_debut;
      let position_actuelle = this.cue + temps_ecoule;
      let position_actuelle_pct = (position_actuelle / this.buffer.duration) * 100;
      
      //Force the playhead to be at beginning if out of bounds
      if(position_actuelle_pct >= this.fin) {
        position_actuelle_pct = this.debut;
      }
      return position_actuelle_pct;
    },

    fin_piste: function () {
      this.alive = false;
      this.source.stop();
      this.$emit("fin");
      this.$nextTick(() => { this.$destroy(); })
    },
    update_vitesse: function () {

      // Garder le compte d'ou on en est
      let now = this.contexte.currentTime;
      let temps_ecoule = now - this.checkpoint_lecture;
      this.samples_restants -= temps_ecoule * (this.buffer.sampleRate * this.vitesse_calculee);
      this.checkpoint_lecture = now;

      this.set_vitesse();
    },
    set_vitesse: function () {
      this.vitesse_calculee = this.vitesse.actif ? calcul_vitesse(this.vitesse.vitesse, this.vitesse.mode) * this.vitesse_arpegiateur : 1;
      this.source.playbackRate.setValueAtTime(this.vitesse_calculee, this.contexte.currentTime);
    },

    // Transition, playhead UI
    apparition: function (el) { 
      //Use to be this.begin instead of this.cue_pct but now it works with the playhead_restart prop
      el.style.left = `${this.inverse ? this.fin : this.cue_pct}%`; 
      el.style.transition = `left ${this.ttl}s linear` 
    },
    apres_apparition: function (el) { el.style.left = `${this.inverse ? this.cue_pct : this.fin}%` }
  },
  computed: {
    longueur: function () { return Math.abs(this.fin - this.cue_pct) },
    longueur_abs: function () { return (this.longueur / 100) * this.buffer.duration },
    ttl: function () { return this.longueur_abs / this.vitesse_calculee },

    debut_abs: function () { 
      if(this.inverse) { return ((100 - this.fin) / 100) * this.buffer.duration }
      else { return (this.debut / 100) * this.buffer.duration }
    }
  },
  created: function () {

    // Initialisation
    let volume = 1;
    this.vitesse_initiale = calcul_vitesse(this.vitesse.vitesse, this.vitesse.mode);

    let enveloppe = this.contexte.createGain();
    let now = this.contexte.currentTime;
    this.moment_debut = now;
    let source = this.source = this.contexte.createBufferSource();
    source.buffer = this.buffer;
    source.addEventListener("ended", () => { this.fin_piste(); })

    // Si l'arpegiateur est active
    if(this.arpegiateur) {
      let sequence = this.arpegiateur(); // Obtenir les parametres d'arpegiateur
      volume *= sequence.jouer ? sequence.volume * 2 : 0; // Volume
      this.vitesse_arpegiateur = calcul_vitesse(sequence.vitesse, sequence.octaves); // Vitesse
    }

    // Enveloppe
    source.connect(enveloppe);
    enveloppe.gain.setValueAtTime         (0, now);
    enveloppe.gain.linearRampToValueAtTime(volume, now + attack);
    enveloppe.gain.linearRampToValueAtTime(volume, now + attack + (this.longueur / this.vitesse_calculee));
    enveloppe.gain.linearRampToValueAtTime(0, now + attack + (this.longueur / this.vitesse_calculee) + release);
    enveloppe.connect(this.noeud);

    this.set_vitesse();
    this.$watch('vitesse', this.update_vitesse);
    
    //console.log(this.export_playhead());

 /* Attempt to randomize playhead, but it's not working as expected. I can't find a way to know of pass a a variable saying piste has played of not.
    if (this.random_playhead) {
      source.start(now, Math.random() * this.buffer.duration, this.longueur_abs);
    }
    else {
      source.start(now, this.debut_abs, this.longueur_abs);
    }
*/  
    
    this.cue = this.debut_abs; 
    this.cue_pct = this.debut;

    if(this.playhead_pct && this.playhead_restart == false) {
      this.cue = (this.playhead_pct/100) * this.buffer.duration;
      this.cue_pct = this.playhead_pct;
    }

    source.start(now, this.cue, this.longueur_abs);
    this.checkpoint_lecture = now;
    this.moment_debut = now;

  },
  mounted: function () {
    this.$watch("fin", (v) => {
      let now = this.contexte.currentTime;
      let temps_ecoule = now - this.moment_debut;
      let position_actuelle = this.cue + temps_ecoule;
      let position_actuelle_pct = (position_actuelle / this.buffer.duration) * 100;
      if(v < position_actuelle_pct) { this.fin_piste(); }
    })
  },
  beforeDestroy: function () { 
    //This gets called event if I stop the sound by moving the ear out of the zone
    this.$emit("stopped", this.get_playhead_phase());
    this.source.stop() 
  },
  
  template: ` 
    <transition appear :duration="ttl" v-on:appear="apparition" v-on:after-appear="apres_apparition" >
      <div v-if="alive" class="pulsation"></div> 
    </transition>
  `
  
};

function calcul_vitesse (valeur, octaves) {

  if(octaves == 3) octaves = 4;

  return (440. * Math.exp(.057762265 * ((valeur - 0.5) * 12. * octaves - 69.))) / 8.175799;
}
