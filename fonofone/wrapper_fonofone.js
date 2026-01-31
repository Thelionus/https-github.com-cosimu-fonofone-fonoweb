import Vue from 'vue';

import ApplicationFonofone from './fonofone';
import './fonofone_gestion'; // Contient GFonofone

window.Fonofone = class Fonofone {
  constructor (element, parametres = {}) {

    if(!element || element.nodeType !== Node.ELEMENT_NODE) {
      throw "Element d'attache non valide";
    }

    // Creer l'element pour le Vue
    let app_container = document.createElement("div");
    app_container.id = "fnfn-" + window.GestionnaireFonofone.prochainIndex();
    element.appendChild(app_container);
    
    // Creer le contexte audio si on est pas dans un Fonoimage
    let AudioContext = window.AudioContext || window.webkitAudioContext;
    parametres.ctx_audio = (parametres.ctx_audio || new AudioContext);

    // Creer un noeud de sortie controllable par le Fonoimage
    parametres.noeud_sortie = (parametres.noeud_sortie || parametres.ctx_audio.destination);

    // Construction de l'application simpliste qui se base sur le component ApplicationFonofone
    return new Vue({
      el: "#" + app_container.id,
      components: {
        "fonofone": ApplicationFonofone
      },
      data: {
        id: app_container.id,
        archive: parametres.configuration,
        ctx_audio: parametres.ctx_audio,
        noeud_sortie: parametres.noeud_sortie
      },
      template: ` <fonofone :id="id" :archive="archive" :ctx_audio="ctx_audio" :noeud_sortie="noeud_sortie"></fonofone> `
    });
  }
}
