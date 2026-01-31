export default class History {
  constructor () {
    this.actions = []
    this.redos = []
    this.types_actions = []
    this.undoing = false;
  }

  push (nom, donnees) {

    
    if(this.undoing) return;

    let a = new Action(nom, donnees);
    let dernier = this.actions[this.actions.length - 1];

    // L'idee c'est ilde constamment overwriter les donnees de l'action de deplacemetn
    // pour toujours avoir les coordonnees de la destination a jour. avant de corriger
    // la fonction, les donnees etaient juste enregistrer avant le deplacement.
    // 
    // avec la maniere que les undos redos ont ete implante, il faut que les deux valeures
    // soient garrocher en meme temps. l'action undo inclut la resolution redo grosso-modo

    if(a.nom == "DEPLACER_ZONE") { 
      if(_.isEqual(a.donnees.original, dernier.donnees.original)) {
        this.actions[this.actions.length - 1] = a;
        return;
      } 
    }   
    
    if(_.isEqual(a, dernier)) {
      return;
    }

    //clear la stack de redos quand une nouvelle action est posee
    this.redos = [];
    this.actions.push(a);
  }

  //stack de undos
  //quand on undo, l'action est pushee dans la stack du redo 
  //ajout de try/catch
  //en cas d'erreur, l'action problematique est supprimee

  undo () {

    if(this.actions.length == 0) return console.log("Pile vide");
    this.undoing = true;

    try {

      let action = this.actions[this.actions.length -1];
      let type_action = _.find(this.types_actions, {nom: action.nom})
      type_action.fn(action.donnees);
      //console.log("undo",action.donnees);
      this.actions.pop();
      this.redos.push(action);

    } catch(error) {
      this.actions.pop();
      console.error(error.message);
    }

    this.undoing = false;
  }



  //stack de redos
  //quadn on redo, l'action est repushee dans la stack du undo
  //ajout de try/catch
  //en cas d'erreur, l'action problematique est supprimee

  redo () {

    if(this.redos.length == 0) return console.log("Aucun redo disponible");
    this.undoing = true;
    
    try {
  
      let action = this.redos[this.redos.length - 1];
      let type_action = _.find(this.types_actions, {nom: action.nom})
      type_action.original(action.donnees)
      //console.log("redo",action.donnees);
      this.redos.pop();
      this.actions.push(action);

    } catch(error) {
      this.redos.pop();
      console.error(error.message);
    }

    this.undoing = false;
  }

add_type_action (nom, original, fn) {
    this.types_actions.push(new TypeAction(nom, original, fn));
  }
}


//original a ete ajoute pour feeder la solution au redo
class TypeAction {
  constructor (nom, original, fonction_inverse) {
    this.nom = nom;
    this.fn = fonction_inverse;
    this.original = original; //ajoute par wilibertxxiv
  }
}

class Action {
  constructor (nom, donnees) {
    this.nom = nom;
    this.donnees = donnees;
  }
}
