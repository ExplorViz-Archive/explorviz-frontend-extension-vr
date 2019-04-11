import EmberObject, { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import HammerInteraction from 'explorviz-frontend/utils/hammer-interaction';
import HoverHandler from './hover-handler';
import HoverHandlerApp3D from 'explorviz-frontend/utils/application-rendering/popup-handler';
import HoverHandlerLandscape from 'explorviz-frontend/utils/landscape-rendering/popup-handler';
import AlertifyHandler from 'explorviz-frontend/mixins/alertify-handler';
import THREE from "three";
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import Helper from '../multi-user/helper';


/*
 *  This util is used to realize the interaction by handeling
 *  mouse and controller events.
 */
export default EmberObject.extend(Evented, AlertifyHandler, {

  menus: service(),
  currentUser: service('user'),
  world: service(),
  configuration: service(),

  user: computed('currentUser.threeGroup', function () {
    return this.get('currentUser.threeGroup');
  }),

  canvas: null,
  room: null,

  renderer: null,
  raycaster: null,
  raycastObjectsLandscape: null,

  labeler: null,

  colorList: null,
  colorListApp: null,

  // EmberModel of the selected entity
  highlightedAppModel: null,
  // Mesh of the selected entity
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

  highlightedEntities: {},
  highlightedEntitiesApp: {},

  hammerHandler: null,
  hoverHandler: null,
  hoverHandlerLandscape: null,
  hoverHandlerApp3D: null,

  boundApps: null,
  highlightingColor: null,

  listeners: null, // Maps listener strings to functions, save listeners to be able to remove them later on

  init() {
    this._super(...arguments);
    this.set('highlightingColor', this.get('configuration.applicationColors.highlightedEntity'));
  },

  // Init handlers for interaction with landscape and applications
  initHandlers() {
    this.addControllerHandlers();

    const canvas = this.get('canvas');

    // Handlers for mouse interaction with canvas
    canvas.addEventListener('mouseout', (event) => { this.onMouseOut(event) });
    canvas.addEventListener('mouseenter', (event) => { this.onMouseEnter(event) });
    canvas.addEventListener('wheel', (event) => { this.onMouseWheelStart(event) });

    // Load texture for delete button highlighted
    this.set('textureHighlighted', new THREE.TextureLoader().load('images/x_white.png'));

    ////////// Keyboard interaction ////////// 

    // Add key listener for room positioning
    window.onkeydown = event => {
      const mvDst = 0.05;
      // Handle keys
      switch (event.key) {
        case 'ArrowDown':
          this.get('user').position.y -= mvDst;
          break;
        case 'ArrowUp':
          this.get('user').position.y += mvDst;
          break;
        case 'ArrowLeft':
          this.get('user').position.x -= mvDst;
          break;
        case 'ArrowRight':
          this.get('user').position.x += mvDst;
          break;
        case '-':
          this.get('user').position.z += mvDst;
          break;
        case '+':
          this.get('user').position.z -= mvDst;
          break;
        case 'w':
          this.get('world.vrEnvironment').position.z -= mvDst;
          this.get('world.environmentOffset').z -= mvDst;
          this.updateObjectMatrix(this.get('world.vrEnvironment'));
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, -mvDst));
          break;
        case 'a':
          this.get('world.vrEnvironment').position.x -= mvDst;
          this.get('world.environmentOffset').x -= mvDst;
          this.updateObjectMatrix(this.get('world.vrEnvironment'));
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, -mvDst));
          break;
        case 's':
          this.get('world.vrEnvironment').position.z += mvDst;
          this.get('world.environmentOffset').z += mvDst;
          this.updateObjectMatrix(this.get('world.vrEnvironment'));
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, mvDst));
          break;
        case 'd':
          this.get('world.vrEnvironment').position.x += mvDst;
          this.get('world.environmentOffset').x += mvDst;
          this.updateObjectMatrix(this.get('world.vrEnvironment'));
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, mvDst));
          break;
        case 'q':
          this.get('world.vrEnvironment').rotation.x -= mvDst;
          this.updateObjectMatrix(this.get('world.vrEnvironment'));
          this.trigger('centerVREnvironment');
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, 0)); //no position change, only quaternion
          break;
        case 'e':
          this.get('world.vrEnvironment').rotation.x += mvDst;
          this.updateObjectMatrix(this.get('world.vrEnvironment'));
          this.trigger('centerVREnvironment');
          this.trigger('landscapeMoved', new THREE.Vector3(0, 0, 0)); //no position change, only quaternion
          break;
      }
    };

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
      this.set('hoverHandlerLandscape', HoverHandlerLandscape.create(getOwner(this).ownerInjection()));
    }
    // Init HoverHandler for mouse (app3D)
    if (!this.get('hoverHandlerApp3D')) {
      this.set('hoverHandlerApp3D', HoverHandlerApp3D.create(getOwner(this).ownerInjection()));
    }

    // Hover handler
    this.registerHoverHandler();

    this.setupHammerListener();
  },

  addControllerHandlers() {
    this.set('listeners', new Map());

    // Save listeners for primary controller to be able to later remove them
    this.get('listeners').set('onTriggerDownPrimaryController', (event) => { this.onTriggerDownPrimaryController(event) });
    this.get('listeners').set('onTriggerUpPrimaryController', (event) => { this.onTriggerUpPrimaryController(event) });
    this.get('listeners').set('onMenuDownPrimaryController', (event) => { this.onMenuDownPrimaryController(event) });
    this.get('listeners').set('onGripDownPrimaryController', (event) => { this.onGripDownPrimaryController(event) });
    this.get('listeners').set('onGripUpPrimaryController', (event) => { this.onGripUpPrimaryController(event) });
    this.get('listeners').set('onAxisChangedPrimaryController', (event) => { this.onAxisChangedPrimaryController(event) });

    // Setup listeners for primary controller (interaction with landscape etc.)
    this.get('currentUser.primaryController').addEventListener('triggerdown', this.get('listeners').get('onTriggerDownPrimaryController'));
    this.get('currentUser.primaryController').addEventListener('triggerup', this.get('listeners').get('onTriggerUpPrimaryController'));
    this.get('currentUser.primaryController').addEventListener('menudown', this.get('listeners').get('onMenuDownPrimaryController'));
    this.get('currentUser.primaryController').addEventListener('gripdown', this.get('listeners').get('onGripDownPrimaryController'));
    this.get('currentUser.primaryController').addEventListener('gripup', this.get('listeners').get('onGripUpPrimaryController'));
    this.get('currentUser.primaryController').addEventListener('axischanged', this.get('listeners').get('onAxisChangedPrimaryController'));

    // Save listeners for secondary controller to be able to later remove them
    this.get('listeners').set('onTriggerDownSecondaryController', (event) => { this.onTriggerDownSecondaryController(event) });
    this.get('listeners').set('onGripDownSecondaryController', (event) => { this.onGripDownSecondaryController(event) });
    this.get('listeners').set('onGripUpSecondaryController', (event) => { this.onGripUpSecondaryController(event) });
    this.get('listeners').set('onMenuDownSecondaryController', (event) => { this.onMenuDownSecondaryController(event) });

    // Setup listeners for secondary controller (teleport, highlight etc.)
    this.get('currentUser.secondaryController').addEventListener('triggerdown', this.get('listeners').get('onTriggerDownSecondaryController'));
    this.get('currentUser.secondaryController').addEventListener('gripdown', this.get('listeners').get('onGripDownSecondaryController'));
    this.get('currentUser.secondaryController').addEventListener('gripup', this.get('listeners').get('onGripUpSecondaryController'));
    this.get('currentUser.secondaryController').addEventListener('menudown', this.get('listeners').get('onMenuDownSecondaryController'));

    // Unused events: triggerup, thumbpadup, menuup, axischanged
  },


  ////////// Controller interaction ////////// 

  /*
   * This method is used to highlight and unhighlight systems, nodegroups, packages
   * and clazzes if the controller ray hits them.
   * Furthermore this method scales the ray relative to distance of intersection
   */
  checkIntersectionPrimaryController(objects) {
    let controller = this.get('currentUser.primaryController')
    let controllerLine = controller.getObjectByName('controllerLine');

    // Id to verfify which controller triggered the event
    let primaryControllerId = controller.id;
    let secondaryControllerId = this.get('currentUser.secondaryController.id');

    // Calculate hit object
    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Stop if hit entity is already highlighted
    if (this.isEntityHighlighted(intersectedViewObj, controller, secondaryControllerId)) {
      return;
    }

    // Restore old color of landscape
    this.unhighlightLandscape(primaryControllerId);

    // Restore old color of application3D
    this.unhighlightApplication3D(primaryControllerId);

    // Return if selected entity is hit
    if (this.excludeSelectedEntity(controller, intersectedViewObj)) {
      return;
    }

    // Check if an entity was hit
    if (!intersectedViewObj) {
      // Reset (possibly) highlighted delete button and resize ray
      this.unhighlightedDeleteButton(primaryControllerId, true);
      controllerLine.scale.z = 5;
      return;
    }

    // Handle delete button
    if (intersectedViewObj.object.name === 'deleteButton') {
      this.highlightDeleteButton(intersectedViewObj, primaryControllerId);
      return;
    }

    // Handle floor
    if (intersectedViewObj.object.name === 'floor') {
      return;
    }

    // Handle menus
    let menu = this.get('menus').getMenuByName(intersectedViewObj.object.name);
    if (menu) {
      let triggerIsPressed = controller.getButtonState('trigger');
      if (triggerIsPressed) {
        menu.interact('rightTriggerPressed', intersectedViewObj.uv);
      } else {
        menu.interact('rightIntersect', intersectedViewObj.uv);
      }
      return;
    }

    const emberModel = intersectedViewObj.object.userData.model;

    if (!emberModel)
      return;

    const emberModelName = emberModel.constructor.modelName;

    // Calculate darker color
    let darkerColor = Helper.calculateDarkerColor(intersectedViewObj.object);

    // Handle hit system, nodegroup or application and change color
    this.highlightLandscape(emberModel, emberModelName, intersectedViewObj, primaryControllerId, darkerColor);

    // Handle hit component/clazz of app3D if its not binded to a Controller
    if ((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded')) {
      // New color 
      let color = new THREE.Color(darkerColor);
      intersectedViewObj.object.material.color = color;

      /* Save highlighted object and bind it on controller id to quarantee 
       * that only this controller can unhighlight it */
      this.get('highlightedEntitiesApp')[primaryControllerId] = intersectedViewObj.object;

    }

    // Unhighlight delete button if app3D or landscape is 
    // highlighted AND delete button was highlighted by this controller
    let additionalCondition = (this.get('highlightedEntitiesApp')[primaryControllerId] || this.get('highlightedEntities')[primaryControllerId]);
    this.unhighlightedDeleteButton(primaryControllerId, additionalCondition);
  },

  /*
   * This method is used to highlight and unhighlight closed packages
   * and clazzes if the controller ray hits them.
   * Furthermore this method scales the ray relative to distance of intersection
   */
  checkIntersectionSecondaryController(objects) {
    let controller = this.get('currentUser.secondaryController')
    let controllerLine = controller.getObjectByName('controllerLine');

    // Id to verfify which controller triggered the event
    let id = controller.id;

    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Verify controllers
    let primaryControllerId = this.get('currentUser.primaryController.id');

    // Stop if entity is already highlighted by a controller
    if (this.isEntityHighlighted(intersectedViewObj, controller, primaryControllerId)) {
      return;
    }

    // Restore old color of application3D
    this.unhighlightApplication3D(id);

    // Stop if selected entity is hit
    if (this.excludeSelectedEntity(controller, intersectedViewObj)) {
      return;
    }

    // Case for intersection object present
    if (intersectedViewObj) {

      // Handle floor (teleport)
      if (intersectedViewObj.object.name === 'floor') {
        this.trigger('showTeleportArea', intersectedViewObj.point);
        return;
      }
      else {
        // Remove area for teleporting
        this.trigger('removeTeleportArea');
      }

      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton') {
        this.highlightDeleteButton(intersectedViewObj, id);
        return;
      }

      const emberModel = intersectedViewObj.object.userData.model;

      if (!emberModel)
        return;

      const emberModelName = emberModel.constructor.modelName;

      // Calculate darker color
      let darkerColor = Helper.calculateDarkerColor(intersectedViewObj.object);

      // Show teleport area on opened systems
      if (emberModelName === "system" && intersectedViewObj.object.name === "systemOpened") {
        this.trigger('showTeleportArea', intersectedViewObj.point);
      }
      // Handle closed component/clazz of app3D
      else if (((emberModelName === "component" && !emberModel.get('opened')) || emberModelName === "clazz") && !this.get('app3DBinded')) {
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
    else {
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
   * This method handles the controller event 'onmenudown'
   * and is used to show information about the intersected object. 
   * @method - onMenuDownPrimaryController
   */
  onMenuDownPrimaryController(event) {
    const controller = event.target;
    let id = controller.id;

    let objects = this.get('raycastObjectsLandscape');
    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Check if an object is hit
    if (intersectedViewObj) {

      // Handle delete button and floor exception
      if (intersectedViewObj.object.name === 'deleteButton' || intersectedViewObj.object.name === 'floor') {
        return;
      }

      // Handle menus
      let menu = this.get('menus').getMenuByName(intersectedViewObj.object.name);
      if (menu) {
        menu.interact('rightMenuDown', intersectedViewObj.uv);
        return;
      }

      // Remove text box if hit object is not the previous one
      if (this.get('previousToolTipObjects')[id] && this.get('previousToolTipObjects')[id].id !== intersectedViewObj.object.id) {

        controller.remove(controller.getObjectByName('textBox'));
        this.get('previousToolTipObjects')[id] = null;
      }

      // Create tool tip for intersected object65
      if (!this.get('previousToolTipObjects')[id]) {

        const emberModel = intersectedViewObj.object.userData.model;

        if (!emberModel)
          return;

        // Get information to display for hit object
        let content = this.get('hoverHandler').buildContent(emberModel);

        let textBox = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2));
        textBox.name = 'textBox';

        // Position box for tooltip
        textBox.position.y += 0.065;
        textBox.position.z -= 0.115;
        textBox.geometry.rotateX(1.5707963267949 * 1.5);
        textBox.geometry.rotateY(1.5707963267949 * 2);
        textBox.geometry.rotateZ(1.5707963267949 * 2);

        // Define dimension of canvas for infotext
        let canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;

        // Fill context of canvas with color and text
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FDF5E6';
        ctx.fillRect(0.4, 0.4, canvas.width - 0.8, canvas.height - 0.8);

        // Draw title
        ctx.font = '20px arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = "center";
        ctx.fillText(content.title, canvas.width / 2, 20);

        // draw line
        ctx.fillText("-------------------------------------------------", canvas.width / 2, 32);

        // Spilt up remaining canvas for each entry
        let offset = (canvas.height - 52) / 3;

        let tempOffset = offset;

        // Position under line
        offset = 52;

        // New font size for entries
        ctx.font = '15px arial';
        // Each entry consist of two values: name and value
        for (let key1 in content.innerContent) {
          let left = true;

          // Draw entry
          for (let key2 in content.innerContent[key1]) {
            // Draw content on the left (name)
            if (!left) {
              ctx.textAlign = "right";
              ctx.fillText(content.innerContent[key1][key2], canvas.width - 10, offset);
              left = true;
            }
            // Draw content on the right (value)
            else {
              ctx.textAlign = "left";
              ctx.fillText(content.innerContent[key1][key2], 10, offset);
              left = false;
            }
          }
          offset += tempOffset;
        }

        // Create texture out of canvas
        let texture = new THREE.Texture(canvas);
        // Map texture
        let material2 = new THREE.MeshBasicMaterial({ map: texture });

        // Update texture      
        texture.needsUpdate = true;
        // Update mesh material    
        textBox.material = material2;

        // Add mesh to controller
        controller.add(textBox);
        this.get('previousToolTipObjects')[id] = intersectedViewObj.object;
      }
    }
    else {
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
  onGripUpPrimaryController(event) {
    const controller = event.target;

    if (controller.userData.selected !== undefined && controller.userData.selected.name !== "textBox") {
      // Set bool for application3D not binded
      this.set('app3DBinded', false);
      this.get('app3DBindedByController')[controller.id] = null;

      // Get stored application3D from controller
      let object = controller.userData.selected;
      // Transform object back into transformation relative to local space
      object.matrix.premultiply(controller.matrixWorld);
      // Split up transforamtion into position, quaternion and scale
      object.matrix.decompose(object.position, object.quaternion, object.scale);

      // Add application3D to scene
      this.get('world.scene').add(object);
      // Delete stored application3D 
      controller.userData.selected = undefined;

      this.trigger('appReleased', object.userData.model.id, object.position, object.quaternion);
    }
  },


  /*
   * This method handles the primary controller (event 'triggerdown')
   * and is used to open/close systems, nodegroups and 
   * components of 3D application. 
   */
  onTriggerDownPrimaryController(event, objects) {
    const controller = event.target;

    /* Refuse trigger functionality if the controller which triggered
     * the event already binds the app3D 
     */
    if (this.get('app3DBindedByController')[controller.id]) {
      return;
    }
    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Check if an object is hit
    if (!intersectedViewObj) {
      return;
    }

    // Handle delete button
    if (intersectedViewObj.object.name === 'deleteButton') {
      // Delete application
      this.deleteApplication3D(intersectedViewObj);
      return;
    }

    // Handle floor
    if (intersectedViewObj.object.name === 'floor') {
      return;
    }

    // Handle menus
    let menu = this.get('menus').getMenuByName(intersectedViewObj.object.name);
    if (menu) {
      menu.interact('rightTriggerDown', intersectedViewObj.uv);
      return;
    }

    const emberModel = intersectedViewObj.object.userData.model;

    if (!emberModel)
      return;

    const emberModelName = emberModel.constructor.modelName;

    // Handle application hit
    if (emberModelName === "application" && !this.get('app3DBinded')) {
      if (emberModel.get('components').get('length') > 0) {
        this.trigger('showApplication', emberModel, intersectedViewObj.point);
      } else if (emberModel.get('components').get('length') === 0) {
        const message = `No details available for`;
        this.get('menus.hintMenu').showHint(message, 3, emberModel.get('name'));
        return;
      }
    }
    // Handle nodegroup or system hit
    else if (emberModelName === "nodegroup" || emberModelName === "system") {
      emberModel.setOpened(!emberModel.get('opened'));

      if (emberModelName === "system") {
        this.trigger('systemStateChanged', emberModel.id, emberModel.get('opened'));
      } else if (emberModelName === "nodegroup") {
        this.trigger('nodegroupStateChanged', emberModel.id, emberModel.get('opened'));
      }
      // Trigger event in component vr-rendering
      this.trigger('redrawScene');
    }
    // Handle component of app3D hit
    else if ((emberModelName === "component") && !this.get('app3DBinded')) {
      let appID = intersectedViewObj.object.userData.appID;

      // Do not allow altering bound apps
      if (this.get('boundApps').has(appID)) {
        return;
      }

      // Toggle state and redraw app
      emberModel.setOpenedStatus(!emberModel.get('opened'));
      this.trigger('redrawApp', appID);
      this.trigger('componentUpdate', appID, emberModel.id, emberModel.get('opened'), emberModel.get('foundation'));

      // Restore selection
      if (this.get('selectedEntitysMesh')) {
        let color = new THREE.Color(this.get('highlightingColor'));
        this.get('selectedEntitysMesh').material.color = color;
      }
    }
  },

  /*
   * This method handles the right controller (event 'triggerup')
   */
  onTriggerUpPrimaryController(event, objects) {
    const controller = event.target;

    /* Refuse trigger functionality if the controller which triggered
     * the event already binds the app3D 
     */
    if (this.get('app3DBindedByController')[controller.id]) {
      return;
    }

    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Check if an object is hit
    if (!intersectedViewObj) {
      return;
    }

    // Handle menus
    let menu = this.get('menus').getMenuByName(intersectedViewObj.object.name);
    if (menu) {
      menu.interact('rightTriggerUp', intersectedViewObj.uv);
    }
  },

  /*
   * This method handles the left controller (event 'triggerdown')
   * and is used 
   * select components/clazzes of application3D and teleport. 
   */
  onTriggerDownSecondaryController(event, objects) {
    const controller = event.target;

    /* Refuse trigger functionality if the controller which triggered
     * the event already binds the app3D 
     */
    if (this.get('app3DBindedByController')[controller.id]) {
      return;
    }

    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Check if an object is hit
    if (!intersectedViewObj) {
      return;
    }
    // Handle delete button
    if (intersectedViewObj.object.name === 'deleteButton') {
      // Delete application
      this.deleteApplication3D(intersectedViewObj);
      return;
    }

    // Handle floor (teleport)
    if (intersectedViewObj.object.name === 'floor') {
      this.get('currentUser').teleportToPosition(intersectedViewObj.point);
      return;
    }

    const emberModel = intersectedViewObj.object.userData.model;

    if (!emberModel)
      return;

    const emberModelName = emberModel.constructor.modelName;

    // Handle component of app3D hit
    if ((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded')) {
      let appID = intersectedViewObj.object.parent.userData.model.id;

      // Just highlight entity and communication lines if component closed or clazz
      if (!emberModel.get('opened') || emberModelName === "clazz") {

        // Check if a component is already highlighted and restore color
        if (this.get('selectedEntitysMesh') && this.get('selectedEntitysColor')) {

          // If identical to intersected object unhighlight and return
          if (this.get('selectedEntitysMesh') === intersectedViewObj.object) {
            this.restoreSelectedEntity(this.get('currentUser.primaryController.id'));
            this.set('selectedEntitysMesh', null);
            this.trigger("entityHighlighted", false, appID, emberModel.id, this.get('selectedEntitysColor'));
            this.set('selectedEntitysColor', null);
            return;
          }
          // Restore old color
          this.restoreSelectedEntity(this.get('currentUser.primaryController.id'));
        }

        // Save selected entity and communication highlighting
        this.saveSelectedEntity(intersectedViewObj, emberModel);

        this.trigger("entityHighlighted", true, appID, emberModel.id, this.get('selectedEntitysColor'));

        // Set new color
        let color = new THREE.Color(this.get('highlightingColor'));
        intersectedViewObj.object.material.color = color;

        // Reset highlighting for selected component
        this.get('highlightedEntitiesApp')[controller.id] = null;
      }
    }
  },

  /* 
   * This method handles the controller event 'thumbpaddown'
   * and is used to move, zoom and rotate application3D
   */
  onGripDownPrimaryController(event, objects) {
    const controller = event.target;
    let controllerLine = controller.getObjectByName('controllerLine');

    let controllerMatrix = new THREE.Matrix4();
    controllerMatrix.identity().extractRotation(controllerLine.matrixWorld);

    const intersectedViewObj = this.calculateIntersectedViewObject(controller, objects);

    // Check if an object is hit
    if (intersectedViewObj) {
      // Handle delete button and floor exception
      if (intersectedViewObj.object.name === 'deleteButton' || intersectedViewObj.object.name === 'floor') {
        return;
      }

      // Handle menus
      let menu = this.get('menus').getMenuByName(intersectedViewObj.object.name);
      if (menu) {
        menu.interact('rightGripDown', intersectedViewObj.uv);
        return;
      }

      const emberModel = intersectedViewObj.object.userData.model;

      if (!emberModel)
        return;

      const emberModelName = emberModel.constructor.modelName;

      // Component or clazz hit and app3D not aready binded
      if ((emberModelName === "component" || emberModelName === "clazz") && !this.get('app3DBinded')) {
        let appID = intersectedViewObj.object.userData.appID;

        if (this.get('boundApps').has(appID)) {
          const message = 'Application is already being moved.';
          this.get('menus.hintMenu').showHint(message, 3);
          return;
        }

        // Set bool for application3D binded
        this.set('app3DBinded', true);
        this.get('app3DBindedByController')[controller.id] = "true";

        // Get inverse of controller transoformation      
        controllerMatrix.getInverse(controller.matrixWorld);

        let object = intersectedViewObj.object.userData.object3D;

        // Set transforamtion relative to controller transformation
        object.matrix.premultiply(controllerMatrix);
        // Split up matrix into position, quaternion and scale
        object.matrix.decompose(object.position, object.quaternion, object.scale);
        // Add object to controller
        controller.add(object);
        // Store object 
        controller.userData.selected = object;

        // Send information about app binding to backend
        let boundToSecondaryController = controller.id === this.get('currentUser.secondaryController.id');

        this.trigger('appBinded', appID, object.position, object.quaternion, boundToSecondaryController, controller.position, controller.quaternion);
      }
    }
  },

  /**
   * This method handles inputs of the touchpad (HTC Vive) or analog stick (Oculus Rift) respectively.
   * This input is used to move a potentially grabbed application towards or away from the controller.
   */
  onAxisChangedPrimaryController(event) {
    const controller = event.target;

    const axes = event.axes;
    const yAxis = axes[1];

    if (controller.userData.selected !== undefined && controller.userData.selected.name !== "textBox") {
      // Get stored application3D from controller
      let application = controller.userData.selected;

      let appPosition = new THREE.Vector3();
      application.getWorldPosition(appPosition);

      let controllerPosition = new THREE.Vector3();
      controller.getWorldPosition(controllerPosition);

      let direction = new THREE.Vector3();
      direction.subVectors(appPosition, controllerPosition);

      // Do not move application if it is close to the controller
      if (direction.length() < 0.5 && yAxis < 0) {
        return;
      }

      // Adapt distance for moving according to trigger value
      const maxTranslation = 0.05;
      direction.normalize();
      direction.multiplyScalar(yAxis * maxTranslation);

      application.position.x += direction.x;
      application.position.y += direction.y;
      application.position.z += direction.z;
      this.updateObjectMatrix(application);
    }
  },

  onGripDownSecondaryController() { },
  onGripUpSecondaryController() { },
  onMenuDownSecondaryController() { },

  ////////// Mouse interaction ////////// 

  onMouseWheelStart(evt) {
    const deltaX = Math.max(-1, Math.min(1, evt.deltaX)) * 0.1
    const deltaY = Math.max(-1, Math.min(1, evt.deltaY)) * 0.1;

    this.get('user').position.y -= deltaX;
    this.get('user').position.z += deltaY;
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
    this.get('hammerHandler').on('doubletap', (mouse) => { this.handleDoubleClick(mouse); });
    this.get('hammerHandler').on('panning', (delta, event) => { this.handlePanning(delta, event); });
    this.get('hammerHandler').on('panningEnd', (mouse) => { this.handleHover(mouse); });
    this.get('hammerHandler').on('singletap', (mouse) => { this.handleSingleClick(mouse); });
  },

  /*
   * This method is used to setup th hover handler
   */
  registerHoverHandler() {
    let timeout;

    // Custom event for mousemovement end
    this.get('canvas').addEventListener('mousemove', (evt) => {
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        let event = new CustomEvent("mousestop", {
          detail: {
            clientX: evt.clientX,
            clientY: evt.clientY
          },
          bubbles: true,
          cancelable: true
        });
        evt.target.dispatchEvent(event);
      }, 300);

      // When moving, hide (old) tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();
    });

    this.get('canvas').addEventListener('mousestop', (evt) => { this.handleHover(evt) }, false);
  },

  /*
   * This method is used to remove the events from the canvas and the controllers
   */
  removeHandlers() {
    this.get('hammerHandler.hammerManager').off();

    this.removeControllerHandlers();

    this.get('canvas').removeEventListener('mousewheel', this.onMouseWheelStart);
    this.get('canvas').removeEventListener('mousestop', this.handleHover);
    this.get('canvas').removeEventListener('mouseenter', this.onMouseEnter);
    this.get('canvas').removeEventListener('mouseout', this.onMouseOut);
  },

  removeControllerHandlers() {
    // Remove listeners for primary controller
    this.get('currentUser.primaryController').removeEventListener('triggerdown', this.get('listeners').get('onTriggerDownPrimaryController'));
    this.get('currentUser.primaryController').removeEventListener('triggerup', this.get('listeners').get('onTriggerUpPrimaryController'));
    this.get('currentUser.primaryController').removeEventListener('menudown', this.get('listeners').get('onMenuDownPrimaryController'));
    this.get('currentUser.primaryController').removeEventListener('gripdown', this.get('listeners').get('onGripDownPrimaryController'));
    this.get('currentUser.primaryController').removeEventListener('gripup', this.get('listeners').get('onGripUpPrimaryController'));
    this.get('currentUser.primaryController').removeEventListener('axischanged', this.get('listeners').get('onAxisChangedPrimaryController'));

    // Remove listeners for secondary controller
    this.get('currentUser.secondaryController').removeEventListener('triggerdown', this.get('listeners').get('onTriggerDownSecondaryController'));
    this.get('currentUser.secondaryController').removeEventListener('gripdown', this.get('listeners').get('onGripDownSecondaryController'));
    this.get('currentUser.secondaryController').removeEventListener('gripup', this.get('listeners').get('onGripUpSecondaryController'));
    this.get('currentUser.secondaryController').removeEventListener('menudown', this.get('listeners').get('onMenuDownSecondaryController'));

    this.set('listeners', null);
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
    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft + 0.66)) /
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop + 0.665)) /
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(null, origin,
      this.get('currentUser.camera'), this.get('raycastObjectsLandscape'));

    // Check if an object is hit
    if (!intersectedViewObj) {
      return;
    }

    // Handle delete button
    if (intersectedViewObj.object.name === 'deleteButton') {
      // Delete application
      this.deleteApplication3D(intersectedViewObj);
      return;
    }

    // Teleport to intersection point
    if (intersectedViewObj.object.name === 'floor') {
      this.get('currentUser').teleportToPosition(intersectedViewObj.point);
      return;
    }

    // Hide tooltip
    this.get('hoverHandlerLandscape').hideTooltip();
    this.get('hoverHandlerApp3D').hideTooltip();

    const emberModel = intersectedViewObj.object.userData.model;

    if (!emberModel)
      return;

    const emberModelName = emberModel.constructor.modelName;

    // Handle application hit
    if (emberModelName === "application") {

      // Handle no data for app3D available
      if (emberModel.get('components').get('length') === 0) {

        // No application3D => message
        const message = "Sorry, no details for <b>" + emberModel.get('name') +
          "</b> are available.";

        this.showAlertifyMessage(message);
      }
      // Handle data for app3D available
      else {
        // Data available => open application-rendering
        this.closeAlertifyMessages();
        // Trigger event in component vr-rendering
        this.trigger('showApplication', emberModel, intersectedViewObj.point);
      }
    }
    // Handle nodegroup or system hit
    else if (emberModelName === "nodegroup" || emberModelName === "system") {
      emberModel.setOpened(!emberModel.get('opened'));

      if (emberModelName === "system") {
        this.trigger('systemStateChanged', emberModel.id, emberModel.get('opened'));
      } else if (emberModelName === "nodegroup") {
        this.trigger('nodegroupStateChanged', emberModel.id, emberModel.get('opened'));
      }
      // Trigger event in component vr-rendering
      this.trigger('redrawScene');
    }
    // Handle component of app3D hit
    else if (emberModelName === "component") {
      let appID = intersectedViewObj.object.userData.appID;

      // Do not allow altering bound apps
      if (this.get('boundApps').has(appID)) {
        return;
      }

      // Toggle state and redraw app
      emberModel.setOpenedStatus(!emberModel.get('opened'));
      this.trigger('redrawApp', appID);

      this.trigger('componentUpdate', appID, emberModel.id, emberModel.get('opened'), emberModel.get('foundation'));

      // Restore selection
      if (this.get('selectedEntitysMesh')) {
        let color = new THREE.Color(this.get('highlightingColor'));
        this.get('selectedEntitysMesh').material.color = color;
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
    origin.x = ((mouse.x - (this.get('renderer').domElement.offsetLeft + 0.66)) /
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((mouse.y - (this.get('renderer').domElement.offsetTop + 0.665)) /
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(null, origin,
      this.get('currentUser.camera'), this.get('raycastObjectsLandscape'));

    let id = 123;

    // Restore old color of landscape
    this.unhighlightLandscape(id);

    // Restore old color of application3D
    this.unhighlightApplication3D(id);

    // Case for intersection object present
    if (intersectedViewObj) {

      // Handle floor (teleport)
      if (intersectedViewObj.object.name === 'floor') {
        this.trigger('showTeleportArea', intersectedViewObj.point);
        return;
      }
      else {
        // Remove area for teleporting
        this.trigger('removeTeleportArea');
      }

      // Handle delete button
      if (intersectedViewObj.object.name === 'deleteButton') {
        this.highlightDeleteButton(intersectedViewObj, id);
        return;
      }

      // Hide tooltip
      this.get('hoverHandlerLandscape').hideTooltip();
      this.get('hoverHandlerApp3D').hideTooltip();

      const emberModel = intersectedViewObj.object.userData.model;

      if (!emberModel)
        return;

      const emberModelName = emberModel.constructor.modelName;

      // Calculate darker color
      let darkerColor = Helper.calculateDarkerColor(intersectedViewObj.object);

      // Handle hit system, nodegroup or application and change color
      this.highlightLandscape(emberModel, emberModelName, intersectedViewObj, id, darkerColor);

      // Handle hit component/clazz of app3D 
      if (emberModelName === "component" || emberModelName === "clazz") {
        let appID = intersectedViewObj.object.parent.userData.model.id;

        // Just highlight communication lines if component closed or clazz
        if (!emberModel.get('opened') || emberModelName === "clazz") {
          // Check if a component is already highlighted and restore color
          if (this.get('selectedEntitysMesh') && this.get('selectedEntitysColor')) {
            // Return if identical to intersected object
            if (this.get('selectedEntitysMesh') === intersectedViewObj.object) {
              this.restoreSelectedEntity(id);
              this.set('selectedEntitysMesh', null);

              this.trigger("entityHighlighted", false, appID, emberModel.id, this.get('selectedEntitysColor'));
              return;
            }
            // Restore selected entity and communication lines
            this.restoreSelectedEntity(id);
          }

          // Save selected entity and communication highlighting
          this.saveSelectedEntity(intersectedViewObj, emberModel);

          this.trigger('entityHighlighted', true, appID, emberModel.id, this.get('selectedEntitysColor'));
          let color = new THREE.Color(this.get('highlightingColor'));
          intersectedViewObj.object.material.color = color;
        }
      }
      // Unhighlight delete button if app3D or landscape is highlighted 
      let additionalCondition = (this.get('highlightedEntitiesApp')[id] || this.get('highlightedEntities')[id]);
      this.unhighlightedDeleteButton(id, additionalCondition);
    }
    // Nothing hit 
    else {
      // Remove area for teleporting
      this.trigger('removeTeleportArea');

      // Unhighlight delete button
      this.unhighlightedDeleteButton(id, true);
    }
  },

  /*
   * This method is used to handle the panning event
   * triggered by the mouse
   */
  handlePanning(delta, event) {
    if (event.button === 1) {
      // Translate camera
      let distanceXInPercent = (delta.x /
        parseFloat(this.get('renderer').domElement.clientWidth)) * 10.0;

      let distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 10.0;

      this.get('world.vrEnvironment').position.x += distanceXInPercent;
      this.get('world.vrEnvironment').position.z += distanceYInPercent;

      this.get('world.environmentOffset').x += distanceXInPercent;
      this.get('world.environmentOffset').z += distanceYInPercent;

      this.updateObjectMatrix(this.get('world.vrEnvironment'));
      let deltaPosition = new THREE.Vector3(distanceXInPercent, 0, distanceYInPercent);
      this.trigger('landscapeMoved', deltaPosition);
    } else if (event.button === 3) {
      // Translate camera
      let distanceYInPercent = (delta.y /
        parseFloat(this.get('renderer').domElement.clientHeight)) * 10.0;

      this.get('world.vrEnvironment').position.y = this.get('world.vrEnvironment').position.y - distanceYInPercent;
      this.get('world.environmentOffset').y -= distanceYInPercent;

      this.updateObjectMatrix(this.get('world.vrEnvironment'));
      let deltaPosition = new THREE.Vector3(0, -distanceYInPercent, 0);
      this.trigger('landscapeMoved', deltaPosition);
    }

  },

  /*
   * This method is used to handle the hover event
   * triggered by the mouse
   */
  handleHover(evt) {
    const rect = this.get('canvas').getBoundingClientRect();

    const mouse = {
      x: evt.detail.clientX - rect.left,
      y: evt.detail.clientY - rect.top,
    };

    const origin = {};

    origin.x = ((evt.detail.clientX - (this.get('renderer').domElement.offsetLeft + 0.66)) /
      this.get('renderer').domElement.clientWidth) * 2 - 1;

    origin.y = -((evt.detail.clientY - (this.get('renderer').domElement.offsetTop + 0.665)) /
      this.get('renderer').domElement.clientHeight) * 2 + 1;

    const intersectedViewObj = this.get('raycaster').raycasting(null, origin,
      this.get('currentUser.camera'), this.get('raycastObjectsLandscape'));

    if (intersectedViewObj) {
      // Exclude floor and delete button
      if (intersectedViewObj.object.name === 'deleteButton' || intersectedViewObj.object.name === 'floor') {
        return;
      }

      const emberModel = intersectedViewObj.object.userData.model;

      if (!emberModel)
        return;

      const emberModelName = emberModel.constructor.modelName;

      if (emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "node" || emberModelName === "application") {
        this.get('hoverHandlerLandscape').showTooltip(mouse, emberModel);
      }
      else if (emberModelName === "package" || emberModelName === "clazz" || emberModelName === "component") {
        this.get('hoverHandlerApp3D').showTooltip(mouse, emberModel);
      }
    }
  },

  ////////// Helper functions //////////

  calculateIntersectedViewObject(controller, objects) {
    const controllerLine = controller.getObjectByName('controllerLine');
    const tempMatrix = new THREE.Matrix4();

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation(controllerLine.matrixWorld);

    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    if (!objects) {
      objects = this.excludeLandscape();
    }

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction,
      null, objects);

    return intersectedViewObj;
  },

  /*
   *  This method is used to darken the color of the systems, nodegroups and applications
   */
  highlightLandscape(emberModel, emberModelName, intersectedViewObj, id, darkerColor) {
    if (emberModelName === "nodegroup" || emberModelName === "system" || emberModelName === "application") {

      if (intersectedViewObj.object.type === "system" || intersectedViewObj.object.type === "nodegroup" || intersectedViewObj.object.type === "application") {

        let index = "text" + intersectedViewObj.object.type;

        let name;

        if (intersectedViewObj.object.type === "nodegroup") {
          index = "textnode";
          name = intersectedViewObj.object.userData.model.get('name');
        }
        else if (intersectedViewObj.object.type === "application") {
          index = "textapp";
          name = intersectedViewObj.object.userData.model.get('name');
        }
        else {
          name = emberModel.get('name');
        }

        // Change entity color 
        this.get('labeler').redrawLabel(intersectedViewObj.object,
          this.get('colorList')[index], name, darkerColor);

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
  unhighlightLandscape(id) {
    if (this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id].type && this.get('colorList')[this.get('highlightedEntities')[id].type]) {

      let entity = this.get('highlightedEntities')[id];
      let index = "text" + entity.type;

      // Identify enity
      if (entity.type === "nodegroup") {
        index = "textnode";
      }
      else if (entity.type === "application") {
        index = "textapp";
      }
      let name = entity.userData.model.get('name');

      // Reset the color of the mapped material
      this.get('labeler').redrawLabel(entity,
        this.get('colorList')[index], name, this.get('colorList')[entity.type]);

      this.get('highlightedEntities')[id] = null;
    }
  },

  /*
   *  This method is used to save the selected entity
   *  and the highlighted communication lines
   */
  saveSelectedEntity(intersectedViewObj, emberModel) {
    this.set('highlightedAppModel', intersectedViewObj.object.parent.userData.model);
    this.set('selectedEntitysMesh', intersectedViewObj.object);
    if (intersectedViewObj.object.userData.type === 'clazz') {
      this.set('selectedEntitysColor', new THREE.Color(this.get('colorListApp')[this.get('selectedEntitysMesh').userData.type]));
    }
    else {
      this.set('selectedEntitysColor', intersectedViewObj.object.userData.model.get('color'));
    }
  },

  /*
   *  This method is used to restore the color of
   *  a selected entity and to reset the highlighting of the
   *  communication lines
   */
  restoreSelectedEntity(id) {

    // Restore old color (clazz)
    if (this.get('selectedEntitysMesh').userData.type === 'clazz') {
      this.get('selectedEntitysMesh').material.color = new THREE.Color(this.get('colorListApp')[this.get('selectedEntitysMesh').userData.type]);
    }
    // Restore old color (package)
    else {
      this.get('selectedEntitysMesh').material.color = new THREE.Color(this.get('selectedEntitysColor'));
    }

    // Check if entity is highlighted by the other controller and change color
    if (this.get('highlightedEntitiesApp')[id] && this.get('selectedEntitysMesh') && this.get('highlightedEntitiesApp')[id] === this.get('selectedEntitysMesh')) {
      this.get('highlightedEntitiesApp')[id].material.color = new THREE.Color(Helper.calculateDarkerColor(this.get('selectedEntitysMesh')));
    }
  },

  /*
   *  This method is used to exclude a selected 'package' or
   *  'clazz' from unhighlighting
   */
  excludeSelectedEntity(controller, intersectedViewObj) {
    if (intersectedViewObj) {
      if (this.get('selectedEntitysMesh') && this.get('selectedEntitysMesh') === intersectedViewObj.object) {
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
  unhighlightApplication3D(id) {
    // Package highlihgted
    let condition1 = this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.model.get('color');
    // Clazz highlighted
    let condition2 = this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id].userData.type && this.get('colorListApp')[this.get('highlightedEntitiesApp')[id].userData.type];
    // No entity selected or selected one is not highlighted
    let condition3 = (!this.get('selectedEntitysMesh') || (this.get('highlightedEntitiesApp')[id] !== this.get('selectedEntitysMesh')));

    // Handle packages
    if (condition1 && condition3) {
      let originalColor = Helper.calculateLighterColor(this.get('highlightedEntitiesApp')[id]);
      this.get('highlightedEntitiesApp')[id].material.color = new THREE.Color(originalColor);
    }
    // Handle clazzes
    if (condition2 && condition3) {
      let originalColor = Helper.calculateLighterColor(this.get('highlightedEntitiesApp')[id]);
      this.get('highlightedEntitiesApp')[id].material.color = new THREE.Color(originalColor);
    }
    this.get('highlightedEntitiesApp')[id] = null;
  },

  /*
   *  This method is used to highlight the delete button
   */
  highlightDeleteButton(intersectedViewObj, id) {
    // Highlight if not highlighted
    if (!this.get('deleteButtonHighlighted')) {
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
  unhighlightedDeleteButton(id, additionalCondition) {
    if (this.get('openApps') && this.get('deleteButtonHighlighted') === id && additionalCondition) {
      this.get('openApps').forEach(app => {
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
  isEntityHighlighted(intersectedViewObj, controller, otherControllerId) {
    let id = controller.id;

    if (intersectedViewObj) {
      // Scale ray distance to distance of intersection
      controller.getObjectByName('controllerLine').scale.z = intersectedViewObj.distance;

      // Landscape or Application3D highlighted by first controller
      if ((this.get('highlightedEntities')[id] && this.get('highlightedEntities')[id] === intersectedViewObj.object) ||
        (this.get('highlightedEntitiesApp')[id] && this.get('highlightedEntitiesApp')[id] === intersectedViewObj.object)) {
        return true;
      }
      // Landscape or Application3D highlighted by second controller
      else if ((this.get('highlightedEntities')[otherControllerId] && this.get('highlightedEntities')[otherControllerId] === intersectedViewObj.object) ||
        (this.get('highlightedEntitiesApp')[otherControllerId] && this.get('highlightedEntitiesApp')[otherControllerId] === intersectedViewObj.object)) {
        return true;
      }
    }
  },

  /*
   *  This method is used to remove an application
   *  and to do all necessary clean up
   */
  deleteApplication3D(intersectedViewObj) {
    // Reset highlighting of delete buttonghlighting of delete button
    this.set('deleteButtonHighlighted', null);

    // Check if delete button was highlighted => restore unhighlighted material
    if (this.get('materialUnhighlighted')) {
      intersectedViewObj.object.material = this.get('materialUnhighlighted');
    }
    // Dispose highlighted material
    if (this.get('materialHighlighted')) {
      this.get('materialHighlighted').map.dispose();
      this.get('materialHighlighted').dispose();
    }
    // Remove application if delete button was hit
    if (intersectedViewObj.object.userData.appID && !this.get('boundApps').has(intersectedViewObj.object.userData.appID)) {
      this.trigger('removeApplication', intersectedViewObj.object.userData.appID);
    }
  },

  /*
   *  This method is used to update the matrix of
   *  a given Object3D
   */
  updateObjectMatrix(object) {
    if (object) {
      object.updateMatrix();
    }
  },

  /*
   *  This method is used to exclude the landscape from raycasting
   */
  excludeLandscape() {
    const raycastingObjects = [];
    this.get('raycastObjectsLandscape').forEach(function (entity) {
      if (entity.type !== "system" && entity.type !== "nodegroup" && entity.name !== "node" && entity.name !== "application") {
        raycastingObjects.push(entity);
      }
    });
    return raycastingObjects;
  }
});
