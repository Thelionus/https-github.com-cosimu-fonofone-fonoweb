//https://stackoverflow.com/questions/49569061/is-singleton-guaranteed-to-be-preserved-during-webpack-or-rollup-module-bundling

let instance_clavier_listener;

export default class ClavierListener {
  constructor () {
    
    // Singleton
    if(instance_clavier_listener) return instance_clavier_listener;
    instance_clavier_listener = this;
    
    // Ecoute
    document.addEventListener('keydown', (event) => {
      if(this.combinaison_valide(event)) {
        this.dispatch(event.key);
        event.preventDefault();
      }
    });

    // Focus d'un élément (p.ex. empêcher le backspace quand le focus est sur un input)
    document.addEventListener('focusin', (event) => {
      const ele = event.target;
      let tagName = ele.tagName;
      if(tagName === "INPUT"){
        let validType = ['text', 'password', 'number', 'email', 'tel', 'url', 'search', 'date', 'datetime', 'datetime-local', 'time', 'month', 'week'];
        let eleType = ele.type;
        if(validType.includes(eleType)){
          this.input_focus = true;
        }
      }
    });
    document.addEventListener('focusout', (event) => {
      this.input_focus = false;
    });

    // Variable qui contient la liste des actions
    this.actions = {};
    this.input_focus = false;
  }

  dispatch (key) {
    _.each(this.actions[key], (action) => { action(); });
  }

  register (key, cb) {
    if(!this.actions[key]) this.actions[key] = [];
    this.actions[key].push(cb);
  }

  combinaison_valide (ev) {
    if(
      ev.key == "Backspace"
      &&
      this.input_focus == true
    ){
      return false;
    }

    return ((ev.ctrlKey || ev.metaKey) && Object.keys(this.actions).includes(ev.key))
    || ev.key == "Backspace";
  }
}

