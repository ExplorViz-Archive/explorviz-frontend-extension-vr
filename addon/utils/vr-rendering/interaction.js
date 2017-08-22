import Ember from 'ember';
import HammerInteraction from 'explorviz-ui-frontend/utils/hammer-interaction';
import HoverHandler from './hover-handler';
import HoverHandlerApp3D from 'explorviz-ui-frontend/utils/application-rendering/hover-handler';
import HoverHandlerLandscape from 'explorviz-ui-frontend/utils/landscape-rendering/hover-handler';
import AlertifyHandler from 'explorviz-ui-frontend/mixins/alertify-handler';
//import Highlighter from './highlighter';

export default Ember.Object.extend(Ember.Evented, AlertifyHandler, {

  scene: null,
  canvas: null,
  camera: null,
  cameraDolly: null,
  renderer: null,
  raycaster: null,
  raycastObjectsLandscape: null,
  controller1: null,
  rotationObject: null,
  controller2: null,
  //highlighter: null, 
  toolTips: {},
  vrEnvironment:null,
  colorList: null,
  font: null,

  app3DBinded: false,

  //previousControllerOrigin: new THREE.Vector3(),
  //previousIntersectionPoint: new THREE.Vector3(),
  //previousControllerdirektion: new THREE.Vector3(),
  //previousControllerPosition: new THREE.Vector3(),
  //previousControllerAxes: new THREE.Vector2(),

  oldControllerPosition: new THREE.Vector3(),
  previousDistance: null,
  application3D: null,
  colorListApp: null,
  textBox: null,


  highlightedEntities: {},
  highlightedEntitiesApp: {},

  hammerHandler: null,
  hoverHandler: null,
  hoverHandlerLandscape: null,
  hoverHandlerApp3D: null,

  raycastObjects: Ember.computed('rotationObject', function() {
    return this.get('rotationObject.children');
  }),

  setupInteractionApp3D(application3D) {
    this.set('application3D', application3D);
  },

  setupInteraction(scene, canvas, camera, renderer, raycaster, raycastObjectsLandscape, controller1, controller2, parentObject, vrEnvironment, colorList, colorListApp, cameraDolly, textBox) {
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
    this.set('cameraDolly', cameraDolly);  
    this.set('textBox', textBox);  


   


    const self = this;

     new THREE.FontLoader()
      .load('three.js/fonts/roboto_mono_bold_typeface.json', function(font) {
        self.set('font', font);
      });

    // Interaction for Controller
    self.get('controller1').addEventListener('triggerdown', registerControllerTriggerDownController);
    self.get('controller1').addEventListener('thumbpaddown', registerControllerThumbpadDownController);
    self.get('controller1').addEventListener('thumbpadup', registerControllerThumbpadUpController);
    self.get('controller1').addEventListener('gripsdown', registerControllerGrispDownController);


    function registerControllerTriggerDownController(evt){
      console.log("trigger down");
      self.onControllerTriggerDown(evt);
    }    

    function registerControllerGrispDownController(evt){
      console.log("grisp down");
      self.onControllerGrispDown(evt);
    }

    function registerControllerThumbpadDownController(evt){
      self.onThumbpadControllerDown(evt);
    }
   

    function registerControllerThumbpadUpController(evt){
      self.onThumbpadControllerUp(evt);
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

    // look for highlighted entity and unhighlight it if the same controller id highlighted it
    if(this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].type && this.get('colorList')[this.get('highlightedEntities')[id].type]){  
      //console.log("highlightedEntities", this.get('highlightedEntities')[id], id);
      this.get('highlightedEntities')[id].material.color =  new THREE.Color(this.get('colorList')[this.get('highlightedEntities')[id].type]);
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

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;

        let color = new THREE.Color("rgb(255, 0, 0)");
          
        if (emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application"){
                    
            if(intersectedViewObj.object.type === "system" || intersectedViewObj.object.type === "nodegroup" || intersectedViewObj.object.type === "application" || intersectedViewObj.object.parent.label === intersectedViewObj.object){

              // Highlight if not aready highlighted by the second controller
              if(!this.get('highlightedEntities')[id2] || (this.get('highlightedEntities')[id2].id && this.get('highlightedEntities')[id2].id !== intersectedViewObj.object.id)){ 


                // Check if label of box is hit and highlight box anyway
                if(intersectedViewObj.object.parent.label === intersectedViewObj.object){
                  intersectedViewObj.object.parent.material.color = color;
                }
                else{
                  intersectedViewObj.object.material.color = color;
                }

                // save highlighted object and bind it on controller id to quarantee that only this controller can unhighlight it
                this.get('highlightedEntities')[id] = intersectedViewObj.object;
              }
            }
        }
        else if(emberModelName === "component" || emberModelName === "clazz"){

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
      }
 
      else{
        // Delete highlighted object entry for system and nodegroups
        this.get('highlightedEntities')[id] = null;
        // Delete highlighted object entry for app3D
        this.get('highlightedEntitiesApp')[id] = null;
        // resize ray 
        controller.getObjectByName('controllerLine').scale.z = 5;
      }
      /*if(controller.getButtonState('thumbpad') && controller.userData.selected !== undefined){
        if(!this.get('oldControllerPosition')){
          console.log("undefined",this.get('oldControllerPosition'));
          this.set('oldControllerPosition', new THREE.Vector3(controller.position.x,controller.position.y,controller.position.z));
        }
        let position = new THREE.Vector3(controller.position.x,controller.position.y,controller.position.z);
        let diff = this.get('oldControllerPosition').distanceTo(position);
        
        if(diff>0.05){
          console.log("speed:",diff, controller);

        }
        
        

        this.set('oldControllerPosition', new THREE.Vector3(controller.position.x,controller.position.y,controller.position.z));

      }*/
  },
  //////// END checkIntersection


  /*
   * This method is used to show information 
   * about the intersected object
   */
  onControllerGrispDown(evt){

    const controller = evt.target;

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

      if(!this.get('toolTips')[id]){
        this.get('toolTips')[id] = "true";
      }
      if(this.get('toolTips')[id] === "true"){

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;

        var content;

        if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "node" || emberModelName === "application"){
          content = this.get('hoverHandler').buildContent(emberModel);
        }
        else if(emberModelName === "package" || emberModelName === "clazz" || emberModelName === "component"){ 
          content = this.get('hoverHandlerApp3D').buildContent(emberModel);

        }
        // TODO: REMOVE plane


   
        console.log("content",this.get('font'));

        
        // place text box next to controller

        // Add object to controller
      
        controller.add(this.get('textBox').clone());
        console.log("plane added!", controller.children);
        // store object 
        controller.userData.selected = this.get('textBox').clone();
        this.get('toolTips')[id] = "false";
      }

    }

    else{

      if(controller.userData.selected !== undefined){
        var textBox = controller.userData.selected;
        // get stored application3D from controller
               controller.remove(textBox);
        console.log("delete", controller.children);
 
        
        // delete stored application3D 
        controller.userData.selected = undefined;
    }
    this.get('toolTips')[controller.id] = null;
    }

  },
  /*
   * This method is used to release the app3D from controller 
   * and put it back into the scene
   */
  onThumbpadControllerUp(evt){

    const controller = evt.target;

    //this.set('intersectionObjectID', null);
    if(controller.userData.selected !== undefined){
      // set bool for application3D not binded
      this.set('app3DBinded',false);
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
  onControllerTriggerDown(evt){

    const controller = evt.target;

    if(!this.get('app3DBinded')){

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
       
      // hide tooltip
      this.get('hoverHandler').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
        
        if(emberModelName === "application"){

          if(emberModel.get('components').get('length') === 0) {
            // no data => show message

            const message = "Sorry, no details for <b>" + emberModel.get('name') + 
              "</b> are available.";

            this.showAlertifyMessage(message);

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
        else if(emberModelName === "component" ||emberModelName === "clazz"  ){
          emberModel.setOpenedStatus(!emberModel.get('opened'));
          this.trigger('redrawApp');
        }
      }
    }
  },

  

  /* 
    This method is used to move and rotate application3D
  */
  onThumbpadControllerDown(evt){

    const controller = evt.target;
    
    var tempMatrix = new THREE.Matrix4();

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    if(intersectedViewObj) {

      console.log("intersectedViewObj", intersectedViewObj.object);

      // hide tooltip
      this.get('hoverHandler').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      if(emberModelName === "component" || emberModelName === "clazz" ){
        // set bool for application3D binded
        this.set('app3DBinded',true);

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
      // intersection with floor
      else if(emberModelName === "floor"){
        console.log("intersection point floor:", intersectedViewObj.point);
      }
    }
  },

  onMouseWheelStart(evt) {

    // Hide (old) tooltip
    this.get('hoverHandlerLandscape').hideTooltip();
    this.get('hoverHandlerApp3D').hideTooltip();

    var delta = Math.max(-1, Math.min(1, (evt.wheelDelta || -evt.detail)));

    // zoom in
    if (delta > 0) {
      this.get('cameraDolly').position.z -= delta * 1.5;
    }
    // zoom out
    else {
      this.get('cameraDolly').position.z -= delta * 1.5;
    }
  },


  onMouseOut() {
    this.set('hoverHandler.enableTooltips', false);
    this.get('hoverHandler').hideTooltip();
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
            self.get('hoverHandler').hideTooltip();
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
    this.get('controller1').removeEventListener('thumbpaddown',this.onThumbpadControllerDown);
    this.get('controller2').removeEventListener('thumbpaddown',this.onThumbpadControllerDown);
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

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;
      
      if(emberModelName === "application"){

        if(emberModel.get('components').get('length') === 0) {
          // no data => show message

          const message = "Sorry, no details for <b>" + emberModel.get('name') + 
            "</b> are available.";

          this.showAlertifyMessage(message);

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

      //this.get('hoverHandler').showTooltip(mouse, emberModel);

      // hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      let color = new THREE.Color("rgb(255, 0, 0)");
        
      if (emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application"){
                  
          if(intersectedViewObj.object.type === "system" || intersectedViewObj.object.type === "nodegroup" || intersectedViewObj.object.type === "application" || intersectedViewObj.object.parent.label === intersectedViewObj.object){

              // Check if label of box is hit and highlight box anyway
              if(intersectedViewObj.object.parent.label === intersectedViewObj.object){
                intersectedViewObj.object.parent.material.color = color;
              }
              else{
                intersectedViewObj.object.material.color = color;
              }

              // save highlighted object and bind it on controller id to quarantee that only this controller can unhighlight it
              this.get('highlightedEntities')[id] = intersectedViewObj.object;
         }
      }
      else if(emberModelName === "component" || emberModelName === "clazz"){
    
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


  // TODO: raycasting for controller
  handlePanning(delta, event) {


    /*console.log(event);
    const origin = {};

    origin.x = ((event.center.x - (this.get('renderer').domElement.offsetLeft+0.66)) / 
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((event.center.y - (this.get('renderer').domElement.offsetTop+0.665)) / 
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    const intersectedViewObj = this.get('raycaster').raycasting(null, origin, 
      this.get('camera'), this.get('raycastObjects'));

    if(intersectedViewObj) {*/


    if(event.button === 1){
      // translate camera
      const entity = this.get('scene');
      //console.log(this.get('scene'));

      var distanceXInPercent = (delta.x /
        parseFloat(this.get('renderer').domElement.clientWidth)) * 100.0;

      var distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 100.0;


      //var xVal = this.get('camera').position.x + distanceXInPercent * 6.0 * 0.015 * -(Math.abs(this.get('camera').position.z) / 4.0);

      //var yVal = this.get('camera').position.y + distanceYInPercent * 4.0 * 0.01 * (Math.abs(this.get('camera').position.z) / 4.0);

      for (let i = entity.children.length - 1; i >= 0 ; i--) {
        let child = entity.children[i];
    
        if(child.name === 'landscape' || child.name === 'app3D'){

          child.position.x = child.position.x + distanceXInPercent;
          child.position.y = child.position.y - distanceYInPercent;

        }
        if(child.name === 'app3D'){
          this.trigger("checkIntersection");
        }

     }

     
    }
  //}
  },

    /*handleHoverController(evt) {

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
      
      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "node" || emberModelName === "application"){
        this.get('hoverHandler').showTooltip(mouse, emberModel);
      }
      else if(emberModelName === "package" || emberModelName === "clazz" || emberModelName === "component"){ 
        this.get('hoverHandlerApp3D').showTooltip(mouse, emberModel);
      }

    }

  },*/


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
      
      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "node" || emberModelName === "application"){
        this.get('hoverHandlerLandscape').showTooltip(mouse, emberModel);
      }
      else if(emberModelName === "package" || emberModelName === "clazz" || emberModelName === "component"){ 
        this.get('hoverHandlerApp3D').showTooltip(mouse, emberModel);
      }

    }

  }





});