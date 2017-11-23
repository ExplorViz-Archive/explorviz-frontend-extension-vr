import Ember from 'ember';
import HammerInteraction from 'explorviz-ui-frontend/utils/hammer-interaction';
import HoverHandler from './hover-handler';
import HoverHandlerApp3D from 'explorviz-ui-frontend/utils/application-rendering/hover-handler';
import HoverHandlerLandscape from 'explorviz-ui-frontend/utils/landscape-rendering/hover-handler';
import AlertifyHandler from 'explorviz-ui-frontend/mixins/alertify-handler';

/*
 *  This util is used to realize the interaction by handeling
 *  mouse and controller events.
 *
 */
export default Ember.Object.extend(Ember.Evented, AlertifyHandler, {

  scene: null,
  canvas: null,
  canvas2: null,
  camera: null,
  room: null,
  initRoom: true,

  renderer: null,
  raycaster: null,
  raycastObjectsLandscape: null,
  controller1: null,
  controller2: null,

  labeler: null,
  
  vrEnvironment:null,

  colorList: null,
  colorListApp: null,

  application3D: null,
  app3DBinded: false,
  app3DBindedByController: {},
  deleteButtonHighlighted: null,

  materialHighlighted: null,
  materialUnhighlighted: null,

  previousToolTipObjects: {},
  textBox: null,

  highlightedEntities: {},
  highlightedEntitiesApp: {},

  hammerHandler: null,
  hoverHandler: null,
  hoverHandlerLandscape: null,
  hoverHandlerApp3D: null,
  userHeight: null,

  /*
   * This method is called after an application3D  
   * in component vr-rendering is created
   */
  setupInteractionApp3D(application3D) {
    this.set('application3D', application3D);
  },

  // Import information from component vr-rendering to manipulate objects global
  setupInteraction(scene, canvas, camera, renderer, raycaster, raycastObjectsLandscape, controller1, 
    controller2, vrEnvironment, colorList, colorListApp, textBox, userHeight, labeler, floor) {

    this.set('scene', scene);
    this.set('canvas', canvas);
    this.set('camera', camera);
    this.set('renderer', renderer);
    this.set('raycaster', raycaster);
    this.set('raycastObjectsLandscape', raycastObjectsLandscape);
    this.set('controller1', controller1);
    this.set('controller2', controller2);
    this.set('vrEnvironment', vrEnvironment);    
    this.set('colorList', colorList);  
    this.set('colorListApp', colorListApp);   
    this.set('textBox', textBox);
    this.set('userHeight', userHeight);
    this.set('labeler', labeler);
    this.set('floor', floor);

    const self = this;

    // Define dimension of canvas for infotext
    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = 256;
    this.get('canvas2').height = 128;

    // Setup event listener in each controller for each button
    self.get('controller1').addEventListener('triggerdown', registerControllerTriggerDown);
    self.get('controller2').addEventListener('triggerdown', registerControllerTriggerDown);
    self.get('controller1').addEventListener('thumbpaddown', registerControllerThumbpadDown);
    self.get('controller2').addEventListener('thumbpaddown', registerControllerThumbpadDown);
    self.get('controller1').addEventListener('thumbpadup', registerControllerThumbpadUp);
    self.get('controller2').addEventListener('thumbpadup', registerControllerThumbpadUp);
    self.get('controller1').addEventListener('gripsdown', registerControllerGripsDownController1);
    self.get('controller2').addEventListener('gripsdown', registerControllerGripsDownController2);

    /* The following functions handle the events by
     * calling the corresponding method
     */
    function registerControllerTriggerDown(event){
      self.onControllerTriggerDown(event);
    } 

    function registerControllerThumbpadDown(event){
      self.onControllerThumbpadDown(event);
    }
     
    function registerControllerThumbpadUp(event){
      self.onThumbpadControllerUp(event);
    }
  
    // Function for handling gripsdown for left and right hand
    function registerControllerGripsDownController1(evt){
      self.onControllerGripsDown(evt, false);
    }
    function registerControllerGripsDownController2(evt){
      self.onControllerGripsDown(evt, true);
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

    // Load textures for delete button
    let textureHighlighted = new THREE.TextureLoader().load('images/x_white.png');
    let materialHighlighted = new THREE.MeshPhongMaterial({
      map: textureHighlighted
    });
    this.set('materialHighlighted', materialHighlighted);

    let textureUnhighlighted = new THREE.TextureLoader().load('images/x_white_transp.png');
    let materialUnhighlighted = new THREE.MeshPhongMaterial({
      map: textureUnhighlighted
    });
    this.set('materialUnhighlighted', materialUnhighlighted);

    // Add key listener for room positioning
    window.onkeydown = function(event){
      // Get room
      if(self.get('initRoom')){
        self.set('room', self.get('scene').getObjectByName("room"));
        self.set('initRoom', false);
      }
      // Handle keys
      if(event.key === 'ArrowDown'){
        self.get('vrEnvironment').position.y -=  0.05;
        self.get('room').position.y -= 0.05;
        self.get('vrEnvironment').updateMatrix();

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').position.y -=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === 'ArrowUp'){
        self.get('vrEnvironment').position.y += 0.05;
        self.get('room').position.y += 0.05;
        self.get('vrEnvironment').updateMatrix();

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').position.y +=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === 'ArrowLeft'){
        self.get('vrEnvironment').position.x -=  0.05;
        self.get('room').position.x -= 0.05;
        self.get('vrEnvironment').updateMatrix();

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').position.x -=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === 'ArrowRight'){
        self.get('vrEnvironment').position.x +=  0.05;
        self.get('room').position.x += 0.05;
        self.get('vrEnvironment').updateMatrix();

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').position.x +=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === '-'){
        self.get('vrEnvironment').position.z -=  0.05;
        self.get('room').position.z -= 0.05;
        self.get('vrEnvironment').updateMatrix();

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').position.z -=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === '+'){
        self.get('vrEnvironment').position.z +=  0.05;
        self.get('room').position.z += 0.05;
        self.get('vrEnvironment').updateMatrix();

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').position.z +=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === 'q'){
        self.get('vrEnvironment').rotation.x +=  0.05;
        self.get('vrEnvironment').updateMatrix();
        self.trigger('centerVREnvironment');

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').rotation.x +=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
      else if(event.key === 'w'){
        self.get('vrEnvironment').rotation.x -=  0.05;
        self.get('vrEnvironment').updateMatrix();
        self.trigger('centerVREnvironment');

        if(!self.get('app3DBinded') && self.get('application3D')) {
          self.get('application3D').rotation.x -=  0.05;
          self.get('application3D').updateMatrix();
        }
      }
    };

    // Zoom handler    
    canvas.addEventListener('mousewheel', registerMouseWheel, false);

    function registerMouseWheel(evt) {
      self.onMouseWheelStart(evt);
    }

    // Init Hammer
    if (!this.get('hammerHandler')) {
      this.set('hammerHandler', HammerInteraction.create());
      this.get('hammerHandler').setupHammer(canvas);
    }

    // Init HoverHandler for Controller
    if (!this.get('hoverHandler')) {
      this.set('hoverHandler', HoverHandler.create());
    }

    // Init HoverHandler for mouse (Landscape)
    if (!this.get('hoverHandlerLandscape')) {
      this.set('hoverHandlerLandscape', HoverHandlerLandscape.create());
    }   
    // Init HoverHandler for mouse (app3D)
    if (!this.get('hoverHandlerApp3D')) {
      this.set('hoverHandlerApp3D', HoverHandlerApp3D.create());
    }

    // Hover handler
    self.registerHoverHandler();

    this.setupHammerListener();
    
  },

  /*
   * This method is used to highlight and unhighlight systems, nodegroups, packages
   * and clazzes if the controller ray hits them.
   * Furthermore this method scales the ray relative to distance of intersection
   */
    checkIntersection(controller){

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    // Check if hit entity is already highlighted
    if(intersectedViewObj && this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].id === intersectedViewObj.object.id){
      return;
    }

    /* Look for highlighted entity 'landscape' and unhighlight 
     * it if the same controller id highlighted it
     */
    if(this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].type && this.get('colorList')[this.get('highlightedEntities')[id].type]){  

      let entity = this.get('highlightedEntities')[id];
      let index = "text"+entity.type;

      // Identify enity
      if(entity.type === "nodegroup"){
        index = "textnode"; 
      }
      else if(entity.type === "application"){
        index = "textapp";
      }
      let name = entity.userData.model.get('name');

      // Reset the color of the mapped material
      this.get('labeler').redrawLabel(entity, 
        this.get('colorList')[index],name,this.get('colorList')[entity.type]);
    }

    /* Look for highlighted entity 'app3D' and unhighlight the 
     * package it if the same controller id highlighted it
     */
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.model.get('color') && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]){  

      this.get('highlightedEntitiesApp')[id].material.color =  
        new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]);
    }
    // Look for highlighted entity 'app3D' and unhighlight the clazz it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.type && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]){  
      this.get('highlightedEntitiesApp')[id].material.color =  
        new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]);
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

        // Scale ray distance to distance of intersection
        controller.getObjectByName('controllerLine').scale.z = intersectedViewObj.distance;

        // Handle delete button
        if (intersectedViewObj.object.name === 'deleteButton'){
          // Highlight if not highlighted
          if(!this.get('deleteButtonHighlighted')){
            intersectedViewObj.object.material = this.get('materialHighlighted');
            this.set('deleteButtonHighlighted', id);
          }
          return;
        }
    
        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;

        // Handle hit system, nodegroup or application and change color to red
        if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application"){
                    
            if(intersectedViewObj.object.type === "system" || intersectedViewObj.object.type === "nodegroup" || intersectedViewObj.object.type === "application"){

              // Highlight if not aready highlighted by the second controller
              if(!this.get('highlightedEntities')[id2] || (this.get('highlightedEntities')[id2].id && this.get('highlightedEntities')[id2].id !== intersectedViewObj.object.id)){ 

                let index = "text"+intersectedViewObj.object.type;

                let name;
                // Identify entity
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
                
                // Change entity color to red
                this.get('labeler').redrawLabel(intersectedViewObj.object, 
                  this.get('colorList')[index],name,"rgb(255, 0, 0)");

                /* Save highlighted object and bind it on controller id 
                   to quarantee that only this controller can unhighlight it */
                this.get('highlightedEntities')[id] = intersectedViewObj.object;
              }
            }
        }
        // Handle hit component/clazz of app3D if its not binded to a Controller
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

            /* Save highlighted object and bind it on controller id to quarantee 
             * that only this controller can unhighlight it */
            this.get('highlightedEntitiesApp')[id] = intersectedViewObj.object; 
          }
        }
        // Reset highlighted enities if node was hit 
        else{
          this.get('highlightedEntities')[id] = null;
          // Delete highlighted object entry for app3D
          this.get('highlightedEntitiesApp')[id] = null;
        }
        // Unhighlight delete button if app3D or landscape is highlighted
        if(this.get('application3D') && (this.get('highlightedEntitiesApp')[id] || this.get('highlightedEntities')[id])){
          this.get('application3D').getObjectByName('deleteButton').material = this.get('materialUnhighlighted');
          this.set('deleteButtonHighlighted', null);
        }
      }
      // Reset highlighted enities if nothing was hit 
      else{
        // Delete highlighted object entry for system and nodegroups
        this.get('highlightedEntities')[id] = null;
        // Delete highlighted object entry for app3D
        this.get('highlightedEntitiesApp')[id] = null;

        // Unhighlight delete button if highlighted
        if(this.get('application3D') && this.get('deleteButtonHighlighted') && this.get('deleteButtonHighlighted') === id){
          this.get('application3D').getObjectByName('deleteButton').material = this.get('materialUnhighlighted');
          this.set('deleteButtonHighlighted', null);
        }
        // Resize ray 
        controller.getObjectByName('controllerLine').scale.z = 5;
      }
  },
  //////// END checkIntersection


  /*
   * This method handles the controller event 'gripsdown'
   * and is used to show information about the intersected object. 
   * The additional parameter assigns a users hand to the controller
   * and adapts the position of the text box. 
   * @method - onControllerGripsDown
   */
  onControllerGripsDown(event, rightHand){

    const controller = event.target;

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    // Check if an object is hit
    if(intersectedViewObj){

      // Handle delete button exception
      if (intersectedViewObj.object.name === 'deleteButton'){
        return;
      }

      // Verify controllers
      let id2;
      if(id === this.get('controller1').id){
        id2 = this.get('controller2').id;
      }
      else{
        id2 = this.get('controller1').id;
      }

      // Remove text box if hit object is not the previous one
      if(this.get('previousToolTipObjects')[id] && this.get('previousToolTipObjects')[id].id !== intersectedViewObj.object.id){

        controller.remove(controller.getObjectByName('textBox'));  
        this.get('previousToolTipObjects')[id] = null;
      }

      // Create tool tip for intersected object
      if(!this.get('previousToolTipObjects')[id]){

        const emberModel = intersectedViewObj.object.userData.model;

        // Get information to display for hit object
        var content = this.get('hoverHandler').buildContent(emberModel);
        
        // Clone text box
        let textBox = this.get('textBox').clone();

        let canvas2 = this.get('canvas2');

        // Fill context of canvas with color and text
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
   * This method handles the controller event 'thumbpadup'
   * and is used to release the app3D from controller 
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

  
  /*
   * This method handles the controller event 'triggerdown'
   * and is used to open/close systems, nodegroups and 
   * components of 3D application. 
   * Furthermore a app3D is created or deleted if a "2D" 
   * application (blue plane) is hit
  */
  onControllerTriggerDown(event){

    const controller = event.target;

    /* Refuse trigger functionality if the controller which triggered
     * the event already binds the app3D 
     */
    if(!this.get('app3DBindedByController')[controller.id]){
      // Calculate controller direction and origin
      var tempMatrix = new THREE.Matrix4();

      tempMatrix.identity().extractRotation( controller.matrixWorld );
      
      const origin = new THREE.Vector3();
      origin.setFromMatrixPosition(controller.matrixWorld);

      const direction = new THREE.Vector3(0,0,-1);
      direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

      // Calculate hit object
      const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
        null, this.get('raycastObjectsLandscape'));

      // Check if an object is hit
      if(intersectedViewObj) {

        // Delete application
        if (intersectedViewObj.object.name === 'deleteButton'){
          this.trigger('removeApplication');
          return;
        }

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
        
        // Handle application hit
        if(emberModelName === "application"){

          // Handle no data for app3D available
          if(emberModel.get('components').get('length') === 0) {
            // no data => show message

            // No application3D => message
            if(!this.get('application3D')){
              //const message = "Sorry, no details for <b>" + emberModel.get('name') + 
              //  "</b> are available.";

              //this.showAlertifyMessage(message);
            }
          } 
          // Handle data for app3D available
          else {
            // Show app3D if not binded to controller
            this.closeAlertifyMessages();
            if(!this.get('app3DBinded')){
              // trigger event in component vr-rendering
              this.trigger('showApplication', emberModel, intersectedViewObj.point);
            }  
          }
        } 
        
        // Handle nodegroup or system hit
        else if (emberModelName === "nodegroup" || emberModelName === "system"){
          emberModel.setOpened(!emberModel.get('opened'));
          // trigger event in component vr-rendering
          this.trigger('redrawScene'); 
        }
        // Handle component of app3D hit
        else if((emberModelName === "component") && !this.get('app3DBinded')){
          emberModel.setOpenedStatus(!emberModel.get('opened'));
          // trigger event in component vr-rendering
          this.trigger('redrawApp');
        }
      }
    }
  },

  /* 
   * This method handles the controller event 'thumbpaddown'
   * and is used to move, zoom and rotate application3D
   */
  onControllerThumbpadDown(event){

    const controller = event.target;

     // Calculate controller direction and origin
    var tempMatrix = new THREE.Matrix4();

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, this.get('raycastObjectsLandscape'));

    // Check if an object is hit
    if(intersectedViewObj) {

      // Handle delete button exception
      if (intersectedViewObj.object.name === 'deleteButton'){
        return;
      }
    
      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      // Component or clazz hit and app3D not aready binded
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

    const delta = Math.max(-1, Math.min(1, (evt.wheelDelta || -evt.detail)));

    const mX = (evt.clientX / window.innerWidth ) * 2 - 1;
    const mY = - (evt.clientY / window.innerHeight ) * 2 + 1;

    const vector = new THREE.Vector3(mX, mY, 1 );
    vector.unproject(this.get('camera'));
    vector.sub(this.get('camera').position);
    
    this.get('camera').position.addVectors(this.get('camera').position,
      vector.setLength(delta * 1.5));


    // zoom in
    /*if (delta > 0) {
      this.get('camera').position.z -= delta * 1.5;
    }
    // zoom out
    else {
      this.get('camera').position.z -= delta * 1.5;
    }*/
  },


  onMouseOut() {
    this.set('hoverHandler.enableTooltips', false);
  },

  onMouseEnter() {
    this.set('hoverHandler.enableTooltips', true);
  },

  /*
   * This method is used to listen for mouse events
   * and handel them by calling the corresponding method 
   */
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

  /*
   * This method is used to setup th hover handler
   */
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

  /*
   * This method is used to remove the events from the canvas and the controllers
   */
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
  },

  /*
   * This method handles the doubleclick event triggered
   * by the mouse.
   * The functionality is almost identital to "onControllerTriggerDown(event)": 
   * Only one mouse => no separation (controller ids) 
   */
  handleDoubleClick(mouse) {

    const origin = {};

    // Get mouse origin (2D)
    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft+0.66)) / 
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop+0.665)) / 
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(null, origin, 
      this.get('camera'), this.get('raycastObjectsLandscape'));

    // Check if an object is hit
    if(intersectedViewObj) {

      // Delete application
      if (intersectedViewObj.object.name === 'deleteButton'){
        this.trigger('removeApplication');
        return;
      }

      // hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;
      
      // Handle application hit
      if(emberModelName === "application"){

        // Handle no data for app3D available
        if(emberModel.get('components').get('length') === 0) {
          // no data => show message

          // No application3D => message

          const message = "Sorry, no details for <b>" + emberModel.get('name') + 
            "</b> are available.";

          this.showAlertifyMessage(message); 
        } 
        // Handle data for app3D available
        else {
          // data available => open application-rendering
          this.closeAlertifyMessages();
          // trigger event in component vr-rendering
          this.trigger('showApplication', emberModel, intersectedViewObj.point);
        }  
      } 
      // Handle nodegroup or system hit
      else if (emberModelName === "nodegroup" || emberModelName === "system"){
        emberModel.setOpened(!emberModel.get('opened'));
        // trigger event in component vr-rendering
        this.trigger('redrawScene');
      }
      // Handle component of app3D hit
      else if(emberModelName === "component"){
        emberModel.setOpenedStatus(!emberModel.get('opened'));
        // trigger event in component vr-rendering
        this.trigger('redrawApp', emberModel);
      }
    }
  },

  /*
   * This method handles the singleclick event triggered
   * by the mouse.
   * The functionality is almost identital to "checkIntersection(controller)":
   * Only one mouse => no separation (controller ids) 
   */
  handleSingleClick(mouse) {

    const origin = {};

    // Get mouse origin (2D)
    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft+0.66)) / 
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop+0.665)) / 
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(null, origin, 
      this.get('camera'), this.get('raycastObjectsLandscape'));

    let id = 123;

    // Look for highlighted entity 'landscape' and unhighlight it if the same controller id highlighted it
    if(this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].type && this.get('colorList')[this.get('highlightedEntities')[id].type]){  
      this.get('highlightedEntities')[id].material.color =  
        new THREE.Color(this.get('colorList')[this.get('highlightedEntities')[id].type]);
      
      let entity = this.get('highlightedEntities')[id];
      let index = "text"+entity.type;

      // Identify enity
      if(entity.type === "nodegroup"){
        index = "textnode";  
      }
      else if(entity.type === "application"){
        index = "textapp";
      }
      let name = entity.userData.model.get('name');

      // Reset the color of the mapped material
      this.get('labeler').redrawLabel(entity, 
        this.get('colorList')[index],name,this.get('colorList')[entity.type]);
    }

    // Look for highlighted entity 'app3D' and unhighlight the package it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.model.get('color') && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]){  
      this.get('highlightedEntitiesApp')[id].material.color =  
        new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.model.get('color')]);
    }
    // Look for highlighted entity 'app3D' and unhighlight the clazz it if the same controller id highlighted it
    if(this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.type && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]){  
      this.get('highlightedEntitiesApp')[id].material.color =  
        new THREE.Color(this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type]);
    }
    // Case for intersection object present
    if(intersectedViewObj) {

      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton'){
        // Highlight if not highlighted
        if(!this.get('deleteButtonHighlighted')){
          intersectedViewObj.object.material = this.get('materialHighlighted');
          this.set('deleteButtonHighlighted', id);
        }
        return;
      }

      // hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;
        
      // Handle hit system, nodegroup or application and change color to red  
      if(emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application"){
               
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
              // Change entity color to red
              this.get('labeler').redrawLabel(intersectedViewObj.object, 
                this.get('colorList')[index],name,"rgb(255, 0, 0)");

              // save highlighted object
              this.get('highlightedEntities')[id] = intersectedViewObj.object;
         }
      }
      // Handle hit component/clazz of app3D 
      else if(emberModelName === "component" || emberModelName === "clazz"){
        let color = new THREE.Color("rgb(255, 0, 0)");

        // Check if label of box is hit and highlight box anyway
        if(intersectedViewObj.object.parent.label === intersectedViewObj.object){
          intersectedViewObj.object.parent.material.color = color;
        }
        else{
          intersectedViewObj.object.material.color = color;
        }

        // save highlighted object
        this.get('highlightedEntitiesApp')[id] = intersectedViewObj.object; 
      }
      // Unhighlight delete button if app3D or landscape is highlighted
      if(this.get('application3D') && (this.get('highlightedEntitiesApp')[id] || this.get('highlightedEntities')[id])){
        this.get('application3D').getObjectByName('deleteButton').material = this.get('materialUnhighlighted');
        this.set('deleteButtonHighlighted', null);
      }
    }
    // Reset highlighted enities if nothing was hit 
    else{
      // Delete highlighted object entry for system and nodegroups
      this.get('highlightedEntities')[id] = null;
      // Delete highlighted object entry for app3D
      this.get('highlightedEntitiesApp')[id] = null;

      // Unhighlight delete button if highlighted
      if(this.get('application3D') && this.get('deleteButtonHighlighted')){
        this.get('application3D').getObjectByName('deleteButton').material = this.get('materialUnhighlighted');
        this.set('deleteButtonHighlighted', null);
      }
    }
  },

  /*
   * This method is used to handle the panning event
   * triggered by the mouse
   */
  handlePanning(delta, event) {

    if(event.button === 1){
      // translate camera
      var distanceXInPercent = (delta.x /
        parseFloat(this.get('renderer').domElement.clientWidth)) * 100.0;

      var distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 100.0;

      this.get('vrEnvironment').position.x = this.get('vrEnvironment').position.x + distanceXInPercent;
      this.get('vrEnvironment').position.y = this.get('vrEnvironment').position.y - distanceYInPercent;
      this.get('vrEnvironment').updateMatrix();
    }
  },

  /*
   * This method is used to handle the hover event
   * triggered by the mouse
   */
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
      // exclude requests and delete button
      if (intersectedViewObj.object.name === 'earth' || intersectedViewObj.object.name === 'deleteButton'){
        return;
      }
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
