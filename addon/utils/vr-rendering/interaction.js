import Ember from 'ember';
import HammerInteraction from 'explorviz-ui-frontend/utils/hammer-interaction';
import HoverHandler from './hover-handler';
import HoverHandlerApp3D from 'explorviz-ui-frontend/utils/application-rendering/hover-handler';
import HoverHandlerLandscape from 'explorviz-ui-frontend/utils/landscape-rendering/hover-handler';
import AlertifyHandler from 'explorviz-ui-frontend/mixins/alertify-handler';

export default Ember.Object.extend(Ember.Evented, AlertifyHandler, {

  scene: null,
  canvas: null,
  canvas2: null,
  camera: null,
  cameraDolly: null,
  renderer: null,
  raycaster: null,
  raycastObjectsLandscape: null,
  controller1: null,
  controller2: null,
  rotationObject: null,
  labeler: null,
  
  vrEnvironment:null,

  colorList: null,
  colorListApp: null,
  font: null,

  application3D: null,
  app3DBinded: false,
  app3DBindedByController: {},

  previousToolTipObjects: {},
  textBox: null,

  highlightedEntities: {},
  highlightedEntitiesApp: {},

  hammerHandler: null,
  hoverHandler: null,
  hoverHandlerLandscape: null,
  hoverHandlerApp3D: null,
  userHeight: null,

  raycastObjects: Ember.computed('rotationObject', function() {
    return this.get('rotationObject.children');
  }),

  setupInteractionApp3D(application3D) {
    this.set('application3D', application3D);
  },

  setupInteraction(scene, canvas, camera, renderer, raycaster, raycastObjectsLandscape, controller1, controller2, parentObject, vrEnvironment, colorList, colorListApp, textBox, userHeight, labeler) {
    this.set('scene', scene);
    this.set('canvas', canvas);
    this.set('camera', camera);
    this.set('renderer', renderer);
    this.set('raycaster', raycaster);
    this.set('raycastObjectsLandscape', raycastObjectsLandscape);
    this.set('controller1', controller1);
    this.set('controller2', controller2);
    this.set('rotationObject', parentObject);
    this.set('vrEnvironment', vrEnvironment);    
    this.set('colorList', colorList);  
    this.set('colorListApp', colorListApp);   
    this.set('textBox', textBox);
	  this.set('userHeight', userHeight);
    this.set('labeler', labeler);

    const self = this;

    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = 256;
    this.get('canvas2').height = 128;

     new THREE.FontLoader()
      .load('three.js/fonts/roboto_mono_bold_typeface.json', function(font) {
        self.set('font', font);
      });

    // Setup interaction for Controller
    self.get('controller1').addEventListener('triggerdown', registerControllerTriggerDown);
    self.get('controller2').addEventListener('triggerdown', registerControllerTriggerDown);
    self.get('controller1').addEventListener('thumbpaddown', registerControllerThumbpadDown);
    self.get('controller2').addEventListener('thumbpaddown', registerControllerThumbpadDown);
    self.get('controller1').addEventListener('thumbpadup', registerControllerThumbpadUp);
    self.get('controller2').addEventListener('thumbpadup', registerControllerThumbpadUp);
    self.get('controller1').addEventListener('gripsdown', registerControllerGripsDownController1);
    self.get('controller2').addEventListener('gripsdown', registerControllerGripsDownController2);
    self.get('controller1').addEventListener('menudown', registerControllerMenuDownController1);
    self.get('controller2').addEventListener('menudown', registerControllerMenuDownController2);
    self.get('controller1').addEventListener('menuup', registerControllerMenuUpController1);
    self.get('controller2').addEventListener('menuup', registerControllerMenuUpController2);

    function registerControllerTriggerDown(event){
      self.onControllerTriggerDown(event);
    } 

    function registerControllerThumbpadDown(event){
      self.onControllerThumbpadDown(event);
    }
     
    function registerControllerThumbpadUp(event){
      self.onThumbpadControllerUp(event);
    }
  
    // function for handling gripsdown for left and right hand
    function registerControllerGripsDownController1(evt){
      self.onControllerGripsDown(evt, false);
    }
    function registerControllerGripsDownController2(evt){
      self.onControllerGripsDown(evt, true);
    } 

    function registerControllerMenuDownController1(event){
      self.onControllerMenuDown(event);
    } 

    function registerControllerMenuDownController2(event){
      self.onControllerMenuDown(event);
    }

    function registerControllerMenuUpController1(event){
      self.onControllerMenuUp(event);
    } 

    function registerControllerMenuUpController2(event){
      self.onControllerMenuUp(event);
    }

    // mouseout handler for disabling notifications
    canvas.addEventListener('mouseout', registerMouseOut, false);

    function registerMouseOut(evt) {
      self.onMouseOut(evt);
    }

    // mouseenter handler for disabling notifications
    canvas.addEventListener('mouseenter', registerMouseEnter, false);

    function registerMouseEnter(evt) {
      self.onMouseEnter(evt);
    }


    canvas.addEventListener('bciaction', registerBCIAction);
        function registerBCIAction(event){
        self.onBCIAction(event);
    }

    // zoom handler    
    canvas.addEventListener('mousewheel', registerMouseWheel, false);

    function registerMouseWheel(evt) {
      self.onMouseWheelStart(evt);
    }

    // init Hammer
    if (!this.get('hammerHandler')) {
      this.set('hammerHandler', HammerInteraction.create());
      this.get('hammerHandler').setupHammer(canvas);
    }

    // init HoverHandler
    if (!this.get('hoverHandler')) {
      this.set('hoverHandler', HoverHandler.create());
    }
     // init HoverHandler
    if (!this.get('hoverHandlerLandscape')) {
      this.set('hoverHandlerLandscape', HoverHandlerLandscape.create());
    }   

    if (!this.get('hoverHandlerApp3D')) {
      this.set('hoverHandlerApp3D', HoverHandlerApp3D.create());
    }

    // hover handler
    self.registerHoverHandler();

    this.setupHammerListener();
    
  },


  /*
   * This method is used to highlight and unhighlight system, nodegroups, packages
   * and clazzes if the controller ray hits them
   * Furthermore this method scales the ray relative to distance of intersection
   */
    checkIntersection(controller){

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    if(intersectedViewObj && this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].id === intersectedViewObj.object.id){
      return;
    }

    // look for highlighted entity 'landscape' and unhighlight it if the same controller id highlighted it
    if(this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].type && this.get('colorList')[this.get('highlightedEntities')[id].type]){  

      let entity = this.get('highlightedEntities')[id];
      let index = "text"+entity.type;

      let name;

      if(entity.type === "nodegroup"){
        index = "textnode";
        
      }
      else if(entity.type === "application"){
        index = "textapp";
       
      }
      name = entity.userData.model.get('name');

      this.get('labeler').redrawLabel(entity, this.get('colorList')[index],name,this.get('colorList')[entity.type]);

    }

    // look for highlighted entity 'app3D' and unhighlight the package it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.model.get('color') && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]){  
      this.get('highlightedEntitiesApp')[id].material.color =  new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]);
    }
    // look for highlighted entity 'app3D' and unhighlight the clazz it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.type && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]){  
      this.get('highlightedEntitiesApp')[id].material.color =  new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]);
    }

      // Case for intersection object present
      if(intersectedViewObj){
        
        // Verify controllers
        let id2;
        if(id === this.get('controller1').id){
          id2 = this.get('controller2').id;
        }
        else{
          id2 = this.get('controller1').id;
        }

        // scale ray distance to distance of intersection
        controller.getObjectByName('controllerLine').scale.z = intersectedViewObj.distance;
		
		// exclude requests
		if (intersectedViewObj.object.name === 'earth'){
			return;
		};
        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
		
        
        if (emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application"){
                    
            if(intersectedViewObj.object.type === "system" || intersectedViewObj.object.type === "nodegroup" || intersectedViewObj.object.type === "application"){

              // Highlight if not aready highlighted by the second controller
              if(!this.get('highlightedEntities')[id2] || (this.get('highlightedEntities')[id2].id && this.get('highlightedEntities')[id2].id !== intersectedViewObj.object.id)){ 

                let index = "text"+intersectedViewObj.object.type;

                let name;

                if(intersectedViewObj.object.type === "nodegroup"){
                  index = "textnode";
                  name = intersectedViewObj.object.userData.model.get('name');
                }
                else if(intersectedViewObj.object.type === "application"){
                  index = "textapp";
                  name = intersectedViewObj.object.userData.model.get('name');
                }
                else{
                  name = emberModel.get('name');
                }
 
                this.get('labeler').redrawLabel(intersectedViewObj.object, this.get('colorList')[index],name,"rgb(255, 0, 0)");

                // save highlighted object and bind it on controller id to quarantee that only this controller can unhighlight it
                this.get('highlightedEntities')[id] = intersectedViewObj.object;
              }
            }
        }
        else if((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded')){
          let color = new THREE.Color("rgb(255, 0, 0)");
          // Highlight if not aready highlighted by the second controller
          if(!this.get('highlightedEntitiesApp')[id2] || (this.get('highlightedEntitiesApp')[id2].id && this.get('highlightedEntitiesApp')[id2].id !== intersectedViewObj.object.id)){
          
            // Check if label of box is hit and highlight box anyway
            if(intersectedViewObj.object.parent.label === intersectedViewObj.object){
              intersectedViewObj.object.parent.material.color = color;
            }
            else{
              intersectedViewObj.object.material.color = color;
            }

            // save highlighted object and bind it on controller id to quarantee that only this controller can unhighlight it
            this.get('highlightedEntitiesApp')[id] = intersectedViewObj.object; 
          }
        }
        else{

          this.get('highlightedEntities')[id] = null;
          // Delete highlighted object entry for app3D
          this.get('highlightedEntitiesApp')[id] = null;
        }
      }
 
      else{
        // Delete highlighted object entry for system and nodegroups
        this.get('highlightedEntities')[id] = null;
        // Delete highlighted object entry for app3D
        this.get('highlightedEntitiesApp')[id] = null;
        // resize ray 
        controller.getObjectByName('controllerLine').scale.z = 5;
      }
  },
  //////// END checkIntersection

  /*
   *  This method is used to allow brain-interface push command
   *
   */
  onControllerMenuDown(evt){
    const controller = evt.target;

    let canvas = $(document)[0];
    let event = new Event("keyup", 
      {
        "bubbles":true, 
        "cancelable":false
    });
    event.ctrlKey=true;
    event.key="b";
    event.controller = controller.id;
    event.controllerFlag = true;
    canvas.dispatchEvent(event);
  },

  /*
   *  This method is used to allow brain-interface pull command
   *
   */
  onControllerMenuUp(evt){
    const controller = evt.target;

    let canvas = $(document)[0];
    let event = new Event("keyup", 
      {
        "bubbles":true, 
        "cancelable":false
    });
    event.ctrlKey=true;
    event.key="b";
    event.controller = controller.id;
    event.controllerFlag = false;
    canvas.dispatchEvent(event);

  },
  /*
   * This method is used to show information 
   * about the intersected object. 
   * The additional parameter assigns a users hand to the controller
   * and adapts the position of the text box. 
   * @method - onControllerGripsDown
   */
  onControllerGripsDown(event, rightHand){

    const controller = event.target;

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    if(intersectedViewObj){
      // Verify controllers
      let id2;
      if(id === this.get('controller1').id){
        id2 = this.get('controller2').id;
      }
      else{
        id2 = this.get('controller1').id;
      }

      // Remove text box if hidden object is not the presoius one
      if(this.get('previousToolTipObjects')[id] && this.get('previousToolTipObjects')[id].id !== intersectedViewObj.object.id){
        controller.remove(controller.getObjectByName('textBox'));  
        this.get('previousToolTipObjects')[id] = null;
      }

      // Create tool tip for intersected object
      if(!this.get('previousToolTipObjects')[id]){
		  
		 // exclude requests
		if (intersectedViewObj.object.name === 'earth'){
			return;
		}; 

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;

        var content;

        if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "node" || emberModelName === "application"){
          content = this.get('hoverHandler').buildContent(emberModel);
        }
        else if(emberModelName === "package" || emberModelName === "clazz" || emberModelName === "component"){ 
          content = this.get('hoverHandler').buildContent(emberModel);

        }
        
        // Clone text box
        let textBox = this.get('textBox').clone();

        let canvas2 = this.get('canvas2');
       
        var ctx = canvas2.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas2.width, canvas2.height);
        ctx.fillStyle = '#FDF5E6';
        ctx.fillRect(0.4, 0.4, canvas2.width - 0.8, canvas2.height - 0.8);
      
        // Draw title
        ctx.font = '20px arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = "center";
        ctx.fillText(content.title, canvas2.width / 2, 20);

        // draw line
        ctx.fillText("-------------------------------------------------", canvas2.width / 2, 32);

        // Spilt up remaining canvas for each entry
        let offset = (canvas2.height-52)/3;
        
        let tempOffset = offset;

        // Position under line
        offset = 52;

        // new font size for entries
        ctx.font = '15px arial';
        // Each entry consist of two values: name and value
        for(var key1 in content.innerContent){
          let left = true; 
          
          // Draw entry
          for(var key2 in content.innerContent[key1]){
            // Draw content on the left (name)
            if(!left){
              ctx.textAlign = "right"; 
              ctx.fillText(content.innerContent[key1][key2], canvas2.width-10, offset);
              left = true;
            }
            // Draw content on the right (value)
            else{
              ctx.textAlign = "left";
              ctx.fillText(content.innerContent[key1][key2], 10, offset);
              left = false;
            }   
          }
          offset += tempOffset;
        }
       
        // create texture out of canvas
        let texture = new THREE.Texture(canvas2);
        // map texture
        let material = new THREE.MeshBasicMaterial({map: texture});

        // Update texture      
        texture.needsUpdate = true;
        // Update mesh material    
        textBox.material = material;

        // position box for tooltip for right and left hand
        if(rightHand){
          textBox.position.x -= 0.2;
        }
        else{
          textBox.position.x += 0.2;
        }

        // Add mesh to controller
        controller.add(textBox);
        this.get('previousToolTipObjects')[id] = intersectedViewObj.object;
      }
    }
    else{
      // Remove stored text box
      controller.remove(controller.getObjectByName('textBox'));  
      this.get('previousToolTipObjects')[id] = null;
    }
  },

  /*
   * This method is used to release the app3D from controller 
   * and put it back into the scene
   */
  onThumbpadControllerUp(event){

    const controller = event.target;

    if(controller.userData.selected !== undefined && controller.userData.selected.name !=="textBox"){
      // set bool for application3D not binded
      this.set('app3DBinded',false);
      this.get('app3DBindedByController')[controller.id] = null;
      // get stored application3D from controller
      var object = controller.userData.selected;
      // transform object back into transformation relative to local space
      object.matrix.premultiply(controller.matrixWorld);
      // split up transforamtion into position, quaternion and scale
      object.matrix.decompose( object.position, object.quaternion, object.scale);
      // add application3D to scene
      this.get('scene').add(object);
      // delete stored application3D 
      controller.userData.selected = undefined;
    }
  },

  // Old method to handle application 3D panning
  /*handleController(controller){
    var tempMatrix = new THREE.Matrix4();
    // Id to verfify which controller triggered the event
    let id = controller.id;
    
    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));
    
    // Case for intersection object present
    if(intersectedViewObj) {
          
      // Panning controller - only one controller can move the object 
      
      if(!this.get('intersectionObjectID') || this.get('intersectionObjectID') === intersectedViewObj.object.id){
        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
        
      
            
        let movement = new THREE.Vector3();
      
        var xPos = controller.position.x;
        var yPos = controller.position.y;
        var zPos = controller.position.z;
        if (this.get('previousControllerPosition').x == null) {
          this.get('previousControllerPosition').x = xPos;
          this.get('previousControllerPosition').y = yPos;
          this.get('previousControllerPosition').z = zPos;
        }
        var xDiff = xPos - this.get('previousControllerPosition').x;
        var yDiff = yPos - this.get('previousControllerPosition').y;
        var zDiff = zPos - this.get('previousControllerPosition').z;
        
        movement.x = - xDiff;
        movement.y = yDiff; 
        movement.z = - zDiff;   
        var xPosIntersect = intersectedViewObj.point.x;
        var yPosIntersect = intersectedViewObj.point.y;
        var zPosIntersect = intersectedViewObj.point.z;
        if (this.get('previousIntersectionPoint').x == null) {
          this.get('previousIntersectionPoint').x = xPosIntersect;
          this.get('previousIntersectionPoint').y = yPosIntersect;
        }
        movement.x += xPosIntersect - this.get('previousIntersectionPoint').x; 
        movement.y += yPosIntersect - this.get('previousIntersectionPoint').y;
        movement.z += zPosIntersect - this.get('previousIntersectionPoint').z;
        // Move object if button pressed
        if(controller.getButtonState('thumbpad')){ 
          if (emberModelName === "component"){
            this.get('application3D').position.x += movement.x;
            this.get('application3D').position.y += movement.y;
          }
          else{
            this.get('vrEnvironment').position.x += movement.x;
            this.get('vrEnvironment').position.y += movement.y;
          }
        }
        
        // save old controller position and point of intersect
        this.set('previousControllerPosition', new THREE.Vector3(xPos,yPos,zPos));
        
        this.set('previousIntersectionPoint', intersectedViewObj.point);
      }
      // rotate object
      const gamepad = controller.getGamepad();
      console.log(this.get('vrEnvironment').rotation);
      if(gamepad.buttons[0].touched && !gamepad.buttons[0].pressed){
       
      // trackpad touched
      if (this.get('previousControllerAxes').x == null) {
        this.get('previousControllerAxes').x = gamepad.axes[1];
        this.get('previousControllerAxes').y = gamepad.axes[0];
      }
      // rotate based on trackpad
      this.get('vrEnvironment').rotation.x += gamepad.axes[1] - this.get('previousControllerAxes').x;    
      this.get('vrEnvironment').rotation.z += gamepad.axes[1] - this.get('previousControllerAxes').y;       
      
      this.get('previousControllerAxes').x = gamepad.axes[1];
      this.get('previousControllerAxes').y = gamepad.axes[0];
      } 
      else {
        this.get('previousControllerAxes').x = null;
        this.get('previousControllerAxes').y = null;
      }  
    }
  }, // END handleController */




  /*
    This method is used to open/close systems, nodegroups and components of 
    3D application. Raycast on "2D" application on node and button down
    => application 3D is created width coordinates of intersection point 
  */
  onControllerTriggerDown(event){

    const controller = event.target;

    if(!this.get('app3DBindedByController')[controller.id]){

      var tempMatrix = new THREE.Matrix4();

      tempMatrix.identity().extractRotation( controller.matrixWorld );
      
      const origin = new THREE.Vector3();
      origin.setFromMatrixPosition(controller.matrixWorld);

      const direction = new THREE.Vector3(0,0,-1);
      direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

      const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
        null, this.get('raycastObjectsLandscape'));

      // open and close systems+nodegroups´+c packages and clazzes
      if(intersectedViewObj) {
		  
		// exclude requests
		if (intersectedViewObj.object.name === 'earth'){
			return;
		}; 

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
        
        if(emberModelName === "application"){

          if(emberModel.get('components').get('length') === 0) {
            // no data => show message

            const message = "Sorry, no details for <b>" + emberModel.get('name') + 
              "</b> are available.";

            this.showAlertifyMessage(message);

            // Delete existing app anyway
            if(!this.get('app3DBinded')){
              this.trigger('removeApplication');
            }
          } else {
            // data available => open application-rendering
            this.closeAlertifyMessages();
            if(!this.get('app3DBinded')){
              this.trigger('showApplication', emberModel, intersectedViewObj.point);
            }
            
          }
        } 
        
        else if (emberModelName === "nodegroup" || emberModelName === "system"){
          emberModel.setOpened(!emberModel.get('opened'));
          this.trigger('redrawScene'); 
        }
        else if((emberModelName === "component" ||emberModelName === "clazz") && !this.get('app3DBinded')){
          emberModel.setOpenedStatus(!emberModel.get('opened'));
          this.trigger('redrawApp');
        }
      }
    }
  },

  

  /* 
    This method is used to move and rotate application3D
  */
  onControllerThumbpadDown(event){

    const controller = event.target;

    var tempMatrix = new THREE.Matrix4();

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    if(intersectedViewObj) {
		
	  // exclude requests
	  if (intersectedViewObj.object.name === 'earth'){
		return;
	  };	

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      if((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded') ){
        
        // set bool for application3D binded
        this.set('app3DBinded',true);
        this.get('app3DBindedByController')[controller.id] = "true";

        // get inverse of controller transoformation      
        tempMatrix.getInverse(controller.matrixWorld);

        var object = this.get('application3D');

        // set transforamtion relative to controller transformation
        object.matrix.premultiply( tempMatrix );
        // split up matrix into position, quaternion and scale
        object.matrix.decompose( object.position, object.quaternion, object.scale);
        // add object to controller
        controller.add(object);
        // store object 
        controller.userData.selected = object; 
      }
    }
  },

  onMouseWheelStart(evt) {

    // Hide (old) tooltip
    this.get('hoverHandlerLandscape').hideTooltip();
    this.get('hoverHandlerApp3D').hideTooltip();

    var delta = evt.wheelDelta;
	
    // zoom in
    if (evt.controllerID == this.get('controller1').id) {
		  let posZ = this.get('vrEnvironment').position.y - 0.1;
		  if(posZ > 0){
			 this.get('vrEnvironment').translateZ(-0.1);
			 this.get('vrEnvironment').updateMatrix();
		  }
    }
    // zoom out
    else {
		  let posZ = this.get('vrEnvironment').position.y + 0.1;
		  if(posZ < this.get('userHeight')/2){
			 this.get('vrEnvironment').translateZ(0.1);
			 this.get('vrEnvironment').updateMatrix();
		  }
    }
	
  },


  onMouseOut() {
    this.set('hoverHandlerLandscape.enableTooltips', false);
    this.get('hoverHandlerLandscape').hideTooltip();
    this.set('hoverHandlerApp3D.enableTooltips', false);
    this.get('hoverHandlerApp3D').hideTooltip();
  },


  onMouseEnter() {
    this.set('hoverHandlerLandscape.enableTooltips', true);
    this.set('hoverHandlerApp3D.enableTooltips', true);   
  },


  setupHammerListener() {

    const self = this;

    this.get('hammerHandler').on('doubleClick', function(mouse) {
      self.handleDoubleClick(mouse);
    });

    this.get('hammerHandler').on('panning', function(delta, event) {
      self.handlePanning(delta, event);
    });

    this.get('hammerHandler').on('panningEnd', function(mouse) {
      self.handleHover(mouse);
    });

    this.get('hammerHandler').on('singleClick', function(mouse) {
      self.handleSingleClick(mouse);
    });    

  },

  registerHoverHandler() {

    const self = this;

    // custom event for mousemovement end
    (function (delay) {
        var timeout;
        self.get('canvas').addEventListener('mousemove', function (evt) {
            clearTimeout(timeout);
            timeout = setTimeout(function () {
              var event = new CustomEvent("mousestop", {
                  detail: {
                      clientX: evt.clientX,
                      clientY: evt.clientY
                  },
                  bubbles: true,
                  cancelable: true
              });
              evt.target.dispatchEvent(event);
            }, delay);
            
            // When moving, hide (old) tooltip
            self.get('hoverHandlerLandscape').hideTooltip();
            self.get('hoverHandlerApp3D').hideTooltip();
        });
    })(300);

    
    this.get('canvas').addEventListener('mousestop', registerHoverHandler, false);

    function registerHoverHandler(evt) {
      self.handleHover(evt);
    }
  },


  removeHandlers() {
    this.get('hammerHandler.hammerManager').off();
    this.get('canvas').removeEventListener('mousewheel', this.onMouseWheelStart);
    this.get('canvas').removeEventListener('mousestop', this.handleHover);
    this.get('canvas').removeEventListener('mouseenter', this.onMouseEnter);
    this.get('canvas').removeEventListener('mouseout', this.onMouseOut);
    this.get('controller1').removeEventListener('triggerdown',this.onControllerTriggerDown);
    this.get('controller2').removeEventListener('triggerdown',this.onControllerTriggerDown);
    this.get('controller1').removeEventListener('thumbpaddown',this.onControllerThumbpadDown);
    this.get('controller2').removeEventListener('thumbpaddown',this.onControllerThumbpadDown);
    this.get('controller1').removeEventListener('thumbpadup',this.onControllerThumbpadUp);
    this.get('controller2').removeEventListener('thumbpadup',this.onControllerThumbpadUp);
    this.get('controller1').removeEventListener('gripsdown',this.onControllerGrispDown);
    this.get('controller2').removeEventListener('gripsdown',this.onControllerGrispDown);

    this.get('controller1').removeEventListener('menudown',this.onControllerThumbpadUp);
    this.get('controller2').removeEventListener('menudown',this.onControllerThumbpadUp);
    this.get('controller1').removeEventListener('menuup',this.onControllerGrispDown);
    this.get('controller2').removeEventListener('menuup',this.onControllerGrispDown);

  },


  handleDoubleClick(mouse) {

    const origin = {};

    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft+0.66)) / 
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop+0.665)) / 
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    const intersectedViewObj = this.get('raycaster').raycasting(null, origin, 
      this.get('camera'), this.get('raycastObjectsLandscape'));

    if(intersectedViewObj) {

      // hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();
	  
	  // exclude requests
	  if (intersectedViewObj.object.name === 'earth'){
	    return;
	  };

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;
      
      if(emberModelName === "application"){

        if(emberModel.get('components').get('length') === 0) {
          // no data => show message

          const message = "Sorry, no details for <b>" + emberModel.get('name') + 
            "</b> are available.";

          this.showAlertifyMessage(message);

          // Delete existing app anyway
          this.trigger('removeApplication');

        } else {
          // data available => open application-rendering
          this.closeAlertifyMessages();
          this.trigger('showApplication', emberModel, intersectedViewObj.point);
        }  
      } 
      else if (emberModelName === "nodegroup" || emberModelName === "system"){
        emberModel.setOpened(!emberModel.get('opened'));
        this.trigger('redrawScene');
      }
      else if(emberModelName === "component"){
        emberModel.setOpenedStatus(!emberModel.get('opened'));
        this.trigger('redrawApp', emberModel);
      }
    }
  },

  handleSingleClick(mouse) {

    const origin = {};

    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft+0.66)) / 
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop+0.665)) / 
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    const intersectedViewObj = this.get('raycaster').raycasting(null, origin, 
      this.get('camera'), this.get('raycastObjectsLandscape'));

    let id = 123;

    // look for highlighted entity 'landscape' and unhighlight it if the same controller id highlighted it
    if(this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].type && this.get('colorList')[this.get('highlightedEntities')[id].type]){  
      this.get('highlightedEntities')[id].material.color =  new THREE.Color(this.get('colorList')[this.get('highlightedEntities')[id].type]);
      

      let entity = this.get('highlightedEntities')[id];
      let index = "text"+entity.type;

      let name;

      if(entity.type === "nodegroup"){
        index = "textnode";
        
      }
      else if(entity.type === "application"){
        index = "textapp";
       
      }
      name = entity.userData.model.get('name');

      this.get('labeler').redrawLabel(entity, this.get('colorList')[index],name,this.get('colorList')[entity.type]);

    }

    // look for highlighted entity 'app3D' and unhighlight the package it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.model.get('color') && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]){  
      this.get('highlightedEntitiesApp')[id].material.color =  new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]);
    }
    // look for highlighted entity 'app3D' and unhighlight the clazz it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.type && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]){  
      this.get('highlightedEntitiesApp')[id].material.color =  new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]);
    }
    // Case for intersection object present
    if(intersectedViewObj) {

      // hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();
	  
	  // exclude requests
	  if (intersectedViewObj.object.name === 'earth'){
	    return;
	  };

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;
        
      if (emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application"){
               
          if(intersectedViewObj.object.type === "system" || intersectedViewObj.object.type === "nodegroup" || intersectedViewObj.object.type === "application"){
        
              let index = "text"+intersectedViewObj.object.type;

              let name;

              if(intersectedViewObj.object.type === "nodegroup"){
                index = "textnode";
                name = intersectedViewObj.object.userData.model.get('name');
              }
              else if(intersectedViewObj.object.type === "application"){
                index = "textapp";
                name = intersectedViewObj.object.userData.model.get('name');
              }
              else{
                name = emberModel.get('name');
              }
                console.log(name);
              this.get('labeler').redrawLabel(intersectedViewObj.object, this.get('colorList')[index],name,"rgb(255, 0, 0)");

              // save highlighted object and bind it on controller id to quarantee that only this controller can unhighlight it
              this.get('highlightedEntities')[id] = intersectedViewObj.object;
         }
      }
      else if(emberModelName === "component" || emberModelName === "clazz"){
        let color = new THREE.Color("rgb(255, 0, 0)");

        // Check if label of box is hit and highlight box anyway
        if(intersectedViewObj.object.parent.label === intersectedViewObj.object){
          intersectedViewObj.object.parent.material.color = color;
        }
        else{
          intersectedViewObj.object.material.color = color;
        }

        // save highlighted object and bind it on controller id to quarantee that only this controller can unhighlight it
        this.get('highlightedEntitiesApp')[id] = intersectedViewObj.object; 
      }
    }
    else{
      // Delete highlighted object entry for system and nodegroups
      this.get('highlightedEntities')[id] = null;
      // Delete highlighted object entry for app3D
      this.get('highlightedEntitiesApp')[id] = null;
    }
  },



  handlePanning(delta, event) {

    if(event.button === 1){
      // translate camera
      const entity = this.get('scene');
      //console.log(this.get('scene'));

      var distanceXInPercent = (delta.x /
        parseFloat(this.get('renderer').domElement.clientWidth)) * 100.0;

      var distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 100.0;

      for (let i = entity.children.length - 1; i >= 0 ; i--) {
        let child = entity.children[i];
    
        if(child.name === 'landscape' || child.name === 'app3D'){

          child.position.x = child.position.x + distanceXInPercent;
          child.position.y = child.position.y - distanceYInPercent;

        }
     }
    }
  },


  handleHover(evt) {

    const mouse = {
      x: evt.detail.clientX,
      y: evt.detail.clientY
    };

    const origin = {};

    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft+0.66)) / 
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop+0.665)) / 
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    const intersectedViewObj = this.get('raycaster').raycasting(null, origin, 
      this.get('camera'), this.get('raycastObjectsLandscape'));

    if(intersectedViewObj) {
      // exclude requests
	  if (intersectedViewObj.object.name === 'earth'){
	    return;
	  };
		
      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "node" || emberModelName === "application"){
        this.get('hoverHandlerLandscape').showTooltip(mouse, emberModel);
      }
      else if(emberModelName === "package" || emberModelName === "clazz" || emberModelName === "component"){ 
        this.get('hoverHandlerApp3D').showTooltip(mouse, emberModel);
      }

    }

  },

  onBCIAction(evt){
    let mentalCommands = {2 : mcPUSH, 4: mcPULL};

    const self = this;

    mentalCommands[evt.mentalCommand](evt);

    function mcPUSH(evt){
          // Hide (old) tooltip
      self.get('hoverHandlerLandscape').hideTooltip();
      self.get('hoverHandlerApp3D').hideTooltip();

      var delta = evt.wheelDelta;
  
      // zoom in
      if (evt.controllerID == self.get('controller1').id) {
        let posZ = self.get('vrEnvironment').position.y - 0.1;
        if(posZ > 0){
          self.get('vrEnvironment').translateZ(-0.1);
          self.get('vrEnvironment').updateMatrix();
        }
      }
    // zoom out
      else {
        let posZ = self.get('vrEnvironment').position.y + 0.1;
        if(posZ < self.get('userHeight')/2){
          self.get('vrEnvironment').translateZ(0.1);
          self.get('vrEnvironment').updateMatrix();
        }
      }
    }

    function mcPULL(){
                // Hide (old) tooltip
    self.get('hoverHandlerLandscape').hideTooltip();
    self.get('hoverHandlerApp3D').hideTooltip();

    var delta = evt.wheelDelta;
  
    // zoom in
    if (evt.controllerID == self.get('controller1').id) {
      self.get('vrEnvironment').rotateZ(0.1);
      }
    // zoom out
    else {
      self.get('vrEnvironment').rotateZ(-0.1);
      }
      self.get('vrEnvironment').updateMatrix();
    }
  }
});
