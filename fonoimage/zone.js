const Fabric = require("fabric").fabric;

import Jouer from '../images/jouer.svg';
import JouerActif from '../images/jouer-actif.svg';
import Fonofone from '../images/fonofone.png';

const couleur_zone_mix = "rgb(0, 0, 255)";
const couleur_zone_pic = "rgb(242, 165, 26)";

const taille_icones = 25;

const TOLERANCE_MIN_ZONE_BOUGE = 10;

var next_ref = 0;
function get_next_ref () { return ++next_ref }

export default class Zone {


  constructor (parametres, configuration_fonofone =  null) {

    this.parametres = parametres;
    this.canva = parametres.canva;
    this.ctx_audio = parametres.ctx_audio;

    this.id = `${parametres.id_fonoimage}_${get_next_ref()}`; // Utilise par le fonoimage
    this.en_duplication = false;
    this.is_moving = false;

    this.configuration_fonofone = configuration_fonofone;
    /**
     * Possible options for the 'mode' parameter:
     * - 'mix': zone is spatialized (i.e. the 'ear' is required to hear the sound).
     * - 'pic': zone is not spatialized and is only panned left-right in the output directly.
     */
    this.mode = parametres.mode;
    this.etat_jouer = parametres.etat_jouer;
    this.icone_etat_jouer = null;
    this.visible = this.parametres.visible;
    this.minimiser = true;
    this.icone_zone_original_coords = false;

    // Audio fonofone
    this.master = this.ctx_audio.createGain();
    this.master_solo = this.ctx_audio.createGain();

    this.master.connect(this.master_solo);
    this.master_solo.connect(parametres.master_fonoimage);

    // Visuel
    this.paint_ellipse(parametres.x, parametres.y, parametres.rx, parametres.ry, parametres.angle);
  }

  activer_son () { this.master_solo.gain.setValueAtTime(1, this.ctx_audio.currentTime) }

  desactiver_son () { this.master_solo.gain.setValueAtTime(0, this.ctx_audio.currentTime) }

  reset_ellipse () {
    if(!this.ellipse) return;

    this.canva.remove(this.ellipse);
    this.ellipse = null;
  }

  paint_ellipse (left, top, rx, ry, angle) {

    if(this.ellipse) {
      if(!left) left = this.ellipse.left;
      if(!top) top = this.ellipse.top;
      if(!rx) rx = this.ellipse.rx;
      if(!ry) ry = this.ellipse.ry;
      if(!angle) angle = this.ellipse.angle;
    }

    this.reset_ellipse();

    // Paint
    this.ellipse = new Fabric.Ellipse({

      originX: "center",
      originY: "center",

      left, top, rx, ry, angle, 
      strokeWidth: 10,
      fill: 'transparent',
      visible: this.visible,

      // Pour la selection par bordure seulement
      perPixelTargetFind: true,
      clickableMargin: 100

      // Gestion UI et des deplacements de la zone
    }).on('scaled', (ev) => {
      let ellipse = this.ellipse;
      this.paint_ellipse(ellipse.left, ellipse.top, ellipse.rx * ellipse.scaleX, ellipse.ry * ellipse.scaleY, ellipse.angle);

      // Limiter deplacement
      let target = ev.transform.target;
      this.ellipse.set('left', Math.min(this.canva.width, Math.max(0, target.left)));
      this.ellipse.set('top', Math.min(this.canva.height, Math.max(0, target.top)));

      this.canva.setActiveObject(this.ellipse);
      this.parametres.on_moving(this, this.extraire_info_ev(ev));
      this.paint_menu();
    }).on('moving', (ev) => {

      // Limiter deplacement
      let target = ev.transform.target;
      this.ellipse.set('left', Math.min(this.canva.width, Math.max(0, target.left)));
      this.ellipse.set('top', Math.min(this.canva.height, Math.max(0, target.top)));

      this.parametres.on_moving(this, this.extraire_info_ev(ev));
      this.paint_menu();
    }).on('rotating', (ev) => { 
      this.parametres.on_moving(this, this.extraire_info_ev(ev)); 
      this.paint_menu();
    }).on('selected', (ev) => {
      this.parametres.on_selected(this);
      this.set_couleurs();
    }).on('deselected', () => { this.set_couleurs() });

    this.canva.add(this.ellipse);

    this.set_couleurs();
    this.paint_menu();
  }

  extraire_info_ev (ev) {
    let original = ev.transform.original;


    //il manquait de l'info pour que le undo redo fonctionne comme du monde
    let destination = {
      top: ev.transform.target.top,
      left: ev.transform.target.left, 
      angle: ev.transform.target.angle,
      rx: ev.transform.target.rx,
      ry: ev.transform.target.ry
    }

    // Cas 'scaled'
    if(ev.action && ev.action.match(/equally|scale/)) {
      original = _.extend(original, {
        rx: ev.target.rx,
        ry: ev.target.ry
      })
    }

    return {
      zone: { id: this.id },
      action: ev.action,
      original,
      destination,
    }
  }

  toggle_visibilite (zone_to_show) {
    if(
      zone_to_show == true
      ||
      zone_to_show == this.mode
    ){
      this.visible = true;
      this.ellipse.visible = true;
      this.ellipse.selectable = true;
    }else{
      this.visible = false;
      this.ellipse.visible = false;
      this.ellipse.selectable = false;
    }
    
    this.paint_menu();
  }

  toggle_etat_jouer () { 
    this.set_etat_jouer(!this.etat_jouer);
    this.parametres.on_toggle_play(this);
    this.parametres.update_general_play();
  }

  set_etat_jouer (etat) {
    this.etat_jouer = etat;
    this.paint_menu();
  }

  get_source_icone_etat_jouer () { return this.etat_jouer ? JouerActif : Jouer }

  get_icone_etat_jouer () { // Singleton
    return new Promise((resolve) => {

      if(this.icone_etat_jouer) return resolve(this.icone_etat_jouer);

      new Fabric.Image.fromURL(this.get_source_icone_etat_jouer(), (ej) => {
        this.icone_etat_jouer = ej;
        ej.originX = "center";
        ej.originY = "center";
        ej.lockMovementX = true;
        ej.lockMovementY = true;
        ej.hasControls = false;

        ej.scaleToWidth(taille_icones);
        ej.scaleToHeight(taille_icones);

        ej.on('mousedown', this.toggle_etat_jouer.bind(this));

        this.canva.add(this.icone_etat_jouer);

        resolve(ej);
      })
    })
  }
  
  get_icone_fonofone () {
    return new Promise((resolve) => {

      if(this.icone_fonofone) return resolve(this.icone_fonofone);

      new Fabric.Image.fromURL(Fonofone, (img) => {
        this.icone_fonofone = img;

        img.originX = "center";
        img.originY = "center";
        img.hasControls = false;

        img.scaleToWidth(taille_icones);
        img.scaleToHeight(taille_icones);

        img.on('mousedown', this.set_original_coords.bind(this));
        img.on('moving', this.deplacer_ellipse.bind(this));
        img.on('mouseup', this.toggle_affichage_fonofone.bind(this));

        this.canva.add(img);

        img.getElement().classList.add('icone-zone');

        resolve(img);
      })
    })
  }

  set_original_coords (options){
    this.icone_zone_original_coords = {
      x: options.absolutePointer.x,
      y: options.absolutePointer.y
    };
  }

  deplacer_ellipse (ev) {
    
    let current_coords = {
      x: ev.pointer.x,
      y: ev.pointer.y
    };

    if(this.is_moving == false){
      if(
        Math.abs(this.icone_zone_original_coords.x - current_coords.x) > TOLERANCE_MIN_ZONE_BOUGE
        ||
        Math.abs(this.icone_zone_original_coords.y - current_coords.y) > TOLERANCE_MIN_ZONE_BOUGE
      ){
        this.is_moving = true;
      }
    }

    if(this.is_moving == true){
      if(ev.e.shiftKey && !this.en_duplication) {
        this.en_duplication = true;
        this.parametres.dupliquer(this);
      }
  
      // Limiter deplacement
      let target = ev.transform.target;
      this.ellipse.set('left', Math.min(this.canva.width, Math.max(0, target.left)));
      this.ellipse.set('top', Math.min(this.canva.height, Math.max(0, target.top)));
  
      this.canva.setActiveObject(this.ellipse);
  
      // récupéré de la fonction this.ellipse.on('moving')
      this.parametres.on_moving(this, this.extraire_info_ev(ev));
      this.paint_menu();
    }
  }

  toggle_affichage_fonofone () {

    this.en_duplication = false;

    let was_moving = this.is_moving;
    this.is_moving = false;

    this.paint_ellipse();

    this.parametres.on_toggle_fonofone(this, was_moving);

  }

  paint_menu () {
    Promise.all([ 
      this.paint_etat_jouer(),
      this.paint_fonofone()
    ]).then(() => {
      this.canva.renderAll();
    })
  }

  async paint_fonofone () {

    let icone = await this.get_icone_fonofone();

    if(!this.visible) {
      icone.visible = false;
      icone.selectable = false;
      return;
    }

    icone.visible = true;
    icone.selectable = true;
    icone.set("left", this.mode == "mix" ? this.ellipse.left : this.ellipse.left - taille_icones);
    icone.set("top", this.ellipse.top);
    icone.setCoords();
  }

  async paint_etat_jouer () {

    let icone = await this.get_icone_etat_jouer();

    // Mode Mix
    if(this.mode == "mix" || !this.visible) {
      icone.visible = false;
      icone.selectable = false;
      return;
    }

    // Mode Pic
    icone.visible = true;
    icone.selectable = true;

    icone.set('left', this.ellipse.get('left') + taille_icones);
    icone.set('top', this.ellipse.get('top'));
    icone.set('angle', this.ellipse.angle);
    icone.setCoords();
    icone.setSrc(this.get_source_icone_etat_jouer(), () => { this.canva.renderAll() });
  }

  set_couleurs () {
    let couleur_bordure = this.mode == "mix" ? couleur_zone_mix : couleur_zone_pic;
    this.ellipse.set('stroke', couleur_bordure);
    this.canva.renderAll();
  }

  toggle_mode (mode) {
    this.mode = mode;
    this.master.gain.setValueAtTime(this.mode == "pic" ? 1 : 0, this.ctx_audio.currentTime);
    this.set_couleurs();
    this.paint_menu();
  }

  initialiser_selection_par_bordure () {
    Fabric.Ellipse.prototype._checkTarget = function(pointer, obj, globalPointer) {
      if (obj &&
        obj.visible &&
        obj.evented &&
        this.containsPoint(null, obj, pointer)) {
        if ((this.perPixelTargetFind || obj.perPixelTargetFind) && !obj.isEditing) {
          var isTransparent = this.isTargetTransparent(obj, globalPointer.x, globalPointer.y);
          if (!isTransparent) { return true; }
        } else {
          var isInsideBorder = this.isInsideBorder(obj);
          if (!isInsideBorder) { return true; }
        }
      }
    }

    Fabric.Ellipse.prototype.isInsideBorder = function(target) {
      var pointerCoords = target.getLocalPointer();
      if (pointerCoords.x > target.clickableMargin &&
        pointerCoords.x < target.getScaledWidth() - clickableMargin &&
        pointerCoords.y > clickableMargin &&
        pointerCoords.y < target.getScaledHeight() - clickableMargin) {
        return true;
      }
    }
  }
}

Zone.prototype.get_next_ref = function () { return Zone.reference += 1 }

