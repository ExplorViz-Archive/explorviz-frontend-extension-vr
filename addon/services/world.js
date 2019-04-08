import Service from '@ember/service';

export default Service.extend({
  scene: null, // Root element of Object3d's - contains all visble objects
  interaction: null, //Class which handles mouse/keyboard/controller interaction
  vrEnvironment: null, // Contains vrLandscape and vrCommunications
  environmentOffset : null, // Tells how much the environment position should differ from the floor center point
});
