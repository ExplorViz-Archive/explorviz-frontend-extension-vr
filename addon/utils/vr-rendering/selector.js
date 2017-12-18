import Ember from 'ember';

/*
 * This util is used to handle selecting components by
 * highlighting the component and the belonging communication lines
 * 
 */
export default Ember.Object.extend({

  latestApplication: null,

  saveLatestApplication(application){
    this.set('latestApplication', application);
  },

  /*
   *  This method is used to highlight the communication lines of
   *  the intersected object. Highlight all communication lines
   *  if "undefined" or "null" is passed
   */
  highlightAppCommunication(entity) {

    const communicationsAccumulated = this.get('latestApplication').get('communicationsAccumulated');

    communicationsAccumulated.forEach((commu) => {

      if(entity === null || entity === undefined){
        commu.state = "SHOW_DIRECTION_IN_AND_OUT";
      }
      else {
        if ((commu.source != null && commu.source.get('fullQualifiedName') === entity.get('fullQualifiedName')) ||
          (commu.target != null && commu.target.get('fullQualifiedName') === entity.get('fullQualifiedName'))) {

          commu.state = "SHOW_DIRECTION_IN_AND_OUT";
        } 
        else {
          commu.state = "TRANSPARENT";
        }
      } 
    });
  }
  
});
