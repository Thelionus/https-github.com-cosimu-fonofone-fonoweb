import * as FilePond from 'filepond';
import 'filepond/dist/filepond.min.css';
import FilePondPluginFileEncode from 'filepond-plugin-file-encode';

FilePond.registerPlugin(FilePondPluginFileEncode);

export default {
  methods: {
    // Passer l'element, et une liste de callbacks
    init_filepond: function (parent_el, callback) {

      // Upload fichiers
      let filepond = FilePond.create({ 
        name: 'filepond',
        credits: false,
        labelIdle: "Déposez vos fichiers ou <span class='filepond--label-action'>Cliquez ici</span>" // https://github.com/pqina/filepond/issues/39
      });

      //  filepond.labelIdle = this.$t("filepond.idle");
      parent_el.appendChild(filepond.element);
      filepond.element.addEventListener('FilePond:addfile', (e) => { callback(e.detail.file); });
    }
  }
}
