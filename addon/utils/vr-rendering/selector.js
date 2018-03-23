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
   *
   *  TODO: Complete adaptation to latest changes of model in backend
   */
  highlightAppCommunication(entity) {

    const outgoingClazzCommunications = this.get('latestApplication').get('cumulatedClazzCommunications');

    if(outgoingClazzCommunications != null){

      outgoingClazzCommunications.forEach((clazzCommunication) => {

        if(entity === null || entity === undefined){
          outgoingClazzCommunications.state = "TRANSPARENT";
          
        }
        else{
          if ((clazzCommunication.sourceClazz != null && clazzCommunication.get('sourceClazz').get('fullQualifiedName') === entity.get('fullQualifiedName')) ||
          (clazzCommunication.targetClazz != null && clazzCommunication.get('targetClazz').get('fullQualifiedName') === entity.get('fullQualifiedName'))) {
            clazzCommunication.state = "NORMAL";

          } 
          else {
            clazzCommunication.state = "TRANSPARENT";
          }
        }
      });
    } 
    
  }
  
});
