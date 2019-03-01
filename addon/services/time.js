import Service from '@ember/service';

export default Service.extend({
  _deltaTime: null, // Time between two frames in seconds
  _lastFrameTime: null, // Time between two frames in seconds

  init() {
    this._super(...arguments);
    this.set('_deltaTime', 0);
    this.set('_lastFrameTime', Date.now() / 1000.0);
  },

  update() {
    let currentTime = Date.now() / 1000.0;
    this.set('_deltaTime', currentTime - this.get('_lastFrameTime'));
    this.set('_lastFrameTime', currentTime);
  },

  getDeltaTime() {
    return this.get('_deltaTime');
  }
});
