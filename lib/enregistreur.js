import Recorder from "recorder-js";

export default class Enregistreur {
  constructor(ctx, stream) {
    this.recorder = new Recorder(ctx);
    this.recorder.init(stream);
  }

  debuter () {
    this.recorder.start();
  }

  terminer () {
    return new Promise ((resolve) => {
      this.recorder.stop().then(({blob, buffer}) => { resolve(blob); });
    });
  }
}
