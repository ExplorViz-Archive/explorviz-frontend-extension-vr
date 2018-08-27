import Ember from 'ember';
import HammerInteraction from 'explorviz-frontend/utils/hammer-interaction';
import HoverHandler from './hover-handler';
import HoverHandlerApp3D from 'explorviz-frontend/utils/application-rendering/popup-handler';
import HoverHandlerLandscape from 'explorviz-frontend/utils/landscape-rendering/popup-handler';
import AlertifyHandler from 'explorviz-frontend/mixins/alertify-handler';
import Selector from './selector';
import THREE from "three";
import Menus from '../multi-user/menus';

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
  cameraGroup: null,
  user: null,
  room: null,

  renderer: null,
  raycaster: null,
  raycastObjectsLandscape: null,
  controller1: null,
  controller2: null,

  labeler: null,
  vrEnvironment:null,

  colorList: null,
  colorListApp: null,

  // emberModel of the selected entity
  appCommunicationHighlighted: false,
  highlightedAppModel: null,
  // mesh of the selected entity
  selectedEntitysMesh: null,
  selectedEntitysColor: null,

  openApps: null,
  application3D: null,
  app3DBinded: false,
  app3DBindedByController: {},
  deleteButtonHighlighted: null,

  materialHighlighted: null,
  materialUnhighlighted: null,
  // Texture for red "X"
  textureHighlighted: null,

  previousToolTipObjects: {},
  textBox: null,

  highlightedEntities: {},
  highlightedEntitiesApp: {},

  hammerHandler: null,
  hoverHandler: null,
  hoverHandlerLandscape: null,
  hoverHandlerApp3D: null,
  selector: null,

  boundApps : null,
  environmentOffset : null,

  highlightingColor: "rgb(255,0,0)",

  emptyFunction: () => {},


  /*
   * This method is called in "vr-rendering" after 
   * an application3D has been created 
   */
  setupInteractionApp3D(openApps) {
    this.set('openApps', openApps);
  },

  /*
   *  This method is used to pass the selected mesh from component 'vr-rendering'
   *  to 'interaction'
   */
  saveSelectedMesh(mesh){
    this.set('selectedEntitysMesh', mesh);
  },

  // Import information from component vr-rendering to manipulate objects global
  setupInteraction(scene, canvas, camera, renderer, raycaster, raycastObjectsLandscape, controller1, 
    controller2, vrEnvironment, colorList, colorListApp, textBox, labeler, room, user, boundApps, environmentOffset, cameraGroup) {

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
    this.set('labeler', labeler);
    this.set('room', room);
    this.set('user', user);
    this.set('boundApps', boundApps);
    this.set('environmentOffset', environmentOffset);
    this.set('cameraGroup', cameraGroup);

    const self = this;

    // Define dimension of canvas for infotext
    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = 256;
    this.get('canvas2').height = 128;

    // Setup event listener in each controller for each button
    this.get('controller1').addEventListener('triggerdown', registerTriggerDownController1);
    this.get('controller2').addEventListener('triggerdown', registerTriggerDownController2);
    // this.get('controller1').addEventListener('triggerup', this.emptyFunction);
    // this.get('controller2').addEventListener('triggerup', this.emptyFunction);
    // this.get('controller1').addEventListener('thumbpaddown', registerThumbpadDownController1);
    this.get('controller2').addEventListener('thumbpaddown', registerThumbpadDownController2);
    // this.get('controller1').addEventListener('thumbpadup', this.emptyFunction);
    // this.get('controller2').addEventListener('thumbpadup', this.emptyFunction);
    this.get('controller1').addEventListener('gripdown', registerGripDownController1);
    this.get('controller2').addEventListener('gripdown', registerGripDownController2);
    this.get('controller1').addEventListener('gripup', registerGripUpController1);
    this.get('controller2').addEventListener('gripup', registerGripUpController2);
    this.get('controller1').addEventListener('menudown', registerMenuDownController1);
    // this.get('controller2').addEventListener('menudown', this.emptyFunction);
    // this.get('controller1').addEventListener('menuup', this.emptyFunction);
    // this.get('controller2').addEventListener('menuup', this.emptyFunction);
    // this.get('controller1').addEventListener('axischanged', this.emptyFunction);
    // this.get('controller2').addEventListener('axischanged', this.emptyFunction);

    /* The following functions handle the events by
     * calling the corresponding method
     */
    function registerTriggerDownController2(event){
      self.onTriggerDownController2(event);
    }
    function registerTriggerDownController1(event){
      self.onTriggerDownController1(event);
    }

    function registerGripDownController1(event){
      self.onGripDownController1(event);
    }
     
    function registerGripUpController1(event){
      self.onGripUpController1(event);
    }

    function registerGripDownController2(event){
      self.onGripDownController2(event);
    }
     
    function registerGripUpController2(event){
      self.onGripUpController2(event);
    }
  
    // Function for handling gripdown for left and right hand
    /* function registerThumbpadDownController1(evt) {
      self.onThumbpadDownController1(evt, false);
    } */

    function registerThumbpadDownController2(evt){
      self.onThumbpadDownController1(evt, true);
    } 

    function registerMenuDownController1(evt){
      self.onMenuDownController1(evt);
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

    // Load texture for delete button highlighted
    this.set('textureHighlighted', new THREE.TextureLoader().load('images/x_white.png'));

////////// Keyboard interaction ////////// 

    // Add key listener for room positioning
    window.onkeydown = event => {
      // Handle keys
      switch(event.key) {
        case 'ArrowDown':
          this.get('user').position.y -= 0.05;
          break;
        case 'ArrowUp':
          this.get('user').position.y += 0.05;
          break;
        case 'ArrowLeft':
          this.get('user').position.x -= 0.05;
          break;
        case 'ArrowRight':
          this.get('user').position.x += 0.05;
          break;
        case '-':
          this.get('user').position.z += 0.05;
          break;
        case '+':
          this.get('user').position.z -= 0.05;
          break;
        case 'q':
          this.get('vrEnvironment').rotation.x +=  0.05;
          this.updateObjectMatrix(this.get('vrEnvironment'));
          this.trigger('centerVREnvironment');
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, 0)); //no position change, only quaternion
          break;
        case 'w':
          this.get('vrEnvironment').rotation.x -=  0.05;
          this.updateObjectMatrix(this.get('vrEnvironment'));
          this.trigger('centerVREnvironment');
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, 0)); //no position change, only quaternion
          break;
        case 'v':
          //adjust camera position for vive
          this.get('cameraGroup').translateX(-0.8);
          this.get('cameraGroup').translateZ(1.94);
          this.get('cameraGroup').rotateY(3.14159);
          break;
      }
    };

    // Zoom handler    
    canvas.addEventListener('wheel', registerMouseWheel, false);

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

    // Init selector
    if (!this.get('selector')) {
      this.set('selector', Selector.create());
    }

    // Hover handler
    self.registerHoverHandler();

    this.setupHammerListener();
    
  },


////////// Controller interaction ////////// 

  /*
   * This method is used to highlight and unhighlight systems, nodegroups, packages
   * and clazzes if the controller ray hits them.
   * Furthermore this method scales the ray relative to distance of intersection
   */
  checkIntersectionRightController(objects) {
    let controller = this.get('controller2');
    let controllerLine = controller.getObjectByName('controllerLine');

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    if(!objects) {
      objects = this.get('raycastObjectsLandscape');
    }

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);

    // Verify controllers
    let id2 = this.verifyControllers(id);

    // Stop if hit entity is already highlighted
    if(this.isEntityHighlighted(intersectedViewObj, controller, id2)){
      return;
    }

    // Restore old color of landscape
    this.unhighlightLandscape(id);

    // Restore old color of application3D
    this.unhighlightApplication3D(id);

    // Return if selected entity is hit
    if(this.excludeSelectedEntity(controller, intersectedViewObj)){
      return;
    }

    // Case: intersection object present
    if(intersectedViewObj){

      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton'){
        this.highlightDeleteButton(intersectedViewObj, id);
        return;
      }

      // Handle floor
      if(intersectedViewObj.object.name === 'floor'){
        return;
      }

      // Handle menus
      let menu = Menus.get(intersectedViewObj.object.name);
      if(menu) {
        menu.interact('rightIntersect', intersectedViewObj.uv);
        return;
      }
  
      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      // Calculate darker color
      let darkerColor = this.calculateDarkerColor(intersectedViewObj.object);

      // Handle hit system, nodegroup or application and change color
      this.highlightLandscape(emberModel, emberModelName, intersectedViewObj, id, darkerColor);

      // Handle hit component/clazz of app3D if its not binded to a Controller
      if((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded') && emberModel !== this.get('appCommunicationHighlighted')){
        // New color 
        let color = new THREE.Color(darkerColor);
        intersectedViewObj.object.material.color = color;

        /* Save highlighted object and bind it on controller id to quarantee 
         * that only this controller can unhighlight it */
        this.get('highlightedEntitiesApp')[id] = intersectedViewObj.object; 
        
      }
      // Unhighlight delete button if app3D or landscape is 
      // highlighted AND delete button was highlighted by this controller
      let additionalCondition = (this.get('highlightedEntitiesApp')[id] || this.get('highlightedEntities')[id]);
      this.unhighlightedDeleteButton(id, additionalCondition);
    }
    // Reset highlighted enities if nothing was hit 
    else {
      // Unhighlight delete button 
      this.unhighlightedDeleteButton(id, true);

      // Resize ray 
      controllerLine.scale.z = 5;
    }
  },
  /*
   * This method is used to highlight and unhighlight closed packages
   * and clazzes if the controller ray hits them.
   * Furthermore this method scales the ray relative to distance of intersection
   */
  checkIntersectionLeftController(objects){
    let controller = this.get('controller1');
    let controllerLine = controller.getObjectByName('controllerLine');

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    if(!objects) {
      objects = this.excludeLandscape();
    }

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);

    // Verify controllers
    let id2 = this.verifyControllers(id);

    // Stop if entity is already highlighted by a controller
    if(this.isEntityHighlighted(intersectedViewObj, controller, id2)){
      return;
    }  

    // Restore old color of application3D
    this.unhighlightApplication3D(id);

    // Stop if selected entity is hit
    if(this.excludeSelectedEntity(controller, intersectedViewObj)){
      return;
    }

    // Case for intersection object present
    if(intersectedViewObj){

      // Handle floor (teleport)
      if(intersectedViewObj.object.name === 'floor'){
        this.trigger('showTeleportArea', intersectedViewObj.point);
        return;
      }
      else{
        // Remove area for teleporting
        this.trigger('removeTeleportArea');
      }

      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton'){
        this.highlightDeleteButton(intersectedViewObj, id);
        return;
      }

      const emberModel = intersectedViewObj.object.userData.model;

      if(!emberModel)
        return;

      const emberModelName = emberModel.constructor.modelName;

      // Calculate darker color
      let darkerColor = this.calculateDarkerColor(intersectedViewObj.object);

      // Show teleport area on opened systems
      if(emberModelName === "system" && intersectedViewObj.object.name === "systemOpened"){
        this.trigger('showTeleportArea', intersectedViewObj.point);
      }
      
      // Handle closed component/clazz of app3D
      else if(((emberModelName === "component" && !emberModel.get('opened'))|| emberModelName === "clazz") && !this.get('app3DBinded') && emberModel !== this.get('appCommunicationHighlighted')){

        // New color 
        let color = new THREE.Color(darkerColor);
        intersectedViewObj.object.material.color = color;

        /* Save highlighted object and bind it on controller id to quarantee 
         * that only this controller can unhighlight it */
        this.get('highlightedEntitiesApp')[id] = intersectedViewObj.object; 
        
      }
      // Unhighlight delete button if app3D is 
      // highlighted AND delete button was highlighted by this controller
      let additionalCondition = this.get('highlightedEntitiesApp')[id];
      this.unhighlightedDeleteButton(id, additionalCondition);
    }
    // Reset highlighted enities if nothing was hit 
    else{

      // Remove area for teleporting
      this.trigger('removeTeleportArea');

      // Unhighlight delete button
      this.unhighlightedDeleteButton(id, true);

      // Resize ray 
      controllerLine.scale.z = 5;
    }
  },
  //////// END checkIntersection


  /*
   * This method handles the controller event 'gripdown'
   * and is used to show information about the intersected object. 
   * The additional parameter assigns a users hand to the controller
   * and adapts the position of the text box. 
   * @method - onThumbpadDownController1
   */
  onThumbpadDownController1(event, rightHand, objects){

    const controller = event.target;
    let controllerLine = controller.getObjectByName('controllerLine');

    var tempMatrix = new THREE.Matrix4();

    // Id to verfify which controller triggered the event
    let id = controller.id;

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    if(!objects) {
      objects = this.get('raycastObjectsLandscape');
    }

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);

    // Check if an object is hit
    if(intersectedViewObj){

      // Handle delete button and floor exception
      if (intersectedViewObj.object.name === 'deleteButton' || intersectedViewObj.object.name === 'floor'){
        return;
      }

      // Handle menus
      let menu = Menus.get(intersectedViewObj.object.name);
      if(menu) {
        menu.interact('leftThumbpadDown', intersectedViewObj.uv);
        return;
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

        // New font size for entries
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
        // Map texture
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
  onGripUpController2(event){

    const controller = event.target;

    if(controller.userData.selected !== undefined && controller.userData.selected.name !== "textBox"){
      // Set bool for application3D not binded
      this.set('app3DBinded',false);
      this.get('app3DBindedByController')[controller.id] = null;

      // Get stored application3D from controller
      var object = controller.userData.selected;
      // Transform object back into transformation relative to local space
      object.matrix.premultiply(controller.matrixWorld);
      // Split up transforamtion into position, quaternion and scale
      object.matrix.decompose( object.position, object.quaternion, object.scale);

      // Add application3D to scene
      this.get('scene').add(object);
      // Delete stored application3D 
      controller.userData.selected = undefined;

      this.trigger('appReleased', object.userData.model.id, object.position, object.quaternion);
    }
  },

  
  /*
   * This method handles the right controller (event 'triggerdown')
   * and is used to open/close systems, nodegroups and 
   * components of 3D application. 
   */
  onTriggerDownController2(event, objects){

    const controller = event.target;
    let controllerLine = controller.getObjectByName('controllerLine');

    /* Refuse trigger functionality if the controller which triggered
     * the event already binds the app3D 
     */
    if(!this.get('app3DBindedByController')[controller.id]){
      // Calculate controller direction and origin
      var tempMatrix = new THREE.Matrix4();

      tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
      
      const origin = new THREE.Vector3();
      origin.setFromMatrixPosition(controllerLine.matrixWorld);

      const direction = new THREE.Vector3(0,0,-1);
      direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

      if(!objects) {
        objects = this.get('raycastObjectsLandscape');
      }

      // Calculate hit object
      const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
        null, objects);

      // Check if an object is hit
      if(intersectedViewObj) {

        // Handle delete button
        if (intersectedViewObj.object.name === 'deleteButton'){
          // Delete application
          this.deleteApplication3D(intersectedViewObj);
          return;
        }

        // Handle floor
        if(intersectedViewObj.object.name === 'floor'){
          return;
        }

        // Handle menus
        let menu = Menus.get(intersectedViewObj.object.name);
        if(menu) {
          menu.interact('rightTrigger', intersectedViewObj.uv);
          return;
        }

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
        
        // Handle application hit
        if(emberModelName === "application" && !this.get('app3DBinded') && emberModel.get('components').get('length') !==0){
          // Trigger event in component vr-rendering
          this.trigger('showApplication', emberModel, intersectedViewObj.point); 
        } 
        
        // Handle nodegroup or system hit
        else if (emberModelName === "nodegroup" || emberModelName === "system"){
          emberModel.setOpened(!emberModel.get('opened'));

          if (emberModelName === "system"){
            this.trigger('systemStateChanged',emberModel.id, emberModel.get('opened'));
          } else if (emberModelName === "nodegroup"){
            this.trigger('nodegroupStateChanged',emberModel.id, emberModel.get('opened'));
          }
          // Trigger event in component vr-rendering
          this.trigger('redrawScene'); 
        }
        // Handle component of app3D hit
        else if((emberModelName === "component") && !this.get('app3DBinded')){

          let appID = intersectedViewObj.object.userData.appID;

          //dont allow altering bound apps
          if (this.get('boundApps').has(appID)){
            return;
          }
  
          // Toggle state and redraw app
          emberModel.setOpenedStatus(!emberModel.get('opened'));
          this.trigger('redrawApp', appID);
  
          this.trigger('componentUpdate', appID , emberModel.id, emberModel.get('opened'));
  
          // Restore selection
          if(this.get('appCommunicationHighlighted') && this.get('selectedEntitysMesh') && emberModel !== this.get('appCommunicationHighlighted') && !this.get('appCommunicationHighlighted').get('opened'))
          
          {
            this.get('selector').highlightAppCommunication(this.get('appCommunicationHighlighted'), this.get('highlightedAppModel'));
            this.trigger('redrawAppCommunication');
  
            let color = new THREE.Color(this.get('highlightingColor'));
            this.get('selectedEntitysMesh').material.color = color;
          }
          // Open selected component
          else{
            if(this.get('appCommunicationHighlighted')){
              this.get('appCommunicationHighlighted').set('highlighted', false);
            }
            this.set('appCommunicationHighlighted', null);
            this.set('selectedEntitysMesh', null);
          }
        }
      }
    }
  },

  /*
   * This method handles the left controller (event 'triggerdown')
   * and is used 
   * select components/clazzes of application3D and teleport. 
   */
  onTriggerDownController1(event, objects){

    const controller = event.target;
    let controllerLine = controller.getObjectByName('controllerLine');

    /* Refuse trigger functionality if the controller which triggered
     * the event already binds the app3D 
     */
    if(!this.get('app3DBindedByController')[controller.id]){
      // Calculate controller direction and origin
      var tempMatrix = new THREE.Matrix4();

      tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
      
      const origin = new THREE.Vector3();
      origin.setFromMatrixPosition(controllerLine.matrixWorld);

      const direction = new THREE.Vector3(0,0,-1);
      direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

      if(!objects) {
        objects = this.excludeLandscape();
      }

      // Calculate hit object
      const intersectedViewObj = this.get('raycaster').raycasting(origin, direction,
        null, objects);

      // Check if an object is hit
      if(intersectedViewObj) {

        // Handle delete button
        if (intersectedViewObj.object.name === 'deleteButton'){
          // Delete application
          this.deleteApplication3D(intersectedViewObj);
          return;
        }

        // Handle floor (teleport)
        if(intersectedViewObj.object.name === 'floor'){
          this.teleportToPosition(intersectedViewObj.point);
          return;
        }

        const emberModel = intersectedViewObj.object.userData.model;
        const emberModelName = emberModel.constructor.modelName;
        
        // Handle component of app3D hit
        if((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded')){
          let appID = intersectedViewObj.object.parent.userData.model.id;

          // Just highlight entity and communication lines if component closed or clazz
          if(!emberModel.get('opened') || emberModelName === "clazz"){

            // Check if a component is already highlighted and restore color
            if(this.get('selectedEntitysMesh') && this.get('appCommunicationHighlighted') && this.get('selectedEntitysColor')){

              // If identical to intersected object unhighlight and return
              if(this.get('selectedEntitysMesh') === intersectedViewObj.object){
                this.restoreSelectedEntity(this.verifyControllers(controller.id));
                this.set('selectedEntitysMesh', null);
                this.trigger("entityHighlighted", false);
                this.set('selectedEntitysColor', null);
                return;
              }
              // Reset communication lines
              this.get('selector').highlightAppCommunication(null, this.get('highlightedAppModel'));
              // Restore old color
              this.restoreSelectedEntity(this.verifyControllers(controller.id));
     
              this.get('appCommunicationHighlighted').set('highlighted', false);
            }
            
            // Save selected entity and communication highlighting
            this.saveSelectedEntity(intersectedViewObj, emberModel);

            this.trigger("entityHighlighted", true, appID, emberModel.id, this.get('selectedEntitysColor'));

            // Set new color
            let color = new THREE.Color(this.get('highlightingColor'));
            intersectedViewObj.object.material.color = color;
            // Highlight communication lines
            this.get('appCommunicationHighlighted').set('highlighted', true);
            this.get('selector').highlightAppCommunication(emberModel, this.get('highlightedAppModel'));
            this.trigger('redrawAppCommunication');

            // Reset highlighting for selected component
            this.get('highlightedEntitiesApp')[controller.id] = null;
          }
        }
      }
      else{
        // Reset communication highlighting (nothing hit)
        if(this.get('appCommunicationHighlighted') && this.get('selectedEntitysMesh') && this.get('selectedEntitysColor')){
          this.get('selector').highlightAppCommunication(null, this.get('highlightedAppModel')); 
          // Restore selected entity and communication lines
          this.restoreSelectedEntity(this.verifyControllers(controller.id));
  
          this.set('appCommunicationHighlighted', null);
          this.set('selectedEntitysMesh', null);
          this.set('selectedEntitysColor', null);
          this.trigger('redrawAppCommunication');
          this.trigger("entityHighlighted", false);
        }
      }
    }
  },

  /* 
   * This method handles the controller event 'thumbpaddown'
   * and is used to move, zoom and rotate application3D
   */
  onGripDownController2(event, objects){
    const controller = event.target;
    let controllerLine = controller.getObjectByName('controllerLine');

     // Calculate controller direction and origin
    var tempMatrix = new THREE.Matrix4();

    tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    if(!objects) {
      objects = this.get('raycastObjectsLandscape');
    }

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);

    // Check if an object is hit
    if(intersectedViewObj) {

      // Handle delete button and floor exception
      if (intersectedViewObj.object.name === 'deleteButton' || intersectedViewObj.object.name === 'floor'){
        return;
      }

      // Handle menus
      let menu = Menus.get(intersectedViewObj.object.name);
      if(menu) {
        menu.interact('rightGripDown', intersectedViewObj.uv);
        return;
      }
    
      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      // Component or clazz hit and app3D not aready binded
      if((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded') ){
        let appID = intersectedViewObj.object.userData.appID;

        if (this.get('boundApps').has(appID)){
          return;
        }

        // set bool for application3D binded
        this.set('app3DBinded',true);
        this.get('app3DBindedByController')[controller.id] = "true";

        // Get inverse of controller transoformation      
        tempMatrix.getInverse(controller.matrixWorld);

        let object = intersectedViewObj.object.userData.object3D;
        

        // Set transforamtion relative to controller transformation
        object.matrix.premultiply( tempMatrix );
        // Split up matrix into position, quaternion and scale
        object.matrix.decompose( object.position, object.quaternion, object.scale);
        // Add object to controller
        controller.add(object);
        // Store object 
        controller.userData.selected = object;

        //send information about app binding to backend
        let boundToController1 = controller.id === this.get('controller1').id;
        //let appID = intersectedViewObj.object.parent.userData.model.id;
        this.trigger('appBinded', appID, object.position, object.quaternion, boundToController1, controller.position, controller.quaternion);
      }
    }
  },

  onGripDownController1(event) {},
  onGripUpController1(event) {},
  onMenuDownController1(event) {},

////////// Mouse interaction ////////// 

  onMouseWheelStart(evt) {
    const delta = Math.max(-1, Math.min(1, evt.deltaY));

    const mX = (evt.clientX / window.innerWidth ) * 2 - 1;
    const mY = - (evt.clientY / window.innerHeight ) * 2 + 1;

    const vector = new THREE.Vector3(mX, mY, 1 );
    vector.unproject(this.get('camera'));
    vector.sub(this.get('camera').position);
    
    this.get('camera').position.addVectors(this.get('camera').position,
      vector.setLength(delta * 0.1));

    this.get('camera').updateProjectionMatrix();

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

    this.get('hammerHandler').on('doubletap', function(mouse) {
      self.handleDoubleClick(mouse);
    });

    this.get('hammerHandler').on('panning', function(delta, event) {
      self.handlePanning(delta, event);
    });

    this.get('hammerHandler').on('panningEnd', function(mouse) {
      self.handleHover(mouse);
    });

    this.get('hammerHandler').on('singletap', function(mouse) {
      self.handleSingleClick(mouse);
    });   

  },

  /*
   * This method is used to setup th hover handler
   */
  registerHoverHandler() {

    const self = this;

    // Custom event for mousemovement end
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
    this.get('controller1').removeEventListener('triggerdown', this.onTriggerDownController1);
    this.get('controller2').removeEventListener('triggerdown', this.onTriggerDownController2);
    // this.get('controller1').removeEventListener('triggerup', this.emptyFunction);
    // this.get('controller2').removeEventListener('triggerup', this.emptyFunction);
    // this.get('controller1').removeEventListener('thumbpaddown', this.onThumbpadDownController1);
    this.get('controller2').removeEventListener('thumbpaddown', this.onThumbpadDownController1);
    // this.get('controller1').removeEventListener('thumbpadup', this.emptyFunction);
    // this.get('controller2').removeEventListener('thumbpadup', this.emptyFunction);
    // this.get('controller1').removeEventListener('gripdown', this.emptyFunction);
    this.get('controller2').removeEventListener('gripdown', this.onGripDownController2);
    this.get('controller1').removeEventListener('gripup', this.onGripUpController1);
    this.get('controller2').removeEventListener('gripup', this.onGripUpController2);
    this.get('controller1').removeEventListener('menudown', this.onMenuDownController1);
    // this.get('controller2').removeEventListener('menudown', this.emptyFunction);
    // this.get('controller1').removeEventListener('menuup', this.emptyFunction);
    // this.get('controller2').removeEventListener('menuup', this.emptyFunction);
    // this.get('controller1').removeEventListener('axischanged', this.emptyFunction);
    // this.get('controller2').removeEventListener('axischanged', this.emptyFunction);
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
      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton'){
        // Delete application
        this.deleteApplication3D(intersectedViewObj);
        return;
      }

      // Teleport to intersection point
      if(intersectedViewObj.object.name === 'floor'){
        this.teleportToPosition(intersectedViewObj.point);
        return;
      }

      // Hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;
      
      // Handle application hit
      if(emberModelName === "application"){

        // Handle no data for app3D available
        if(emberModel.get('components').get('length') === 0) {
          // No data => show message

          // No application3D => message

          const message = "Sorry, no details for <b>" + emberModel.get('name') + 
            "</b> are available.";

          this.showAlertifyMessage(message); 
        } 
        // Handle data for app3D available
        else {
          // Data available => open application-rendering
          this.closeAlertifyMessages();
          // trigger event in component vr-rendering
          this.trigger('showApplication', emberModel, intersectedViewObj.point);
        }  
      } 
      // Handle nodegroup or system hit
      else if (emberModelName === "nodegroup" || emberModelName === "system"){
        emberModel.setOpened(!emberModel.get('opened'));

        if (emberModelName === "system"){
          this.trigger('systemStateChanged',emberModel.id, emberModel.get('opened'));
        } else if (emberModelName === "nodegroup"){
          this.trigger('nodegroupStateChanged',emberModel.id, emberModel.get('opened'));
        }
        // Trigger event in component vr-rendering
        this.trigger('redrawScene');
      }
      // Handle component of app3D hit
      else if(emberModelName === "component"){
        let appID = intersectedViewObj.object.userData.appID;

        //dont allow altering bound apps
        if (this.get('boundApps').has(appID)){
          return;
        }

        // Toggle state and redraw app
        emberModel.setOpenedStatus(!emberModel.get('opened'));
        this.trigger('redrawApp', appID);

        this.trigger('componentUpdate', appID , emberModel.id, emberModel.get('opened'));

        // Restore selection
        if(this.get('appCommunicationHighlighted') && this.get('selectedEntitysMesh') && emberModel !== this.get('appCommunicationHighlighted') && !this.get('appCommunicationHighlighted').get('opened'))
        
        {
          this.get('selector').highlightAppCommunication(this.get('appCommunicationHighlighted'), this.get('highlightedAppModel'));
          this.trigger('redrawAppCommunication');

          let color = new THREE.Color(this.get('highlightingColor'));
          this.get('selectedEntitysMesh').material.color = color;
        }
        // Open selected component
        else{
          if(this.get('appCommunicationHighlighted')){
            this.get('appCommunicationHighlighted').set('highlighted', false);
          }
          this.set('appCommunicationHighlighted', null);
          this.set('selectedEntitysMesh', null);
        }
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

    // Restore old color of landscape
    this.unhighlightLandscape(id);

    // Restore old color of application3D
    this.unhighlightApplication3D(id);

    // Case for intersection object present
    if(intersectedViewObj) {

      // Handle floor (teleport)
      if(intersectedViewObj.object.name === 'floor'){
        this.trigger('showTeleportArea', intersectedViewObj.point);
        return;
      }
      else{
        // Remove area for teleporting
        this.trigger('removeTeleportArea');
      }

      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton'){
        this.highlightDeleteButton(intersectedViewObj, id);
        return;
      }

      // hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;
      const emberModelName = emberModel.constructor.modelName;

      // Calculate darker color
      let darkerColor = this.calculateDarkerColor(intersectedViewObj.object);

      // Handle hit system, nodegroup or application and change color
      this.highlightLandscape(emberModel, emberModelName, intersectedViewObj, id, darkerColor);

      // Handle hit component/clazz of app3D 
      if(emberModelName === "component" || emberModelName === "clazz"){
        let appID = intersectedViewObj.object.parent.userData.model.id;

        // Just highlight communication lines if component closed or clazz
        if(!emberModel.get('opened') || emberModelName === "clazz"){
          // Check if a component is already highlighted and restore color
          if(this.get('selectedEntitysMesh') && this.get('appCommunicationHighlighted') && this.get('selectedEntitysColor')){
            // Return if identical to intersected object
            if(this.get('selectedEntitysMesh') === intersectedViewObj.object){
              this.restoreSelectedEntity(id);
              this.set('selectedEntitysMesh', null);

              this.trigger("entityHighlighted", false);
              return;
            }
            // Reset communication lines
            this.get('selector').highlightAppCommunication(null, this.get('highlightedAppModel'));
            // Restore selected entity and communication lines
            this.restoreSelectedEntity(id);
          }

          // Save selected entity and communication highlighting
          this.saveSelectedEntity(intersectedViewObj, emberModel);

          this.trigger('entityHighlighted', true, appID, emberModel.id, this.get('selectedEntitysColor'));
          let color = new THREE.Color(this.get('highlightingColor'));
          intersectedViewObj.object.material.color = color;
          this.get('appCommunicationHighlighted').set('highlighted', true);
          
          this.get('selector').highlightAppCommunication(emberModel, this.get('highlightedAppModel'));
          this.trigger('redrawAppCommunication');
        }
      }
      // Unhighlight delete button if app3D or landscape is highlighted 
      let additionalCondition = (this.get('highlightedEntitiesApp')[id] || this.get('highlightedEntities')[id]);
      this.unhighlightedDeleteButton(id, additionalCondition);
    }
    // Nothing hit 
    else{
      // Remove area for teleporting
      this.trigger('removeTeleportArea');

      // Reset selection 
      if(this.get('appCommunicationHighlighted') && this.get('selectedEntitysMesh') && this.get('selectedEntitysColor')){

        // Reset communication lines
        this.get('selector').highlightAppCommunication(null, this.get('highlightedAppModel').userData.model);

        // Restore selected entity and communication lines
        this.restoreSelectedEntity(id);

        this.set('appCommunicationHighlighted', null);
        this.set('selectedEntitysMesh', null);
        this.trigger('redrawAppCommunication');
        this.trigger('entityHighlighted', false);
      }

      // Unhighlight delete button
      this.unhighlightedDeleteButton(id, true);
    }
  },

  /*
   * This method is used to handle the panning event
   * triggered by the mouse
   */
  handlePanning(delta, event) {

    if(event.button === 1){
      // Translate camera
      let distanceXInPercent = (delta.x /
        parseFloat(this.get('renderer').domElement.clientWidth)) * ( -10.0);

      let distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 10.0;

      this.get('vrEnvironment').position.x +=  distanceXInPercent;
      this.get('vrEnvironment').position.z -= distanceYInPercent;

      this.get('environmentOffset').x += distanceXInPercent;
      this.get('environmentOffset').z -= distanceYInPercent;

      this.updateObjectMatrix(this.get('vrEnvironment'));
      let deltaPosition = new THREE.Vector3(distanceXInPercent, 0, -distanceYInPercent);
      this.trigger('landscapeMoved', deltaPosition);
    } else if(event.button === 3){
      // Translate camera
      let distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 10.0;

      this.get('vrEnvironment').position.y = this.get('vrEnvironment').position.y - distanceYInPercent;
      this.get('environmentOffset').y -= distanceYInPercent;
      
      this.updateObjectMatrix(this.get('vrEnvironment'));
      let deltaPosition = new THREE.Vector3(0, -distanceYInPercent, 0);
      this.trigger('landscapeMoved', deltaPosition);
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
      // Exclude floor and delete button
      if (intersectedViewObj.object.name === 'deleteButton' || intersectedViewObj.object.name === 'floor'){
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
  },

  ////////// Helper functions //////////

  /*
   *  This method is used to darken the color of the systems, nodegroups and applications
   */
  highlightLandscape(emberModel, emberModelName, intersectedViewObj, id, darkerColor){
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

          // Change entity color 
          this.get('labeler').redrawLabel(intersectedViewObj.object, 
            this.get('colorList')[index],name, darkerColor);

          // Save highlighted object
          this.get('highlightedEntities')[id] = intersectedViewObj.object;
       }
    }
  },
  
  /*
   *  This method is used to look for highlighted 'systems', 
   *  'nodegroups' or 'applications (2D)' and restore their
   *  color if the same controller id highlighted it
   */
  unhighlightLandscape(id){
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

      this.get('highlightedEntities')[id] = null;
    }
  },

  /*
   *  This method is used to save the selected entity
   *  and the highlighted communication lines
   */
  saveSelectedEntity(intersectedViewObj, emberModel){
    this.set('highlightedAppModel', intersectedViewObj.object.parent.userData.model);
    this.set('selectedEntitysMesh', intersectedViewObj.object);
    if(intersectedViewObj.object.userData.type === 'clazz'){
      this.set('selectedEntitysColor', new THREE.Color(this.get('colorListApp')[this.get('selectedEntitysMesh').userData.type]));
    }
    else{
      this.set('selectedEntitysColor', intersectedViewObj.object.userData.model.get('color'));
    }
    this.set('appCommunicationHighlighted', emberModel);
  },

  /*
   *  This method is used to restore the color of
   *  a selected entity and to reset the highlighting of the
   *  communication lines
   */
  restoreSelectedEntity(id){
    
    // Restore old color (clazz)
    if(this.get('selectedEntitysMesh').userData.type === 'clazz'){
      this.get('selectedEntitysMesh').material.color = new THREE.Color(this.get('colorListApp')[this.get('selectedEntitysMesh').userData.type]);
    }
    // Restore old color (package)
    else{
      this.get('selectedEntitysMesh').material.color = new THREE.Color(this.get('selectedEntitysColor'));
    }

    // Check if entity is highlighted by the other controller and change color
    if(this.get('highlightedEntitiesApp')[id] && this.get('selectedEntitysMesh') && this.get('highlightedEntitiesApp')[id] === this.get('selectedEntitysMesh')){
      this.get('highlightedEntitiesApp')[id].material.color = new THREE.Color(this.calculateDarkerColor(this.get('selectedEntitysMesh')));
    }

    this.get('appCommunicationHighlighted').set('highlighted', false);
  },

  /*
   *  This method is used to exclude a selected 'package' or
   *  'clazz' from unhighlighting
   */
  excludeSelectedEntity(controller, intersectedViewObj){
    if(intersectedViewObj){
      if(this.get('selectedEntitysMesh') && this.get('selectedEntitysMesh') === intersectedViewObj.object){
        // Scale ray distance to distance of intersection
        controller.getObjectByName('controllerLine').scale.z = intersectedViewObj.distance;
        return true;
      }
    }
  },

  /*
   *  This method is used to look for highlighted 'packages' or
   *  'clazzes' of an application3D and restore their color if the 
   *  same controller id highlighted it
   */
   unhighlightApplication3D(id){
    // Package highlihgted
    let condition1 = this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.model.get('color'); 
    // Clazz highlighted
    let condition2 = this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.type && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type];
    // No entity selected or selected one is not highlighted
    let condition3 = (!this.get('selectedEntitysMesh') || (this.get('highlightedEntitiesApp')[id] !== this.get('selectedEntitysMesh')));
    
    // Handle packages
    if(condition1 && condition3){
      let originalColor = this.calculateLighterColor(this.get('highlightedEntitiesApp')[id]);
      this.get('highlightedEntitiesApp')[id].material.color = new THREE.Color(originalColor);
     }
     // Handle clazzes
     if(condition2 && condition3){  
      let originalColor = this.calculateLighterColor(this.get('highlightedEntitiesApp')[id]);
      this.get('highlightedEntitiesApp')[id].material.color = new THREE.Color(originalColor);
     }
     this.get('highlightedEntitiesApp')[id] = null;
   },

  /*
   *  This method is used to highlight the delete button
   */
  highlightDeleteButton(intersectedViewObj, id){
    // Highlight if not highlighted
    if(!this.get('deleteButtonHighlighted')){
      // Save unhighlighted material
      this.set('materialUnhighlighted', intersectedViewObj.object.material);
      // Set new material
      let materialHighlighted = new THREE.MeshPhongMaterial({
        map: this.get('textureHighlighted')
      });
      this.set('materialHighlighted', materialHighlighted);

      intersectedViewObj.object.material = this.get('materialHighlighted');
      this.set('deleteButtonHighlighted', id);
    }
  },

  /*
   *  This method is used to unhighlight the delete button
   *  if the passed controller id highlighted it
   */
  unhighlightedDeleteButton(id, additionalCondition){
    if(this.get('openApps') && this.get('deleteButtonHighlighted') === id && additionalCondition){
      this.get('openApps').forEach( app => {
        app.getObjectByName('deleteButton').material = this.get('materialUnhighlighted');
      });
      //this.get('application3D').getObjectByName('deleteButton').material = this.get('materialUnhighlighted');
      this.set('deleteButtonHighlighted', null);
    }
  },

  /*
   *  This method is used to scale the ray and check if an entity is 
   *  already highlighted
   */
  isEntityHighlighted(intersectedViewObj, controller, id2){

    let id = controller.id;
    
    if(intersectedViewObj){

      // Scale ray distance to distance of intersection
      controller.getObjectByName('controllerLine').scale.z = intersectedViewObj.distance;

      // Landscape or Application3D highlighted by first controller
      if((this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id] === intersectedViewObj.object) ||
        (this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id] === intersectedViewObj.object)){
        return true;
      }
      // Landscape or Application3D highlighted by second controller
      else if((this.get('highlightedEntities')[id2] && this.get('highlightedEntities')[id2] === intersectedViewObj.object) ||
        (this.get('highlightedEntitiesApp')[id2] && this.get('highlightedEntitiesApp')[id2] === intersectedViewObj.object)){
        return true;
      }
    }
  },

  /*
   *  This method is used to remove an application
   *  and to do all necessary clean up
   */
  deleteApplication3D(intersectedViewObj){
    // Reset highlighting of delete buttonghlighting of delete button
    this.set('deleteButtonHighlighted', null);

    // Check if delete button was highlighted => restore unhighlighted material
    if(this.get('materialUnhighlighted')){
      intersectedViewObj.object.material = this.get('materialUnhighlighted');
    }
    // Dispose highlighted material
    if(this.get('materialHighlighted')){
      this.get('materialHighlighted').map.dispose();
      this.get('materialHighlighted').dispose();
    }
    // Remove selection
    if(this.get('appCommunicationHighlighted')){
      this.get('selector').highlightAppCommunication(null, this.get('highlightedAppModel'));
      this.get('appCommunicationHighlighted').set('highlighted', false);
      this.set('appCommunicationHighlighted', null);
      this.set('selectedEntitysMesh', null);
    }
    // Remove application if delete button was hit
    if (intersectedViewObj.object.userData.appID && !this.get('boundApps').has(intersectedViewObj.object.userData.appID)){
      this.trigger('removeApplication', intersectedViewObj.object.userData.appID);
    }
  },

  /*
   *  This method is used to adapt the users view to 
   *  the new position
   */
  teleportToPosition(position){
    const cameraOffset = new THREE.Vector3();

    cameraOffset.copy(this.camera.position);
    cameraOffset.y = 0;
    let offset = new THREE.Vector3().subVectors(this.get('cameraGroup.position'), cameraOffset);
    this.user.position.subVectors(new THREE.Vector3(position.x, this.user.position.y, position.z), offset);
    
  },

  /*
   *  This method is used to identify the controller ids of
   *  each controller
   */
  verifyControllers(id){
    let id2;
    if(id === this.get('controller1').id){
      id2 = this.get('controller2').id;
    }
    else{
      id2 = this.get('controller1').id;
    }
    return id2;
  },

  /*
   *  This method is used to update the matrix of
   *  a given Object3D
   */
  updateObjectMatrix(object){
    if(object){
      object.updateMatrix();
    }
  },

  /*
   *  This method is used to exclude the landscape from raycasting
   */ 
  excludeLandscape(){
    var raycastingObjects = [];
    this.get('raycastObjectsLandscape').forEach(function(entity) {
      if(entity.type !== "system" && entity.type !== "nodegroup" && entity.name !== "node" && entity.name !== "application"){
        raycastingObjects.push(entity);
      }
    });
    return raycastingObjects;
  },

  /*
   *  The method is used to calculate a 35 percent 
   *  darker color
   */
  calculateDarkerColor(object){
    let actualColor = null;

    if(object.material.length){
      actualColor = object.material[0].color;
    }
    else{
      actualColor = object.material.color;
    }

    let r = Math.floor(actualColor.r * 0.625 * 255);
    let g = Math.floor(actualColor.g * 0.625 * 255);
    let b = Math.floor(actualColor.b * 0.625 * 255);

    return "rgb("+r+", "+g+", "+b+")";
  },

    /*
   * The method is used to reverse the effect of
   * calculateDarkerColor()
   */
  calculateLighterColor(object){
    let actualColor = null;

    if(object.material.length){
      actualColor = object.material[0].color;
    }
    else{
      actualColor = object.material.color;
    }

    let r = Math.floor(actualColor.r * 1.6 * 255);
    let g = Math.floor(actualColor.g * 1.6 * 255);
    let b = Math.floor(actualColor.b * 1.6 * 255);

    return "rgb("+r+", "+g+", "+b+")";
  }
});
