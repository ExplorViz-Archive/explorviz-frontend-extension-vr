import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed, action, get, set, observer } from '@ember/object';

export default class VRController extends Controller.extend({}) 
{
  @service("reload-handler") reloadHandler;
  @service("rendering-service") renderingService;
  @service("repos/landscape-repository") landscapeRepo;
  @service("additional-data") additionalData;

  @computed('landscapeRepo.latestApplication')
  get showLandscape() {
    return !get(this, 'landscapeRepo.latestApplication');
  }

  @action
  resize() {
    get(this, 'renderingService').resizeCanvas();
  }

  @action
  resetView() {
    get(this, 'renderingService').reSetupScene();
    get(this, 'plotlyTimelineRef').continueTimeline(get(this, "selectedTimestampRecords"));
  }

  // @Override
  cleanup() {
    this._super(...arguments);
  }

}