import Component from '@ember/component';
import Evented from '@ember/object/evented';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';
import $ from 'jquery';
import THREE from 'three';
import THREEPerformance from 'explorviz-frontend/utils/threejs-performance';
import Raycaster from '../utils/vr-rendering/raycaster';
import applyKlayLayout from 'explorviz-frontend/utils/landscape-rendering/klay-layouter';
import Interaction from '../utils/vr-rendering/interaction';
import Labeler from '../utils/vr-rendering/labeler';
import LabelerApp from 'explorviz-frontend/utils/application-rendering/labeler';
import CalcCenterAndZoom from 'explorviz-frontend/utils/landscape-rendering/center-and-zoom-calculator';
import ImageLoader from 'explorviz-frontend/utils/three-image-loader';
import applyCityLayout from 'explorviz-frontend/utils/application-rendering/city-layouter';
import FoundationBuilder from 'explorviz-frontend/utils/application-rendering/foundation-builder';
import layout from '../templates/components/vr-rendering';
import Models from '../utils/models';
import debugLogger from 'ember-debug-logger';

// Declare globals
/*global VRButton*/
/*global Controller*/

/**
 * This component unites landscape(adapted to 3D)-, application-rendering
 * and rendering-core from which many function are taken over.
 * This component contains listeners waiting for events from the controller. 
 * For this reason some services are injected (reloadHandler, ..)
 * The corresponding functions are not implemented yet (in VR) but could be 
 * good templates fo future work.  
 *
 * @class VR-Rendering
 * @extends Component
 */
export default Component.extend(Evented, {

  // No Ember generated container
  tagName: '',

  debug: debugLogger(),

  store: service(),
  landscapeListener: service(),
  reloadHandler: service(),
  landscapeRepo: service('repos/landscape-repository'),
  renderingService: service(),
  currentUser: service(),
  configuration: service(),
  world: service(),
  localUser: service('user'),
  menus: service(),

  threePerformance: null,
  showFpsCounter: null,

  listeners: null,

  webglrenderer: null, // Renders the scene
  canvas: null, // Canvas of webglrenderer
  font: null, // Font used for text
  initDone: false, // Tells if initRendering() already terminated
  raycaster: null, // Raycaster for intersection checking (used in interaction)
  labeler: null, // For labeling landscape (-> frontend)
  labelerApp: null, // For labeling applications (-> frontend)
  imageLoader: null, // For loading images e.g. of 'world system'
  centerAndZoomCalculator: null, // Frontend: CalcCenterAndZoom
  initialRendering: true, // Handle initial rendering in populateScene()
  requestMaterial: null, // Material for e.g. 'earth'
  foundationBuilder: null, // Imported from frontend
  zeroValue: 0.0000000000000001 * 0.0000000000000001, // Tiny number e.g. to emulate a plane with depth zeroValue

  // VR
  vrLandscape: null, // Contains systems and their children
  vrCommunications: null, // Contains communication between elements of landscape
  geometry: null, // Ray for controller
  depth: 0.2, // Depth value for systems/nodegroups etc. (2D rectangles -> 3D cubes)
  room: null, // Virtual room to which a flooar is added, important for raycasting
  initialPositions: {}, // Initial positions of systems/nodegroups/..
  deleteButton: null, // Delete Button of 3d application
  teleportArea: null, // Storage for mesh data

  // Application
  openApps: null, // Object3d's of opened applications
  foundations: null, // Keep track of foundations (in openApps) for foundationBuilder
  boundApps: null, // Applications which other users currently move/hold

  layout: layout, // Links template to component

  didRender() {
    this._super(...arguments);
    this.initRendering();
    this.initListener();
  },

  // An Observer calculating the new raycastObjects
  actualizeRaycastObjects() {
    let result = (this.get('vrLandscape')) ? this.get('vrLandscape').children : [];
    const allowedObjects = ['node', 'system', 'nodegroup', 'application', 'applicationcommunication'
      , 'drawableclazzcommunication', 'floor', 'component', 'clazz', 'deleteButton'];

    this.get('openApps').forEach(function (app) {
      app.children.forEach(function (child) {
        child.userData.object3D = app;
      });
      result = result.concat(app.children);
    });

    result = (this.get('room')) ? result.concat(this.get('room').children) : result;

    result = filterResult(result);

    this.set('world.interaction.raycastObjectsLandscape', result);

    function filterResult(result) {

      let help = result.filter(function (obj) {
        if (obj.userData.model) {
          const modelName = obj.userData.model.constructor.modelName;
          return allowedObjects.includes(modelName);
        }
        else if (obj.userData.name) {
          const modelName = obj.userData.name;
          return allowedObjects.includes(modelName);
        }
        else {
          return false;
        }
      });
      return help;
    }
  },

  willDestroyElement() {
    this.cleanup();
    this._super(...arguments);
  },

  /**
   * This function is called once on the didRender event. 
   * Its used to setup initial values, utils and the basic
   * elements (for example meshes or lights) for the VR environment.
   *
   * @method initRendering
   */
  initRendering() {
    this.debug("init vr rendering");
    // Dummy object for raycasting
    this.set('room', new THREE.Object3D());
    this.get('room').name = 'room';
    this.get('room').matrixAutoUpdate = false;

    this.set('vrLandscape', new THREE.Group());
    this.get('vrLandscape').name = 'landscape';
    this.get('vrLandscape').renderOrder = 2;

    this.set('vrCommunications', new THREE.Group());
    this.get('vrCommunications').name = 'vrCommunications';
    this.get('vrCommunications').renderOrder = 1;

    this.set('world.vrEnvironment', new THREE.Object3D());
    this.get('world.vrEnvironment').name = 'landscape';
    this.get('world.vrEnvironment').add(this.get('vrCommunications'));
    this.get('world.vrEnvironment').add(this.get('vrLandscape'));

    this.set('world.environmentOffset', new THREE.Vector3(0, 0, 0));

    this.get('world.vrEnvironment').matrixAutoUpdate = false;
    this.get('vrLandscape').matrixAutoUpdate = false;
    this.get('vrCommunications').matrixAutoUpdate = false;

    // Rotate landscape by 90 degrees (radiant)
    this.get('world.vrEnvironment').rotateX(-1.5707963);
    this.get('world.vrEnvironment').updateMatrix();

    // Remove stored applications
    this.set('landscapeRepo.latestApplication', null);

    // Get size of outer ember div
    const height = $('#vizContainer').height();
    const width = $('#vizContainer').width();

    const canvas = $('#threeCanvas')[0];

    this.set('canvas', canvas);

    this.set('world.scene', new THREE.Scene());
    this.set('world.scene.background', new THREE.Color(0xeaf4fc));

    this.set('localUser.camera', new THREE.PerspectiveCamera(70, width / height, 0.01, 50));
    this.get('localUser.camera').name = 'camera';

    // Create and configure renderer
    this.set('webglrenderer', new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas
    }));
    this.get('webglrenderer').setPixelRatio(window.devicePixelRatio);
    this.get('webglrenderer').setSize(width, height);

    this.get('webglrenderer').shadowMap.enabled = true;
    this.get('webglrenderer').gammaInput = true;
    this.get('webglrenderer').gammaOutput = true;

    this.set('showFpsCounter', this.get('currentUser').getPreferenceOrDefaultValue('flagsetting', 'showFpsCounter'));

    if (this.get('showFpsCounter')) {
      this.threePerformance = new THREEPerformance();
    }

    // Add VR button if it does not exist and enable VR rendering
    if($('#vrButton').length == 0) {
      $('#vizContainer').append("<div id='vrButton'></div>");
    }
    $('#vrButton').append(VRButton.createButton(this.get('webglrenderer')));

    this.get('webglrenderer').vr.enabled = true;

    // Create left controller
    this.set('localUser.controller1', new Controller(0));
    this.set('localUser.controller1.standingMatrix', this.get('webglrenderer').vr.getStandingMatrix())
    this.get('localUser.controller1').name = 'controller1';

    // Create right controller
    this.set('localUser.controller2', new Controller(1));
    this.set('localUser.controller2.standingMatrix', this.get('webglrenderer').vr.getStandingMatrix())
    this.get('localUser.controller2').name = 'controller2';

    this.set('localUser.threeGroup', new THREE.Group());
    this.get('world.scene').add(this.get('localUser.threeGroup'));
    this.get('localUser.threeGroup').add(this.get('localUser.camera'));
    this.get('localUser.threeGroup').add(this.get('localUser.controller1'));
    this.get('localUser.threeGroup').add(this.get('localUser.controller2'));

    // Ray for Controller
    this.set('geometry', new THREE.Geometry());
    this.get('geometry').vertices.push(new THREE.Vector3(0, 0, 0));
    this.get('geometry').vertices.push(new THREE.Vector3(0, 0, -1));

    // Create black ray for left controller
    let line1 = new THREE.Line(this.get('geometry'));
    line1.name = 'controllerLine';
    line1.scale.z = 5;
    line1.material.color = new THREE.Color('rgb(0,0,0)');
    line1.material.opacity = 0.25;
    line1.position.y -= 0.005;
    line1.position.z -= 0.02;

    // Create green ray for right controller
    let line2 = new THREE.Line(this.get('geometry'));
    line2.name = 'controllerLine';
    line2.scale.z = 5;
    line2.material.color = new THREE.Color('rgb(0,204,51)');
    line2.material.opacity = 0.25;
    line2.position.y -= 0.005;
    line2.position.z -= 0.02;

    // Add rays to controllers
    this.get('localUser.controller1').add(line1);
    this.get('localUser.controller2').add(line2);
    this.get('world.scene').add(this.get('world.vrEnvironment'));

    this.get('room').position.y -= 0.1;
    this.get('room').updateMatrix();

    // Load image for requests
    let requestTexture = new THREE.TextureLoader().load('images/logos/requests.png');
    let requestMaterial = new THREE.MeshPhongMaterial({
      map: requestTexture
    });
    this.set('requestMaterial', requestMaterial);

    this.set('openApps', new Map());
    this.set('foundations', new Map());
    this.set('boundApps', new Set());

    // Load image for delete button
    this.set('deleteButtonTexture', new THREE.TextureLoader().load('images/x_white_transp.png'));

    ////////////////////

    this.onReSetupScene = function () {
      this.set('centerAndZoomCalculator.centerPoint', null);
      this.populateScene();
    };

    this.onResizeCanvas = function () {
      const height = Math.round($('#vizContainer').height());
      const width = Math.round($('#vizContainer').width());

      $("#threeCanvas").height(height);
      $("#threeCanvas").width(width);
    };

    this.onUpdated = function () {
      if (this.get('initDone')) {
        this.populateScene();
      }
    };

    if (!this.get('world.interaction')) {
      this.set('world.interaction', Interaction.create(getOwner(this).ownerInjection()));
    }

    if (!this.get('imageLoader')) {
      this.set('imageLoader', ImageLoader.create(getOwner(this).ownerInjection()));
    }

    if (!this.get('labeler')) {
      this.set('labeler', Labeler.create(getOwner(this).ownerInjection()));
    }

    if (!this.get('labelerApp')) {
      this.set('labelerApp', LabelerApp.create(getOwner(this).ownerInjection()));
    }

    if (!this.get('raycaster')) {
      this.set('raycaster', Raycaster.create(getOwner(this).ownerInjection()));
    }

    if (!this.get('foundationBuilder')) {
      this.set('foundationBuilder', FoundationBuilder.create(getOwner(this).ownerInjection()));
    }

    if (!this.get('centerAndZoomCalculator')) {
      this.set('centerAndZoomCalculator', CalcCenterAndZoom.create(getOwner(this).ownerInjection()));
    }

    this.initInteraction();

    this.initWorldListener();

    // Set default model
    this.set('imageLoader.logos', {});
    this.set('labeler.textLabels', {});
    this.set('labeler.systemTextCache', []);
    this.set('labeler.nodeTextCache', []);
    this.set('labeler.appTextCache', []);
    this.set('centerAndZoomCalculator.centerPoint', null);

    // Create floor
    /**
     * Floor texture by
     * Author: V.Hartikainen
     * License: https://creativecommons.org/licenses/by/3.0/
     * Title: Seamless Dark Texture With Small Grid
     * Source: https://tiled-bg.blogspot.com/2014/08/seamless-dark-texture-with-small-grid.html
     */
    let floorTexture = new THREE.TextureLoader().load('images/materials/floor.jpg');
    floorTexture.wrapS = THREE.MirroredRepeatWrapping;
    floorTexture.wrapT = THREE.MirroredRepeatWrapping;
    floorTexture.repeat.set(30, 25);

    let floorGeometry = new THREE.BoxGeometry(30, this.get('zeroValue'), 25);
    let floorMaterial = new THREE.MeshLambertMaterial({
      map: floorTexture
    });
    let floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.receiveShadow = true;
    floorMesh.name = 'floor';
    floorMesh.userData.name = 'floor';
    this.get('room').add(floorMesh);
    this.get('world.scene').add(this.get('room'));///// End floor

    // Add lights
    this.get('world.scene').add(new THREE.HemisphereLight(0x888877, 0x777788, 0.5));
    let light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 6, 0);
    light.castShadow = true;
    light.shadow.camera.top = 2;
    light.shadow.camera.bottom = -2;
    light.shadow.camera.right = 2;
    light.shadow.camera.left = -2;
    light.shadow.mapSize.set(4096, 4096);
    this.get('world.scene').add(light);

    Models.loadModels();

    this.get('landscapeListener').initSSE();

    // Load font for labels and synchronously proceed with populating the scene
    new THREE.FontLoader()
      .load('three.js/fonts/roboto_mono_bold_typeface.json', (font) => {
        this.set('font', font);
        this.set('initDone', true);
        this.populateScene();
      });
  },

  updateControllers() {
    if (!Models.areLoaded())
      return;

    this.get('localUser.controller1').update();
    this.get('localUser.controller2').update();

    // Remove controller 1 model if controller disconnected
    if (!this.get('localUser.controller1').getGamepad() || !this.get('localUser.controller1').getGamepad().pose) {
      let model = this.get('localUser.controller1').getObjectByName('controllerTexture');
      if (model) {
        this.get('localUser.controller1').remove(model);
      }
    } else {
      this.loadController(this.get('localUser.controller1'));
    }
    if (!this.get('localUser.controller2').getGamepad() || !this.get('localUser.controller2').getGamepad().pose) {
      let model = this.get('localUser.controller2').getObjectByName('controllerTexture');
      if (model) {
        this.get('localUser.controller2').remove(model);
      }
    } else {
      this.loadController(this.get('localUser.controller2'));
    }


    // Check raycast for intersection
    if (this.get('world.interaction')) {
      // Only if no application3D binded on controller
      if (this.get('localUser.controller1').userData.selected === undefined) {
        this.get('world.interaction').checkIntersectionSecondaryController();
      }
      if (this.get('localUser.controller2').userData.selected === undefined) {
        this.get('world.interaction').checkIntersectionPrimaryController();
      }
    }
  },

  loadController(controller) {
    if (controller.getGamepad() !== undefined && controller.getGamepad().pose !== undefined
      && !controller.getObjectByName('controllerTexture')) {

      let name = controller.getGamepad().id;

      if (name === 'Oculus Touch (Left)') {
        controller.add(Models.getOculusLeftControllerModel());
      } else if (name === 'Oculus Touch (Right)') {
        controller.add(Models.getOculusRightControllerModel());
      } else {
        controller.add(Models.getViveControllerModel());
      }
    }
  },

  /*
   * This method is used to listen for events triggered Controller.
   * The corresponding functionalities are not yet implemented in VR.
   * But they can used as templates in the future.
   */
  initListener() {

    this.set('listeners', new Set());

    this.get('listeners').add([
      'renderingService',
      'reSetupScene',
      () => {
        this.onReSetupScene();
      }
    ]);

    this.get('listeners').add([
      'renderingService',
      'resizeCanvas',
      () => {
        this.updateCanvasSize();
      }
    ]);

    this.get('listeners').add([
      'landscapeRepo',
      'updated',
      () => {
        this.onUpdated();
      }
    ]);

    this.get('listeners').add([
      'world.interaction',
      'redrawScene',
      () => {
        this.populateScene();
      }
    ]);

    this.get('listeners').add([
      'world.interaction',
      'centerVREnvironment',
      () => {
        this.get('world').centerVREnvironment();
      }
    ]);

    this.get('listeners').add([
      'world.interaction',
      'redrawApp',
      (appID) => {
        this.redrawApplication(appID);
      }
    ]);

    // start subscriptions
    this.get('listeners').forEach(([service, event, listenerFunction]) => {
        this.get(service).on(event, listenerFunction);
    });
  },

  /**
   * This function is called when the willDestroyElement event is fired
   * (for example while switching tabs). 
   * Its used to turn off listeners and reset intial values
   * @method cleanup
   */
  cleanup() {

    this.debug("cleanup vr rendering");
    // Stop rendering
    this.get('webglrenderer').vr.setDevice(null);
    this.get('webglrenderer').dispose();

    // unsubscribe from all services
    this.get('listeners').forEach(([service, event, listenerFunction]) => {
      this.get(service).off(event, listenerFunction);
    });
    this.set('listeners', null);

    if(this.get('threePerformance')) {
      this.threePerformance.removePerformanceMeasurement();
    }

    /// TODO removing event handlers needs to be fixed

    // this.get('world.interaction').off('showApplication');
    // this.get('world.interaction').off('removeApplication');
    // this.get('world.interaction').off('showTeleportArea');
    // this.get('world.interaction').off('removeTeleportArea');
    this.get('world.interaction').removeHandlers();

    this.get('localUser').reset();
    this.get('world').reset();

    this.set('webglrenderer', null);

    this.set('imageLoader.logos', {});
    this.set('labeler.textLabels', {});
    this.set('labeler.textCache', []);

    const emberLandscape = this.get('landscapeRepo.replayLandscape');

    // Open all systems for 2D visualization and restore z-position
    if (emberLandscape) {
      emberLandscape.get('systems').forEach((system) => {
        system.setOpened(true);
        system.set('positionZ', this.get('initialPositions')[system.get('id')]);

        const nodegroups = system.get('nodegroups');
        nodegroups.forEach((nodegroup) => {
          nodegroup.set('positionZ', this.get('initialPositions')[nodegroup.get('id')]);

          const nodes = nodegroup.get('nodes');
          nodes.forEach((node) => {
            node.set('positionZ', this.get('initialPositions')[node.get('id')]);

            const applications = node.get('applications');
            applications.forEach((application) => {
              application.set('positionZ', this.get('initialPositions')[application.get('id')]);
            });
          });
        });
      });
      this.set('initialRendering', true);
    }

    this.get('openApps').forEach((app) => {
      // Remove foundation for re-rendering
      this.removeFoundation(app.id, this.get('store'));
      this.set('landscapeRepo.latestApplication', null);
    });

    // Clean up Webgl contexts
    let gl = this.get('canvas').getContext('webgl');
    gl.getExtension('WEBGL_lose_context').loseContext();

    // Remove enter vr button
    document.getElementById('vrButton').remove();
  },

  /**
   * This function is used to build and update the landscape(3D). 
   * The meshes are created first and the old ones
   * are deleted afterwards.
   * The function is called once in initRendering and every time 
   * the util interaction triggers the event 'redrawScene'.
   *
   * @method populateScene
   */
  populateScene() {
    const self = this;
    let landscapeMeshes = [];
    let communicationMeshes = [];

    const emberLandscape = this.get('landscapeRepo.replayLandscape');

    if (!emberLandscape || !this.get('font')) {
      return;
    }

    /* - Close all systems
     *  - set new depth value for systems, nodegroups, nodes and applications 
     *  - save z-posiitons to restore initial state
     */
    if (emberLandscape) {
      if (this.get('initialRendering')) {
        emberLandscape.get('systems').forEach(function (system) {
          system.setOpened(false);
          self.get('initialPositions')[system.get('id')] = system.get('positionZ');
          system.set('depth', self.get('depth'));

          const nodegroups = system.get('nodegroups');
          nodegroups.forEach(function (nodegroup) {
            self.get('initialPositions')[nodegroup.get('id')] = nodegroup.get('positionZ');
            nodegroup.set('depth', self.get('depth'));

            const nodes = nodegroup.get('nodes');
            nodes.forEach(function (node) {
              self.get('initialPositions')[node.get('id')] = node.get('positionZ');
              node.set('depth', self.get('depth'));

              const applications = node.get('applications');
              applications.forEach(function (application) {
                self.get('initialPositions')[application.get('id')] = application.get('positionZ');
                application.set('depth', 0);
              });
            });
          });
        });
        this.set('initialRendering', false);
      }
    }

    // Layout landscape
    applyKlayLayout(emberLandscape);

    this.set('world.vrEnvironment.userData.model', emberLandscape);

    const systems = emberLandscape.get('systems');
    const scaleFactor = {
      width: 0.5,
      height: 0.5
    };

    let isRequestObject = false;
    let centerPoint;

    if (systems) {
      // TODO: Compute the amount of requests for every id
      let allRequests = null; //computeRequests(emberLandscape.get('outgoingApplicationCommunications'));

      // Calculate new center and update zoom
      if (!this.get('centerAndZoomCalculator.centerPoint')) {
        this.get('centerAndZoomCalculator').calculateLandscapeCenterAndZZoom(emberLandscape,
          this.get('webglrenderer'));
      }
      centerPoint = this.get('centerAndZoomCalculator.centerPoint');

      // Create landscape
      systems.forEach(function (system) {
        isRequestObject = false;

        let extensionX, extensionY, centerX, centerYClosed, centerYOpened;

        // Create earth
        if (!isRequestObject && system.get('name') === 'Requests') {
          isRequestObject = true;

          // Add earth
          extensionX = system.get('width') * scaleFactor.width;
          extensionY = system.get('height') * scaleFactor.height;

          centerX = system.get('positionX') + extensionX - centerPoint.x;
          centerYClosed = system.get('positionY') - extensionY - centerPoint.y;
          centerYOpened = system.get('positionY') - extensionY - centerPoint.y;

          // Create mesh for earth
          let requestGeometry = new THREE.SphereGeometry(0.1, 32, 32);
          let requests = new THREE.Mesh(requestGeometry, self.get('requestMaterial'));
          requests.name = 'earth';
          requests.position.set(centerX, centerYClosed, system.get('positionZ'));

          // Scale requests
          requests.scale.x = requests.scale.x / self.get('world.vrEnvironment').scale.x;

          landscapeMeshes.push(requests);
        }

        // Create systems
        if (!isRequestObject) {
          extensionX = system.get('width') * scaleFactor.width;
          extensionY = system.get('height') * scaleFactor.height;

          centerX = system.get('positionX') + extensionX - centerPoint.x;
          centerYClosed = system.get('positionY') - extensionY - centerPoint.y;
          centerYOpened = system.get('positionY') - extensionY - centerPoint.y;

          // Save old depth
          let oldSystemDepth = system.get('depth');

          // Calculate system depth (height) depending on the amount of traget requests
          if (allRequests && allRequests[system.get('id')]) {
            system.set('depth', assignDepth(allRequests[system.get('id')]));
          }

          // Draw box for closed and plane for opened systems
          let systemMesh;
          if (system.get('opened')) {
            systemMesh = createPlane(system);
            systemMesh.name = 'systemOpened';
            // Transform z-position of closed system to opened system 
            systemMesh.position.set(centerX, centerYOpened,
              system.get('positionZ') - system.get('depth') / 2);
          }
          else {
            // New depth only influences closed boxes
            let diffSystemDepth = system.get('depth') - oldSystemDepth;
            systemMesh = createBox(system);
            systemMesh.name = 'systemClosed';
            // Store new position
            system.set('positionZ', system.get('positionZ') + diffSystemDepth / 2);

            // Set new position for box
            systemMesh.position.set(centerX, centerYClosed, system.get('positionZ'));
          }

          // Add mesh
          systemMesh.type = 'system';
          landscapeMeshes.push(systemMesh);
          system.set('threeJSModel', systemMesh);

          // Create text labels for systems
          const textColor =
            self.get('configuration.landscapeColors.systemText');
          let emberModelName = system.constructor.modelName;
          let boxColor = self.get('configuration.landscapeColors.' + emberModelName);
          self.get('labeler').saveTextForLabeling(null, systemMesh, textColor, boxColor);
        }

        const nodegroups = system.get('nodegroups');

        // Draw nodegroups 
        nodegroups.forEach(function (nodegroup) {
          if (!nodegroup.get('visible')) {
            return;
          }
          const nodes = nodegroup.get('nodes');

          let nodegroupMesh;

          // Add box for nodegroup if it contains more than one node
          if (nodes.content.length > 1) {
            if (!isRequestObject) {
              extensionX = nodegroup.get('width') * scaleFactor.width;
              extensionY = nodegroup.get('height') * scaleFactor.height;

              centerX = nodegroup.get('positionX') + extensionX - centerPoint.x;
              centerYOpened = nodegroup.get('positionY') - extensionY - centerPoint.y;
              centerYClosed = nodegroup.get('positionY') - extensionY - centerPoint.y;

              // Save old depth
              let oldNodegroupDepth = nodegroup.get('depth');

              /* Calculate depth (height) for nodegroups relative to the 
              amount of traget requests */
              if (allRequests && allRequests[nodegroup.get('id')]) {
                nodegroup.set('depth', assignDepth(allRequests[nodegroup.get('id')]));
              }

              // Calculate difference of depths
              let diffNodegroupDepth = nodegroup.get('depth') - oldNodegroupDepth;

              // Create box for opened nodegroup
              if (nodegroup.get('opened')) {
                nodegroupMesh = createPlane(nodegroup);
                nodegroupMesh.name = 'nodegroupOpened';
                // Transform z-position of closed system to opened system 
                nodegroupMesh.position.set(centerX, centerYOpened,
                  nodegroup.get('positionZ') - nodegroup.get('depth') / 2 + 0.001);
              }
              // Create box for closed nodegroup
              else {
                nodegroupMesh = createBox(nodegroup);
                nodegroupMesh.name = 'nodegroupClosed';
                // Store new position
                nodegroup.set('positionZ', nodegroup.get('positionZ') + diffNodegroupDepth / 2);

                // Set new position with offset for new depth
                nodegroupMesh.position.set(centerX, centerYOpened, nodegroup.get('positionZ') + 0.001);
              }

              nodegroupMesh.type = 'nodegroup';

              // Add mesh
              landscapeMeshes.push(nodegroupMesh);
              nodegroup.set('threeJSModel', nodegroupMesh);
            }
          }

          // Draw nodes  
          nodes.forEach(function (node) {
            if (nodes.content.length === 1 || nodegroup.get('opened')) {

              if (!node.get('visible')) {
                return;
              }

              // Save old depth
              let oldNodeDepth = nodegroup.get('depth');

              // Set nodegroup depth relative to the amount of traget requests
              if (allRequests && allRequests[node.get('id')]) {
                node.set('depth', assignDepth(allRequests[node.get('id')]));
              }

              // Calculate difference of depths
              let diffNodeDepth = node.get('depth') - oldNodeDepth;

              extensionX = node.get('width') * scaleFactor.width;
              extensionY = node.get('height') * scaleFactor.height;

              centerX = node.get('positionX') + extensionX - centerPoint.x;
              centerYOpened = node.get('positionY') - extensionY - centerPoint.y;

              // Draw Box for node 
              let nodeMesh = createBox(node);
              nodeMesh.type = 'application';
              nodeMesh.name = 'node';

              // Get parent position and store new position
              node.set('positionZ', node.get('parent').get('positionZ') + diffNodeDepth / 2);

              nodeMesh.position.set(centerX, centerYOpened, node.get('positionZ') + 0.002);

              landscapeMeshes.push(nodeMesh);
              node.set('threeJSModel', nodeMesh);

              // Create text labels 
              let textColor = self.get('configuration.landscapeColors.nodeText');
              let emberModelName = node.constructor.modelName;
              let boxColor = self.get('configuration.landscapeColors.' + emberModelName);
              self.get('labeler').saveTextForLabeling(node.getDisplayName(),
                nodeMesh, textColor, boxColor);

              const applications = node.get('applications');

              // Draw applications
              applications.forEach(function (application) {
                extensionX = application.get('width') * scaleFactor.width;
                extensionY = application.get('height') * scaleFactor.width;

                centerX = application.get('positionX') + extensionX - centerPoint.x;
                centerYOpened = application.get('positionY') - extensionY - centerPoint.y;

                // Draw application in landscape(3D)-view 
                if (!isRequestObject) {
                  let applicationMesh = createBox(application);

                  applicationMesh.type = 'application';
                  applicationMesh.name = 'application';

                  applicationMesh.position.set(centerX, centerYOpened,
                    node.get('positionZ') + nodeMesh.geometry.parameters.depth / 2 + 0.003);

                  landscapeMeshes.push(applicationMesh);
                  application.set('threeJSModel', applicationMesh);

                  // Create logos 
                  applicationMesh.geometry.computeBoundingBox();

                  const logoSize = {
                    width: 0.4,
                    height: 0.4
                  };
                  const appBBox = applicationMesh.geometry.boundingBox;
                  const logoPos = {
                    x: 0,
                    y: 0,
                    z: 0
                  };

                  const logoRightPadding = logoSize.width * 0.7;
                  logoPos.x = appBBox.max.x - logoRightPadding;

                  const texturePartialPath = application.get('database') ?
                    'database2' : application.get('programmingLanguage')
                      .toLowerCase();

                  self.get('imageLoader').createPicture(logoPos.x, logoPos.y,
                    logoPos.z + 0.001, logoSize.width, logoSize.height,
                    texturePartialPath, applicationMesh, 'logo');

                  // Create text labels 
                  let textColor =
                    self.get('configuration.landscapeColors.applicationText');

                  let emberModelName = application.constructor.modelName;
                  let boxColor = self.get('configuration.landscapeColors.' + emberModelName);

                  self.get('labeler').saveTextForLabeling(null, applicationMesh,
                    textColor, boxColor);
                }
              });
            }
            // Closed nodegroup => dont draw nodes+applications, just add text label
            else {
              let textColor = self.get('configuration.landscapeColors.applicationText');
              let emberModelName = nodegroup.constructor.modelName;
              let boxColor = self.get('configuration.landscapeColors.' + emberModelName);

              textColor = self.get('configuration.landscapeColors.nodeText');
              self.get('labeler').saveTextForLabeling(node.getDisplayName(),
                nodegroupMesh, textColor, boxColor);
            }
          });
        });
      });
    } // END if(systems)

    self.set('configuration.landscapeColors.textchanged', true);

    const appCommunications = emberLandscape.get('totalApplicationCommunications');
    const tiles = [];
    let tile;

    // Draw communication lines
    if (appCommunications) {
      let color = self.get('configuration.landscapeColors.communication');

      appCommunications.forEach((communication) => {
        // Calculate communication points
        const points = communication.get('points');

        if (points.length > 0) {
          for (let i = 1; i < points.length; i++) {
            const lastPoint = points[i - 1];
            const thisPoint = points[i];

            let tileWay = {
              startPoint: lastPoint,
              endPoint: thisPoint
            };

            let id = tiles.findIndex(isSameTile, tileWay);

            if (id !== -1) {
              tile = tiles[id];
            } else {
              id = tiles.length; // Gets a new index

              tile = {
                startPoint: lastPoint,
                endPoint: thisPoint,
                positionZ: 0.0025,
                requestsCache: 0,
                communications: [],
                pipeColor: new THREE.Color(color)
              };

              tiles.push(tile);
            }

            tile.communications.push(appCommunications);
            tile.requestsCache = tile.requestsCache +
              communication.get('requests');

            tiles[id] = tile;
          }
        }
      });
      // Draw lines
      addCommunicationLineDrawing(tiles, communicationMeshes);
    }

    /*
     * The landscape(3D) will be deleted an rewritten
     * It consists of vrCommunications and vrLandscape */
    // Delete and redraw communication lines
    this.removeChildren(this.get('vrCommunications'));
    this.get('vrCommunications').updateMatrix();

    communicationMeshes.forEach(function (mesh) {
      this.get('vrCommunications').add(mesh);
    }.bind(this));
    this.get('vrCommunications').updateMatrix();

    // Delete and redraw landscape(boxes) lines
    this.removeChildren(this.get('vrLandscape'));
    this.get('vrLandscape').updateMatrix();

    landscapeMeshes.forEach(function (mesh) {
      this.get('vrLandscape').add(mesh);
    }.bind(this));
    this.get('vrLandscape').updateMatrix();

    // Scale landscape(3D)
    this.get('world.vrEnvironment').updateMatrix();
    scaleVREnvironment(this.get('world.vrEnvironment'), this.get('room'));
    this.get('world.vrEnvironment').updateMatrix();

    // Center landscape(3D) on the floor 
    this.get('world').centerVREnvironment();
    this.get('world.vrEnvironment').updateMatrix();
    this.actualizeRaycastObjects();


    // Helper functions //

    /*
     *  This function is used to calculate the depth for 
     *  entities depending on the amount of requests
     */
    function assignDepth(requests) {
      switch (true) {
        case (requests <= 100):
          return 0.2;

        case (requests <= 200):
          return 0.25;

        case (requests <= 500):
          return 0.3;

        case (requests <= 1000):
          return 0.35;

        case (requests <= 2000):
          return 0.4;

        case (requests <= 5000):
          return 0.45;

        case (requests <= 10000):
          return 0.5;

        case (requests <= 20000):
          return 0.55;

        case (requests <= 50000):
          return 0.6;

        case (requests <= 100000):
          return 0.65;

        case (requests <= 200000):
          return 0.7;

        case (requests <= 500000):
          return 0.75;

        case (requests <= 1000000):
          return 0.8;

        default:
          return 0.2;
      }
    }

    /* 
     *  This function is used to resize
     *  the landscape(3D) so it fits on the floor
     */
    function scaleVREnvironment(vrEnvironment, floor) {
      // Save rotation
      let tempRotation = new THREE.Vector3();
      tempRotation.set(vrEnvironment.rotation.x, vrEnvironment.rotation.y, vrEnvironment.rotation.z);

      // Reset rotation to default value for scaling 
      vrEnvironment.rotation.set(-1.5707963000000003, 0, 0);
      vrEnvironment.updateMatrix();

      // Compute bounding box of the floor and landscape
      const bboxFloor = new THREE.Box3().setFromObject(floor);
      const bboxLandscape = new THREE.Box3().setFromObject(vrEnvironment);

      let floorSize = new THREE.Vector3();
      bboxFloor.getSize(floorSize);
      let landscapeSize = new THREE.Vector3();
      bboxLandscape.getSize(landscapeSize);

      // Scale x
      vrEnvironment.scale.x = 0.12;

      // Scale z
      vrEnvironment.scale.y = 0.18;

      let requests = vrEnvironment.getObjectByName('earth');

      // Check if 'earth' exists in landscape and scale it
      if (requests) {
        // Undo scaling requests
        requests.scale.x = 9;
        requests.scale.y = 6;
      }

      // Restore rotation
      vrEnvironment.rotation.set(tempRotation.x, tempRotation.y, tempRotation.z);
      vrEnvironment.updateMatrix();
    }

    // This function is only neccessary to find the right index
    function isSameTile(tile) {
      return checkEqualityOfPoints(this.endPoint, tile.endPoint) &&
        checkEqualityOfPoints(this.startPoint, tile.startPoint);
    }

    /*
     *  This function is used to add the communications lines
     *  to the landscape(3D)
     */
    function addCommunicationLineDrawing(tiles, meshes) {
      const requestsList = {};

      tiles.forEach((tile) => {
        requestsList[tile.requestsCache] = 0;
      });

      const categories = getCategories(requestsList, true);

      for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        tile.lineThickness = (0.07 * categories[tile.requestsCache] + 0.1) * 0.07;
      }

      for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        createLine(tile, meshes);
      }

      function getCategories(list, linear) {
        if (linear) {
          useLinear(list);
        } else {
          useThreshholds(list);
        }
        return list;

        // Inner helper functions

        function useThreshholds(list) {
          let max = 1;

          for (let request in list) {
            request = parseInt(request);
            max = (request > max) ? request : max;
          }

          const oneStep = max / 3.0;

          const t1 = oneStep;
          const t2 = oneStep * 2;

          for (let request in list) {
            let categoryValue = getCategoryFromValues(request, t1, t2);
            list[request] = categoryValue;
          }

        }

        function getCategoryFromValues(value, t1, t2) {
          value = parseInt(value);
          if (value === 0) {
            return 0.0;
          } else if (value === 1) {
            return 1.0;
          }

          if (value <= t1) {
            return 2.0;
          } else if (value <= t2) {
            return 3.0;
          } else {
            return 4.0;
          }
        }

        function useLinear(list) {
          let max = 1;
          let secondMax = 1;

          for (let request in list) {
            request = parseInt(request);
            secondMax = (request > max) ? max : secondMax;
            max = (request > max) ? request : max;
          }
          const oneStep = secondMax / 4.0;
          const t1 = oneStep;
          const t2 = oneStep * 2;
          const t3 = oneStep * 3;

          for (let requests in list) {
            let categoryValue = getCategoryFromLinearValues(requests, t1, t2,
              t3);
            list[requests] = categoryValue;
          }
        }

        function getCategoryFromLinearValues(value, t1, t2, t3) {
          value = parseInt(value);
          if (value <= 0) {
            return 0;
          } else if (value <= t1) {
            return 1.5;
          } else if (value <= t2) {
            return 2.5;
          } else if (value <= t3) {
            return 4.0;
          } else {
            return 6.5;
          }
        }

      } // END getCategories
    } // END addCommunicationLineDrawing


    function checkEqualityOfPoints(p1, p2) {
      let x = Math.abs(p1.x - p2.x) <= 0.01;
      let y = Math.abs(p1.y - p2.y) <= 0.01;

      return (x && y);
    }

    /*
     * This function is used to create the lines for th communication
     */
    function createLine(tile, parent) {
      let firstVector = new THREE.Vector3(tile.startPoint.x - centerPoint.x,
        tile.startPoint.y - centerPoint.y, tile.positionZ);
      let secondVector = new THREE.Vector3(tile.endPoint.x - centerPoint.x,
        tile.endPoint.y - centerPoint.y, tile.positionZ);

      // Euclidean distance
      const lengthPlane = Math.sqrt(
        Math.pow((firstVector.x - secondVector.x), 2) +
        Math.pow((firstVector.y - secondVector.y), 2));

      const geometryPlane = new THREE.PlaneGeometry(lengthPlane,
        tile.lineThickness * 3);

      const materialPlane = new THREE.MeshLambertMaterial({ color: tile.pipeColor });
      const plane = new THREE.Mesh(geometryPlane, materialPlane);

      let isDiagonalPlane = false;
      const diagonalPos = new THREE.Vector3();

      // Rotate plane => diagonal plane (diagonal commu line)
      if (Math.abs(firstVector.y - secondVector.y) > 0.1) {
        isDiagonalPlane = true;

        const distanceVector = new THREE.Vector3()
          .subVectors(secondVector, firstVector);

        plane.rotateZ(Math.atan2(distanceVector.y, distanceVector.x));

        diagonalPos.copy(distanceVector).multiplyScalar(0.5).add(firstVector);
      }

      // Set plane position
      if (!isDiagonalPlane) {
        const posX = firstVector.x + (lengthPlane / 2);
        const posY = firstVector.y;
        const posZ = firstVector.z;

        plane.position.set(posX, posY, posZ);
      }
      else {
        plane.position.copy(diagonalPos);
      }

      plane.userData['model'] = tile.emberModel;
      parent.push(plane);

    } // END createLine

    /*
     * This function is used to create the 
     * 3D-plane (for example closed components)
     */
    function createPlane(model) {
      const emberModelName = model.constructor.modelName;

      let color = self.get('configuration.landscapeColors.' + emberModelName);

      const material = new THREE.MeshLambertMaterial({
        color
      });

      const plane = new THREE.Mesh(new THREE.BoxGeometry(model.get('width'),
        model.get('height'), self.get('zeroValue')), material);

      plane.userData['model'] = model;
      return plane;
    }

    /*
     * This function is used to create the 
     * 3D-boxes (for example opened components)
     */
    function createBox(model) {
      const emberModelName = model.constructor.modelName;

      const material = new THREE.MeshLambertMaterial({
        color: self.get('configuration.landscapeColors.' + emberModelName)
      });

      let width = model.get('width');
      let height = model.get('height') ? model.get('height') : self.get('zeroValue');
      let depth = model.get('depth') ? model.get('depth') : self.get('zeroValue');

      let box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);

      box.userData['model'] = model;
      return box;
    }
    // Add text to the boxes
    this.get('labeler').drawTextLabels();
  },
  //////////// END populateScene

  /*
   *  This method is used to setup the landscape(3D) interaction 
   *  and listen for events triggered in interaction
   */
  initInteraction() {
    const canvas = this.get('canvas');
    const webglrenderer = this.get('webglrenderer');
    const raycaster = this.get('raycaster');

    let interaction = this.get('world.interaction');

    // Set / Bind properties for interaction
    interaction.set('canvas', canvas);
    interaction.set('renderer', webglrenderer);
    interaction.set('raycaster', raycaster);
    interaction.set('raycastObjectsLandscape', this.get('vrLandscape').children);
    interaction.set('colorList', this.get('configuration.landscapeColors'));
    interaction.set('colorListApp', this.get('configuration.applicationColors'));
    interaction.set('labeler', this.get('labeler'));
    interaction.set('room', this.get('room'));
    interaction.set('boundApps', this.get('boundApps'));

    // Init interaction handlers
    this.get('world.interaction').initHandlers();

    // Set listeners
    // Show teleport area
    this.get('world.interaction').on('showTeleportArea', (intersectionPoint) => {
      if (!this.get('teleportArea')) {
        // Create teleport area
        let geometry = new THREE.RingGeometry(0.14, 0.2, 32);
        geometry.rotateX(-1.5707963);
        let material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(0x0000dc)
        });
        material.transparent = true;
        material.opacity = 0.4;
        this.set('teleportArea', new THREE.Mesh(geometry, material));
        this.get('world.scene').add(this.get('teleportArea'));
      }
      this.get('teleportArea').position.x = intersectionPoint.x;
      this.get('teleportArea').position.y = intersectionPoint.y + 0.005;
      this.get('teleportArea').position.z = intersectionPoint.z;
    });

    // Remove teleport area from the scene
    this.get('world.interaction').on('removeTeleportArea', () => {
      if (this.get('teleportArea')) {
        let trash = new THREE.Object3D();
        trash.add(this.get('teleportArea'));
        this.removeChildren(trash);
        this.set('teleportArea', null);
      }
    });


    /*
     * This interaction listener is used to create the application3D 
     * (controller button pressed or mouse doubleclick)
     */
    this.get('world.interaction').on('showApplication', (emberModel, intersectionPoint) => {
      // Do not allow to open the same two apps
      if (this.get('openApps').has(emberModel.id)) {
        return;
      }
      // Add 3D Application to scene (also if one exists already)
      this.set('landscapeRepo.latestApplication', emberModel);
      this.add3DApplicationToLandscape(emberModel,
        intersectionPoint, new THREE.Quaternion());

      let app = this.get('openApps').get(emberModel.id);
      let bboxApp3D = new THREE.Box3().setFromObject(app);
      let app3DSize = new THREE.Vector3();
      bboxApp3D.getSize(app3DSize);
      app3DSize.multiplyScalar(0.5);

      let newPosition = new THREE.Vector3();

      // Center x and z around hit application
      newPosition.x = intersectionPoint.x - app3DSize.x;
      newPosition.z = intersectionPoint.z + app3DSize.z;
      newPosition.y = intersectionPoint.y + 0.3;
      app.position.set(newPosition.x, newPosition.y, newPosition.z);

      // Rotate app so that it is aligned with landscape
      app.setRotationFromQuaternion(this.get('world.vrEnvironment.quaternion'));
      app.rotateX(1.5707963267949);
      app.rotateY(1.5707963267949);
      app.updateMatrix();

      this.trigger('applicationOpened', emberModel.id, app);
    });
    /*
     * This interaction listener is used to delete an existing application3D 
     * (controller button pressed or mouse doubleclick)
     */
    this.get('world.interaction').on('removeApplication', (appID) => {
      // Remove 3D Application if present
      if (this.get('openApps').has(appID)) {
        this.removeChildren(this.get('openApps').get(appID));
        this.get('openApps').delete(appID);
      }
    });
  }, // END initInteraction

  initWorldListener() {

    this.get('world').on('resetAll', () => {
      this.resetLanscape();
      this.get('world').resetLandscape();
      this.get('localUser').resetPosition();
      this.removeOpenApps();
      return;
    });
    
  },

  
  /*
   *  This method is used to remove the given children of an object3D.
   *  'null' or 'undefined' passed => delete all children 
   */
  removeChildren(entity, childrenToRemove) {
    if (!entity) {
      return;
    }

    removeChildren(entity);

    function removeChildren(entity) {
      for (let i = entity.children.length - 1; i >= 0; i--) {
        let child = entity.children[i];
        let removeObject;

        // Handle possible children of child
        removeChildren(child);

        // Remove all children
        if (!childrenToRemove) {
          removeObject = true;
        }
        // Remove passed children only
        else {
          removeObject = childrenToRemove.includes(child.name);
        }

        if (removeObject) {
          if (child.type !== 'Object3D') {
            child.geometry.dispose();
            // Dispose array of material
            if (child.material.length) {
              for (let i = 0; i < child.material.length; i++) {
                let tempMaterial = child.material[i];
                if (tempMaterial.map) {
                  tempMaterial.map.dispose();
                }
                tempMaterial.dispose();
              }
            }
            // Dispose material 
            else {
              if (child.material.map) {
                child.material.map.dispose();
              }
              child.material.dispose();
            }
          }
          entity.remove(child);
        }
      }
    }
    if (!childrenToRemove) {
      // Handle removing whole application3D
      if (entity.name === 'app3D') {

        // Remove foundation for re-rendering
        this.removeFoundation(entity.userData.model.id, this.get('store'));
        // Update application3D in interaction
        this.get('world.interaction').set('openApps', null);
        this.set('landscapeRepo.latestApplication', null);
      }
    }
    // Update raycast objects (landscape)
    this.actualizeRaycastObjects();

    // Update possible objects for intersection with controller (application3D)
    this.set('world.interaction.raycastObjects', this.get('world.scene.children'));
  },

  removeOpenApps() {
    this.get('openApps').forEach(app => {
      app.children.forEach(child => {
        const emberModel = child.userData.model;
        if (emberModel !== undefined) {
          const emberModelName = emberModel.constructor.modelName;
          if (emberModelName === 'component')
            child.userData.model.setOpenedStatus(false);
        }
      });
      this.removeChildren(app);
    });
    this.set('openApps', new Map());
  },

  removeFoundation(appID, store) {
    const foundation = this.get('foundations').get(appID);

    if (!foundation) {
      return false;
    }

    const emberApplication = foundation.get('belongingApplication');

    emberApplication.set('components', foundation.get('children'));
    emberApplication.get('components').forEach((component) => {
      component.set('parentComponent', null);
    });

    store.unloadRecord(foundation);

    return true;
  },

  resetLanscape() {
    const allSystems = this.get('store').peekAll('system');
    allSystems.forEach(system => {
      system.setOpened(false);
    });
    this.populateScene();
  },


  /*
   *  This method is used to add commuication lines to application3D
   */
  addCommunicationToApp(application) {
    
    const self = this;
    
    const viewCenterPoint = this.get('centerAndZoomCalculator.centerPoint');
    const drawableClazzCommunications = application.get('drawableClazzCommunications');

    drawableClazzCommunications.forEach((drawableClazzComm) => {
      // Skip communication with incomplete data
      if (!drawableClazzComm.get('startPoint') || !drawableClazzComm.get('endPoint')) {
        return;
      }

      const start = new THREE.Vector3();
      start.subVectors(drawableClazzComm.get('startPoint'), viewCenterPoint);
      start.multiplyScalar(0.5);

      const end = new THREE.Vector3();
      end.subVectors(drawableClazzComm.get('endPoint'), viewCenterPoint);
      end.multiplyScalar(0.5);

      let transparent = false;
      let opacityValue = 1.0;

      if (drawableClazzComm.get('state') === 'TRANSPARENT') {
        transparent = true;
        opacityValue = 0.4;
      }

      const material = new THREE.MeshLambertMaterial({
        color: self.get('configuration.applicationColors.communication'),
        opacity: opacityValue,
        transparent: transparent
      });

      const thickness = drawableClazzComm.get('lineThickness') * 0.3;

      const pipe = cylinderMesh(start, end, material, thickness);

      pipe.userData.model = drawableClazzComm;
      pipe.userData.type = 'communication';
      this.get('openApps').get(application.id).add(pipe);
    });

    /*
     *  This function is used to create the pipes
     */
    function cylinderMesh(pointX, pointY, material, thickness) {
      const direction = new THREE.Vector3().subVectors(pointY, pointX);
      const orientation = new THREE.Matrix4();
      orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
      orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1,
        0, 0, -1, 0, 0, 0, 0, 0, 1));
      const edgeGeometry = new THREE.CylinderGeometry(thickness, thickness,
        direction.length(), 20, 1);
      const pipe = new THREE.Mesh(edgeGeometry, material);
      pipe.applyMatrix(orientation);

      pipe.position.x = (pointY.x + pointX.x) / 2.0;
      pipe.position.y = (pointY.y + pointX.y) / 2.0;
      pipe.position.z = (pointY.z + pointX.z) / 2.0;
      return pipe;
    }
  },

  /*
   * This function is used to add application3D
   * to the landscape(3D)
   */
  add3DApplicationToLandscape(application, position, quaternion) {
    const self = this;

    if (application.get('components').get('length') === 0) {
      return;
    }
    // Create foundation for application3D
    const foundation = this.get('foundationBuilder').createFoundation(application, this.get('store'));
    this.get('foundations').set(application.id, foundation);

    // Draw application in 3D application-view
    applyCityLayout(application);

    this.get('openApps').set(application.id, new THREE.Object3D());

    this.get('openApps').get(application.id).matrixAutoUpdate = false;
    this.get('openApps').get(application.id).name = 'app3D';
    this.get('openApps').get(application.id).userData.model = application;

    this.addCommunicationToApp(application);

    addComponentToScene(foundation, 0xCECECE, application.id);

    let bboxApp3D = new THREE.Box3().setFromObject(this.get('openApps').get(application.id));

    // Create delete button
    let geometryDel = new THREE.SphereGeometry(6, 32, 32);
    let materialDel = new THREE.MeshPhongMaterial({
      map: this.get('deleteButtonTexture')
    });
    this.set('deleteButton', new THREE.Mesh(geometryDel, materialDel));
    this.get('deleteButton').geometry.rotateY(-0.3);
    this.get('deleteButton').userData.name = 'deleteButton';
    this.get('deleteButton').name = 'deleteButton';
    this.get('deleteButton').position.set(
      this.get('openApps').get(application.id).position.x, bboxApp3D.max.y * 3.5, this.get('openApps').get(application.id).position.z);

    // Scale application
    this.get('openApps').get(application.id).scale.x = 0.01;
    this.get('openApps').get(application.id).scale.y = 0.01;
    this.get('openApps').get(application.id).scale.z = 0.01;

    // Apply last position and rotation
    this.get('openApps').get(application.id).position.set(position.x, position.y, position.z);
    this.get('openApps').get(application.id).setRotationFromQuaternion(quaternion);
    this.get('openApps').get(application.id).add(this.get('deleteButton'));
    this.get('openApps').get(application.id).updateMatrix();

    // Add id of app to children
    this.get('openApps').get(application.id).children.forEach(function (child) {
      child.userData.appID = application.id;
    });

    this.get('world.scene').add(this.get('openApps').get(application.id));

    // Setup interaction for app3D
    this.get('world.interaction').set('openApps', this.get('openApps'));

    this.actualizeRaycastObjects();

    /*
      This function is used to create all boxes for application3D
    */
    function addComponentToScene(component, color, appID) {
      
      const grey = self.get('configuration.applicationColors.foundation');
      const lightGreen = self.get('configuration.applicationColors.componentEven');
      const darkGreen = self.get('configuration.applicationColors.componentOdd');
      const clazzColor = self.get('configuration.applicationColors.clazz');

      createBoxApp(component, color, false, appID);

      component.set('color', color);

      const clazzes = component.get('clazzes');
      const children = component.get('children');

      clazzes.forEach((clazz) => {
        if (component.get('opened')) {
          createBoxApp(clazz, clazzColor, true, appID);
        }
      });

      children.forEach((child) => {
        if (component.get('opened')) {
          if (child.get('opened')) {
            if (component.get('color') === grey) {
              addComponentToScene(child, lightGreen, appID);
            } else if (component.get('color') === darkGreen) {
              addComponentToScene(child, lightGreen, appID);
            } else {
              addComponentToScene(child, darkGreen, appID);
            }
          } else {
            if (component.get('color') === grey) {
              addComponentToScene(child, lightGreen, appID);
            } else if (component.get('color') === darkGreen) {
              addComponentToScene(child, lightGreen, appID);
            } else {
              addComponentToScene(child, darkGreen, appID);
            }
          }
        }
      });
    } // END addComponentToScene

    /*
     *  This function is used to create the meshes for th application3D
     */
    function createBoxApp(component, color, isClass, appID) {
      let centerPoint = new THREE.Vector3(component.get('positionX') +
        component.get('width') / 2.0, component.get('positionY') +
        component.get('height') / 2.0,
        component.get('positionZ') + component.get('depth') / 2.0);

      const material = new THREE.MeshLambertMaterial();
      material.color = new THREE.Color(color);

      centerPoint.sub(self.get('centerAndZoomCalculator.centerPoint'));

      centerPoint.multiplyScalar(0.5);

      const extension = new THREE.Vector3(component.get('width') / 2.0,
        component.get('height') / 2.0, component.get('depth') / 2.0);

      const cube = new THREE.BoxGeometry(extension.x, extension.y, extension.z);

      const mesh = new THREE.Mesh(cube, material);

      mesh.position.set(centerPoint.x, centerPoint.y, centerPoint.z);

      mesh.updateMatrix();

      mesh.userData.model = component;
      mesh.userData.name = component.get('name');
      mesh.userData.foundation = component.get('foundation');
      mesh.userData.type = isClass ? 'clazz' : 'package';

      mesh.userData.opened = component.get('opened');
      self.get('labelerApp').createLabel(mesh, self.get('openApps').get(appID), self.get('font'));

      if (color === 0xCECECE) {
        mesh.name = 'app3DFoundation';
      } else {
        mesh.name = 'app3D';
      }

      // Pass highlighted mesh
      if (component.get('highlighted')) {
        self.get('world.interaction').set('selectedEntitysMesh', mesh);
      }

      self.get('openApps').get(appID).add(mesh);
    } // END createBoxApp
  }, // END add 3D application to the landscape(3D)

  redrawApplication(appID) {
    // Only redraw if app is opened
    if (!this.get('openApps').has(appID)) {
      return;
    }
    // Store app3D Data because application3D is removed in the next step
    let appPosition = this.get('openApps').get(appID).position;
    let appQuaternion = this.get('openApps').get(appID).quaternion;
    let app3DModel = this.get('openApps').get(appID).userData.model;

    // Empty application 3D (remove app3D)
    this.removeChildren(this.get('openApps').get(appID));

    // Add application3D to scene
    this.add3DApplicationToLandscape(app3DModel, appPosition, appQuaternion);
    this.get('openApps').get(appID).updateMatrix();
  }

});
