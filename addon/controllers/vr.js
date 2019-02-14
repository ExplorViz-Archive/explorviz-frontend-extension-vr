import Ember from 'ember';
const { computed, Controller, inject, observer } = Ember;

export default Controller.extend({

  reloadHandler: inject.service("reload-handler"),
  renderingService: inject.service(),
  landscapeRepo: inject.service("repos/landscape-repository"),

  showLandscape: computed('landscapeRepo.latestApplication', function() {
    return !this.get('landscapeRepo.latestApplication');
  }),

  actions: {

    resetView() {
      this.get('renderingService').reSetupScene();
    }


  }
});