import EmberObject from '@ember/object';
import { inject as service } from '@ember/service';

/*
 * This util is used to handle selecting components by
 * highlighting the component and the belonging communication lines
 * 
 */
export default EmberObject.extend({

  store: service('store'),

  /*
   *  This method is used to highlight the communication lines of
   *  the intersected object. Highlight all communication lines
   *  if "undefined" or "null" is passed
   *
   *  TODO: Complete adaptation to latest changes of model in backend
   */
  highlightAppCommunication(entity, app) {

    const outgoingClazzCommunications = app.get('drawableClazzCommunications');

    if(outgoingClazzCommunications != null){

      outgoingClazzCommunications.forEach((clazzCommunication) => {

        if(entity === null || entity === undefined){
          outgoingClazzCommunications.set("state", "TRANSPARENT");
        }
        else{
          if ((clazzCommunication.sourceClazz != null && clazzCommunication.get('sourceClazz').get('fullQualifiedName') === entity.get('fullQualifiedName')) ||
          (clazzCommunication.targetClazz != null && clazzCommunication.get('targetClazz').get('fullQualifiedName') === entity.get('fullQualifiedName'))) {
            clazzCommunication.set("state", "NORMAL");
          } 
          else {
             clazzCommunication.set("state", "TRANSPARENT");
          }
        }
      });
    } 
    
  }
  
});
