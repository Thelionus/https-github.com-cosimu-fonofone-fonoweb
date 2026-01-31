import WaveSurfer from 'wavesurfer.js';
import Regions from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';

export default {
  data: function () {
    return {
      fps: 25,
      wavesurfer: null,
      wavesurfer_region: null
    };
  },
  methods: {
    paint_region: function () {
      this.wavesurfer_region.start = this.debut_region;
      this.wavesurfer_region.end = this.fin_region;
      this.wavesurfer_region.updateRender();
    }
  },
  mounted: function () {
    

    // Creer l'outil de visualisation
    this.wavesurfer = WaveSurfer.create({
      container: `#${this.waveform_id}`,
      waveColor: '#418ACA',
      height: 100,
      responsive: true,
      fillParent: true,
      plugins: [ Regions.create({ }) ]
    });

    // Creer les regions de l'outil de visualisation
    this.wavesurfer_region = this.wavesurfer.addRegion({
      id: `wavesurfer-region-${this.waveform_id}`,
      color: '#323232' 
    });

    // Informer le module de selection des modifications
    this.wavesurfer.on('region-updated', (region) => {
      let duration = this.buffer.duration;
      let start = region.start / duration;
      let end = region.end / duration;
      this.$emit("update:selection", { debut: start, longueur: end - start });
    });

    // Etre reactif aux modifications de la selection
    this.$watch('modules.selecteur', _.throttle(() => { if(this.buffer) this.paint_region() }, 1000 / this.fps));
  }
}
