import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import Controller from '@ember/controller';

export default Controller.extend({

  reloadHandler: service(),
  renderingService: service(),
  landscapeRepo: service("repos/landscape-repository"),
  additionalData: service(),

  showLandscape: computed('landscapeRepo.latestApplication', function() {
    return !this.get('landscapeRepo.latestApplication');
  }),

  actions: {
    resetView() {
      this.get('renderingService').reSetupScene();
    }
  },

  // @Override
  cleanup() {
    this._super(...arguments);
  }
});