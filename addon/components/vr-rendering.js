import Ember from 'ember';
import THREE from "npm:three";
import THREEPerformance from 'explorviz-ui-frontend/mixins/threejs-performance';
import Raycaster from '../utils/vr-rendering/raycaster';
import applyKlayLayout from 'explorviz-ui-frontend/utils/landscape-rendering/klay-layouter';
import Interaction from '../utils/vr-rendering/interaction';
import Labeler from '../utils/vr-rendering/labeler';
import LabelerApp from 'explorviz-ui-frontend/utils/application-rendering/labeler';
import CalcCenterAndZoom from 'explorviz-ui-frontend/utils/landscape-rendering/center-and-zoom-calculator';
import ImageLoader from 'explorviz-ui-frontend/utils/three-image-loader';
import applyCityLayout from 'explorviz-ui-frontend/utils/application-rendering/city-layouter';
import {
  createFoundation,
  removeFoundation
} from 'explorviz-ui-frontend/utils/application-rendering/foundation-builder';

import layout from "../templates/components/vr-rendering";

/**
 * This component unites landscape(adapted to 3D)-, application-rendering
 * and rendering-core from which many function are taken over.
 * This component contains listeners waiting for events from the controller. 
 * For this reason some services are injected (urlBuilder, viewImporter, reloadHandler, ..)
 * The corresponding functions are not implemented yet (in VR) but could be 
 * good templates fo future work.  
 *
 * @class VR-Rendering
 * @extends Ember.Component
 */
export default Ember.Component.extend(Ember.Evented, THREEPerformance, {

  layout: layout,

  state: null,

  store: Ember.inject.service('store'),

  // Declare url-builder service 
  urlBuilder: Ember.inject.service("url-builder"),
  // Declare view-importer service 
  viewImporter: Ember.inject.service("view-importer"),
  reloadHandler: Ember.inject.service("reload-handler"),
  landscapeRepo: Ember.inject.service("repos/landscape-repository"),
  renderingService: Ember.inject.service(),

  classNames: ['viz'],

  scene: null,
  webglrenderer: null,
  camera: null,
  canvas: null,
  font: null,
  animationFrameId: null,
  initDone: false,

  configuration: Ember.inject.service("configuration"),
  configurationApplication: Ember.inject.service("configuration"),
  hammerManager: null,

  raycaster: null,
  interaction: null,
  labeler: null,
  labelerApp: null,
  imageLoader: null,
  centerAndZoomCalculator: null,
  initialRendering: true,

  // VR
  vrEnvironment: null,
  vrLandscape: null,
  vrCommunications: null,
  controller1: null,
  controller2: null,
  geometry: null,
  depth: 0.2,
  vrAvailable: false,
  room: null,
  initialPositions: {},

  // Stores mesh for 3D application
  app3DMesh: null,

  // Application
  application3D: null,
  applicationID: null,
  app3DPresent: false,
  textBox: null,

  didRender() {
    this._super(...arguments);
    this.initRendering();
    this.initListener();
  },

  // An Observer calculating the new raycastObjects
  actualizeRaycastObjects() {

    let result = (this.get('vrLandscape')) ? this.get('vrLandscape').children : [];
    const allowedObjects = ['node', 'system', 'nodegroup', 'application', 'communication', 'label', 'floor','component', 'clazz', 'communication'];

    result = (this.get('application3D')) ? result.concat(this.get('application3D').children) : result;
    result = filterResult(result);
    this.set('interaction.raycastObjectsLandscape',  result);


    function filterResult(result) {

      let help = result.filter(function(obj) {
        if (obj.userData.model) {
          const modelName = obj.userData.model.constructor.modelName;
          return allowedObjects.includes(modelName);
        }else{
         return false;
        }
      });
      return help;
    }
  },

  raycastObjectsNeedsUpdate: "",

  willDestroyElement() {
    this._super(...arguments);
    this.cleanup();
  },

  /**
   * This function is called once on the didRender event. 
   * Its used to setup initial values, utils and the basic
   * elements (for example meshes or lights) for the VR environment.
   *
   * @method initRendering
   */
  initRendering() {

    const self = this;

    // Check if WebVR is supported
    WEBVR.checkAvailability().catch(function(reject) {
      self.get('interaction').showAlertifyMessage(reject);
    });

    // dummy object for raycasting
    this.set('room', new THREE.Object3D());
    this.get('room').name = 'room';

    this.set('vrLandscape', new THREE.Group());
    this.get('vrLandscape').name = 'landscape';
    this.get('vrLandscape').renderOrder = 2;

    this.set('vrCommunications', new THREE.Group());
    this.get('vrCommunications').name = 'vrCommunications';
    this.get('vrCommunications').renderOrder = 1;

    this.set('vrEnvironment', new THREE.Object3D());
    this.get('vrEnvironment').name = 'landscape';
    this.get('vrEnvironment').add(this.get('vrCommunications'));
    this.get('vrEnvironment').add(this.get('vrLandscape'));

    this.get('vrEnvironment').matrixAutoUpdate = false;
    this.get('vrLandscape').matrixAutoUpdate = false;
    this.get('vrCommunications').matrixAutoUpdate = false;

    // rotate landscape by 90 degrees (radiant)
    this.get('vrEnvironment').rotateX(-1.5707963);
    this.get('vrEnvironment').updateMatrix();

    // remove stored applications
    this.set('landscapeRepo.latestApplication', null);

    // get size if outer ember div
    const height = this.$()[0].clientHeight;
    const width = this.$()[0].clientWidth;

    const canvas = this.$('#threeCanvas')[0];
    this.set('canvas', canvas);

    this.set('scene', new THREE.Scene());
    this.set('scene.background', new THREE.Color(0xffffff));

    this.set('camera', new THREE.PerspectiveCamera(70, width / height, 0.1, 10));

    // Create and configure renderer
    this.set('webglrenderer', new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas
    }));
    this.get('webglrenderer').setPixelRatio(window.devicePixelRatio);
    this.get('webglrenderer').setSize(width, height);
    this.get('webglrenderer').vr.enabled = true;
    this.get('webglrenderer').vr.standing = true;
    this.get('webglrenderer').shadowMap.enabled = true;
    this.get('webglrenderer').gammaInput = true;
    this.get('webglrenderer').gammaOutput = true;

    // Create first controller
    this.set('controller1', new ViveController(0));
    this.get('controller1').standingMatrix = this.get('webglrenderer').vr.getStandingMatrix();
    this.get('controller1').name = "controller";
    this.get('scene').add(this.get('controller1'));

    // Create first controller
    this.set('controller2', new ViveController(1));
    this.get('controller2').standingMatrix = this.get('webglrenderer').vr.getStandingMatrix();
    this.get('controller2').name = "controller";
    this.get('scene').add(this.get('controller2'));

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

    // Create green ray for left controller
    let line2 = new THREE.Line(this.get('geometry'));
    line2.name = 'controllerLine';
    line2.scale.z = 5;
    line2.material.color = new THREE.Color('rgb(0,204,51)');
    line2.material.opacity = 0.25;

    // Add rays to controllers
    this.get('controller1').add(line1);
    this.get('controller2').add(line2);
    this.get('scene').add(this.get('vrEnvironment'));

    // create text box 
    var color = new THREE.Color("rgb(253,245,230)");
    let material = new THREE.MeshBasicMaterial({
      color
    });
    this.set('textBox', new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0), material));
    this.get('textBox').name = 'textBox';

    // rotate text box
    this.get('textBox').geometry.rotateX(1.5707963267949);
    this.get('textBox').geometry.rotateY(1.5707963267949 * 2);

    // VR Rendering loop //
    function animate() {  
    self.get('webglrenderer').animate(render);
  }

    function render() {
      // Update Controller
      self.get('controller1').update();
      self.get('controller2').update();

      // Check raycast for intersection
      if (self.get('interaction')) {
        // only if no application3D binded on controller
        if (self.get('controller1').userData.selected === undefined) {
          self.get('interaction').checkIntersection(self.get('controller1'));
        }
        if (self.get('controller2').userData.selected === undefined) {
          self.get('interaction').checkIntersection(self.get('controller2'));
        }
      }
      self.get('webglrenderer').render(self.get('scene'), self.get('camera'));
    }
    animate();

    ////////////////////


    this.debug("init vr-rendering");

    this.onReSetupScene = function() {
      this.set('centerAndZoomCalculator.centerPoint', null);
      this.populateScene();
    };

    this.onUpdated = function() {
      if (this.get('initDone')) {
        this.populateScene();
      }
    };

    this.onResized = function() {
      //this.set('centerAndZoomCalculator.centerPoint', null);
      //this.populateScene();
    };

    if (!this.get('interaction')) {
      this.set('interaction', Interaction.create());
    }

    if (!this.get('imageLoader')) {
      this.set('imageLoader', ImageLoader.create());
    }

    if (!this.get('labeler')) {
      this.set('labeler', Labeler.create());
    }

    if (!this.get('labelerApp')) {
      this.set('labelerApp', LabelerApp.create());
    }

    if (!this.get('raycaster')) {
      this.set('raycaster', Raycaster.create());
    }

    if (!this.get('centerAndZoomCalculator')) {
      this.set('centerAndZoomCalculator', CalcCenterAndZoom.create());
    }

    this.initInteraction();

    // Add lights
    const dirLight = new THREE.DirectionalLight();
    dirLight.position.set(30, 10, 20);
    this.get('scene').add(dirLight);

    const spotLight = new THREE.SpotLight(0xffffff, 0.5, 1000, 1.56, 0, 0);
    spotLight.position.set(0, 0, 0);
    spotLight.castShadow = false;
    this.get('scene').add(spotLight);

    // AmbientLight( color, intensity )
    const light = new THREE.AmbientLight(new THREE.Color(0.65, 0.65, 0.65), 0.8);
    this.scene.add(light);

    // set default model
    this.set('imageLoader.logos', {});
    this.set('labeler.textLabels', {});
    this.set('labeler.systemTextCache', []);
    this.set('labeler.nodeTextCache', []);
    this.set('labeler.appTextCache', []);
    this.set('centerAndZoomCalculator.centerPoint', null);

    // create floor
    var floorTexture = new THREE.TextureLoader().load('images/materials/floor.jpg');
    var floorGeometry = new THREE.BoxGeometry(4, 0, 3);
    var floorMaterial = new THREE.MeshBasicMaterial({
      map: floorTexture
    });
    var floorMesh = new THREE.Mesh(floorGeometry, floorMaterial); ///// End floor
    floorMesh.name = 'floor';
    this.get('room').add(floorMesh);
    self.get('scene').add(this.get('room'));

    // VR-Button
    WEBVR.getVRDisplay(function(display) {
      self.set('vrAvailable', true);
      self.get('webglrenderer').vr.setDevice(display);
      document.body.appendChild(WEBVR.getButton(display, self.get('webglrenderer').domElement));
    });

    // Stop data flow
    this.get('reloadHandler').stopExchange();

    // Loader for VIVE-Controller texture
    let OBJLoader = createOBJLoader(THREE);
    let loader = new OBJLoader(THREE.DefaultLoadingManager);
    loader.setPath('vive-controller/');
    loader.load('vr_controller_vive_1_5.obj', function(object) {
      const obj = object;
      obj.name = "viveTexture";
      let loader = new THREE.TextureLoader();
      loader.setPath('vive-controller/');
      let controller = obj.children[0];
      controller.material.map = loader.load('onepointfive_texture.png');
      controller.material.specularMap = loader.load('onepointfive_spec.png');
      self.get('controller1').add(obj.clone());
      self.get('controller2').add(obj.clone());

      // load font for labels and synchronously proceed with populating the scene
      new THREE.FontLoader()
        .load('three.js/fonts/roboto_mono_bold_typeface.json', function(font) {
          self.set('font', font);
          self.set('initDone', true);
          self.populateScene();
        });
    });
  },

  /*
   * This method is used to listen for events triggered Controller.
   * The corresponding funcinoalities are not yet implemented in VR.
   * But they can used as templates in the future.
   */
  initListener() {

    const self = this;

    this.get('viewImporter').on('transmitView', function(newState) {
      self.set('newState', newState);
    });


    this.get('renderingService').on('reSetupScene', function() {
      self.onReSetupScene();
    });


    this.get('urlBuilder').on('requestURL', function() {
      const state = {};

      // get timestamp
      state.timestamp = self.get('landscapeRepo.latestLandscape')
        .get('timestamp');

      // get latestApp, may be null
      const latestMaybeApp = self.get('landscapeRepo.latestApplication');
      state.appID = latestMaybeApp ? latestMaybeApp.get('id') : null;

      state.camX = self.get('camera').position.x;
      state.camY = self.get('camera').position.y;
      state.camZ = self.get('camera').position.z;

      // Passes the state from component via service to controller
      self.get('urlBuilder').transmitState(state);
    });


    this.get('landscapeRepo').on("updated", function() {
      self.onUpdated();
    });
  },

  /**
   * This function is called when the willDestroyElement event is fired
   * (for example while switching tabs). 
   * Its used to turn off listeners and reset intial values
   * @method cleanup
   */
  cleanup() {

    const self = this;

    // Stop rendering
    self.get('webglrenderer').animate(null);
    this.get('webglrenderer').dispose();
    
    this.set('scene', null);
    this.set('webglrenderer', null);
    this.set('camera', null);
    this.get('urlBuilder').off('requestURL');
    this.removePerformanceMeasurement();
    //this.$(window).off('resize.visualization');
    this.get('viewImporter').off('transmitView');
    this.get('renderingService').off('reSetupScene');
    this.get('landscapeRepo').off('updated');

    this.debug("cleanup vr rendering");

    this.set('imageLoader.logos', {});
    this.set('labeler.textLabels', {});
    this.set('labeler.textCache', []);

    this.get('interaction').off('redrawScene');
    this.get('interaction').off('redrawVREnvironment');
    this.get('interaction').off('redrawApp');
    this.get('interaction').off('showApplication');
    this.get('interaction').off('removeApplication');

    this.get('interaction').removeHandlers();

    const emberLandscape = this.get('landscapeRepo.latestLandscape');

    // Open all systems for 2D visualization and restore z-position
    if (emberLandscape) {
      emberLandscape.get('systems').forEach(function(system) {
        system.setOpened(true);
        system.set('positionZ', self.get('initialPositions')[system.get('id')]);

        const nodegroups = system.get('nodegroups');
        nodegroups.forEach(function(nodegroup) {
          nodegroup.set('positionZ', self.get('initialPositions')[nodegroup.get('id')]);

          const nodes = nodegroup.get('nodes');
          nodes.forEach(function(node) {
            node.set('positionZ', self.get('initialPositions')[node.get('id')]);

            const applications = node.get('applications');
            applications.forEach(function(application) {
              application.set('positionZ', self.get('initialPositions')[application.get('id')]);
            });
          });
        });
      });
      this.set('initialRendering', true);
    }

    if (this.get('landscapeRepo.latestApplication')) {
      // remove foundation of application3D
      const emberApplication = this.get('application3D.userData.model');
      removeFoundation(emberApplication, this.get('store'));
      this.set('landscapeRepo.latestApplication', null);
    }

    this.set('applicationID', null);
    this.set('application3D', null);

    // Clean up Webgl contexts
    var gl = this.get('canvas').getContext('webgl');
    gl.getExtension('WEBGL_lose_context').loseContext();

    // Remove VR-Button from DOM 
    if (this.get('vrAvailable')) {
      document.body.removeChild(document.body.lastChild);
    }
  },

  /**
   * This function is used to build and update the landscape(3D). 
   * The meshes are created first and the old ones
   * are deleted afterwards.
   * The function is called once in initRendering and every time 
   * the util interaction triggers the event "redrawScene".
   *
   * @method populateScene
   */
  populateScene() {

    const self = this;
    let landscapeMeshes = [];
    let communicationMeshes = [];

    const emberLandscape = this.get('landscapeRepo.latestLandscape');

    if (!emberLandscape || !this.get('font')) {
      return;
    }

    /* - Close all systems
     *  - set new depth value for systems, nodegroups, nodes and applications 
     *  - save z-posiitons to restore initial state
     */
    if (emberLandscape) {
      if (this.get('initialRendering')) {
        emberLandscape.get('systems').forEach(function(system) {
          system.setOpened(false);
          self.get('initialPositions')[system.get('id')] = system.get('positionZ');
          system.set('depth', self.get('depth'));

          const nodegroups = system.get('nodegroups');
          nodegroups.forEach(function(nodegroup) {
            self.get('initialPositions')[nodegroup.get('id')] = nodegroup.get('positionZ');
            nodegroup.set('depth', self.get('depth'));

            const nodes = nodegroup.get('nodes');
            nodes.forEach(function(node) {
              self.get('initialPositions')[node.get('id')] = node.get('positionZ');
              node.set('depth', self.get('depth'));

              const applications = node.get('applications');
              applications.forEach(function(application) {
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

    this.set('vrEnvironment.userData.model', emberLandscape);

    const systems = emberLandscape.get('systems');

    const scaleFactor = {
      width: 0.5,
      height: 0.5
    };

    let isRequestObject = false;

    if (systems) {
      // calculate new center and update zoom
      if (!this.get('centerAndZoomCalculator.centerPoint')) {
        this.get('centerAndZoomCalculator').calculateLandscapeCenterAndZZoom(emberLandscape,
          this.get('webglrenderer'));
      }

      // Compute the amount of requests for every id
      let allRequests = computeRequests(emberLandscape.get('applicationCommunication'));

      var centerPoint = this.get('centerAndZoomCalculator.centerPoint');

      // Create landscape
      systems.forEach(function(system) {

        isRequestObject = false;

        var extensionX, extensionY, centerX, centerYClosed, centerYOpened;

        // Create earth
        if (!isRequestObject && system.get('name') === "Requests") {
          isRequestObject = true;

          // Add earth
          extensionX = system.get('width') * scaleFactor.width;
          extensionY = system.get('height') * scaleFactor.height;

          centerX = system.get('positionX') + extensionX - centerPoint.x;
          centerYClosed = system.get('positionY') - extensionY - centerPoint.y;
          centerYOpened = system.get('positionY') - extensionY - centerPoint.y;

          // Create mesh for earth
          var requesteometry = new THREE.SphereGeometry(0.1, 32, 32);

          var texture = new THREE.TextureLoader().load('images/logos/requests.png');
          var material = new THREE.MeshPhongMaterial({
            map: texture
          });

          var requests = new THREE.Mesh(requesteometry, material);
          requests.name = "earth";

          requests.position.set(centerX, centerYClosed, system.get('positionZ'));

          // Scale requests
          requests.scale.x = requests.scale.x / self.get('vrEnvironment').scale.x;

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
          var oldSystemDepth = system.get('depth');

          // Calculate system depth (height) depending on the amount of traget requests
          if (allRequests[system.get('id')]) {
            system.set('depth', assignDepth(allRequests[system.get('id')]));
          }

          // Draw box for closed and plane for opened systems
          var systemMesh;
          if(system.get('opened')) {
            systemMesh = createPlane(system);
            systemMesh.name = 'systemOpened';
            // Transform z-position of closed system to opened system 
            systemMesh.position.set(centerX, centerYOpened, 
              system.get('positionZ') - system.get('depth') / 2);
          } 
          else {
            // New depth only influences closed boxes
            var diffSystemDepth = system.get('depth') - oldSystemDepth;
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
            self.get('configuration.landscapeColors.textsystem');
          let emberModelName = system.constructor.modelName;
          let boxColor = self.get('configuration.landscapeColors.' + emberModelName);
          self.get('labeler').saveTextForLabeling(null, systemMesh, textColor, boxColor);

        }

        const nodegroups = system.get('nodegroups');

        // Draw nodegroups 
        nodegroups.forEach(function(nodegroup) {

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
              if (allRequests[nodegroup.get('id')]) {
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
                nodegroupMesh.name = 'nodegroupOpened';
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
          nodes.forEach(function(node) {
            if (nodes.content.length === 1 || nodegroup.get('opened')) {

              if (!node.get('visible')) {
                return;
              }

              // Save old depth
              let oldNodeDepth = nodegroup.get('depth');

              // Set nodegroup depth relative to the amount of traget requests
              if (allRequests[node.get('id')]) {
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
              nodeMesh.type = "application";
              nodeMesh.name = "node";

              // Get parent position and store new position
              node.set('positionZ', node.get('parent').get('positionZ') + diffNodeDepth / 2);

              nodeMesh.position.set(centerX, centerYOpened, node.get('positionZ') + 0.002);

              landscapeMeshes.push(nodeMesh);
              node.set('threeJSModel', nodeMesh);

              // Create text labels 
              let textColor = self.get('configuration.landscapeColors.textnode');
              let emberModelName = node.constructor.modelName;
              let boxColor = self.get('configuration.landscapeColors.' + emberModelName);
              self.get('labeler').saveTextForLabeling(node.getDisplayName(),
                nodeMesh, textColor, boxColor);

              const applications = node.get('applications');

              // Draw applications
              applications.forEach(function(application) {

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
                    texturePartialPath, applicationMesh, "label");

                  // Create text labels 
                  let textColor =
                    self.get('configuration.landscapeColors.textapp');
                  
                  let emberModelName = application.constructor.modelName;
                  let boxColor = self.get('configuration.landscapeColors.' + emberModelName);
                  
                  self.get('labeler').saveTextForLabeling(null, applicationMesh,
                    textColor, boxColor);
                }
              });
            }
            // Closed nodegroup => dont draw nodes+applications, just add text label
            else {
              let textColor = self.get('configuration.landscapeColors.textapp');
              let emberModelName = nodegroup.constructor.modelName;
              let boxColor = self.get('configuration.landscapeColors.' + emberModelName);

              textColor = self.get('configuration.landscapeColors.textnode');
              self.get('labeler').saveTextForLabeling(node.getDisplayName(), 
                nodegroupMesh, textColor, boxColor);
            }
          });
        });
      });
    } // END if(systems)

    self.set('configuration.landscapeColors.textchanged', false);

    const appCommunication = emberLandscape.get('applicationCommunication');

    const tiles = [];

    let tile;

    // Draw communication lines
    if (appCommunication) {

      let color = self.get('configuration.landscapeColors.communication');

      appCommunication.forEach((communication) => {

        // Calculate communication points
        const points = communication.get('points');

        if (points.length > 0) {

          for (var i = 1; i < points.length; i++) {

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

            tile.communications.push(appCommunication);
            tile.requestsCache = tile.requestsCache +
              communication.get('requests');

            tiles[id] = tile;
          }

        }


      });
      // Draw lines
      //addCommunicationLineDrawing(tiles, communicationMeshes);
    }


    /*
     * The landscape(3D) will be deleted an rewritten
     * It consists of vrCommunications and vrLandscape */
    // Delete and redraw communication lines
    removeAllChildren(this.get('vrCommunications'));
    this.get('vrCommunications').updateMatrix();
    
    communicationMeshes.forEach(function(mesh) {
      this.get('vrCommunications').add(mesh);
    }.bind(this));
    this.get('vrCommunications').updateMatrix();

    // Delete and redraw landscape(boxes) lines
    removeAllChildren(this.get('vrLandscape'));
    this.get('vrLandscape').updateMatrix();

    landscapeMeshes.forEach(function(mesh) {
      this.get('vrLandscape').add(mesh);
    }.bind(this));
    this.get('vrLandscape').updateMatrix();


    // Scale landscape(3D)
    this.get('vrEnvironment').updateMatrix();
    scaleVREnvironment(this.get('vrEnvironment'), this.get('room'));
    this.get('vrEnvironment').updateMatrix();
    
    // Center landscape(3D) on the floor 
    //centerVREnvironment(this.get('vrEnvironment'), this.get('room'));
    this.get('vrEnvironment').updateMatrix();
    this.actualizeRaycastObjects();
    this.get('webglrenderer').vr.submitFrame();


    // Helper functions //

    /*
     *  This function is used to remove all childs
     *  of a given entity
     */
    function removeAllChildren(entity) {
      for (let i = entity.children.length - 1; i >= 0; i--) {
        let child = entity.children[i];

        removeAllChildren(child);
        if (child.type !== 'Object3D') {
          child.geometry.dispose();
          // dispose array of material
          if (child.material.length) {
            for (let i = 0; i < child.material.length; i++) {
              let tempMaterial = child.material[i];
              tempMaterial.dispose();
            }
          } else {
            child.material.dispose();
          }
        }

        entity.remove(child);
      }
    }

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
     *  This function is used to compute the amount of 
     *  all requests for each entity (id)
     */
    function computeRequests(appCommunication) {
      let requests = {};
      appCommunication.forEach((communication) => {

        if (!requests[communication.get('target').get('id')]) {
          requests[communication.get('target').get('id')] = communication.get('requests');
        } else {
          requests[communication.get('target').get('id')] = 
            requests[communication.get('target').get('id')] + communication.get('requests');
        }

        let parent = communication.get('target').get('parent');

        // Check for parents and exclude root parent
        while (parent && parseInt(parent.get('id')) !== 1) {

          if (!requests[parent.get('id')]) {
            requests[parent.get('id')] = communication.get('requests');
          } else {
            requests[parent.get('id')] = 
              requests[parent.get('id')] + communication.get('requests');
          }
          parent = parent.get('parent');
        }

      });
      return requests;
    }

    /* 
     *  This function is used to center the landscape(3D) on the floor.
     *  The object3D which contains the landscape(3D) and communication
     *  is centered relative to the floor.
     */
    function centerVREnvironment(vrEnvironment, floor) {

      // Compute bounding box of the floor
      const bboxFloor = new THREE.Box3().setFromObject(floor);

      // Calculate center of the floor 
      const centerFloor = bboxFloor.getCenter();

      // Compute bounding box of the vrEnvironment
      const bboxLandscape = new THREE.Box3().setFromObject(vrEnvironment);

      // Calculate center of the landscape(3D) (vrEnvironment) 
      const centerLandscape = bboxLandscape.getCenter();

      // set new position of vrEnvironment
      vrEnvironment.position.x += centerFloor.x - centerLandscape.x;
      vrEnvironment.position.z += centerFloor.z - centerLandscape.z;
      if (bboxLandscape.min.y < bboxFloor.min.y) {
        vrEnvironment.position.y += bboxFloor.max.y - bboxLandscape.min.y + 0.001;
      }
    }

    /* 
     *  This function is used to resize
     *  the landscape(3D) so it fits on the floor
     */
    function scaleVREnvironment(vrEnvironment, floor) {

      // Compute bounding box of the floor and landscape
      const bboxFloor = new THREE.Box3().setFromObject(floor);
      const bboxLandscape = new THREE.Box3().setFromObject(vrEnvironment);

      let floorSize = bboxFloor.getSize();
      let landscapeSize = bboxLandscape.getSize();

      if (landscapeSize.x > (floorSize.x - 1)) {
        let scale = (floorSize.x - 1) / landscapeSize.x;
        vrEnvironment.scale.x *= scale;
      }

      if (landscapeSize.z > (floorSize.z - 1.5)) {
        let scale = (floorSize.z - 1.5) / landscapeSize.z;
        vrEnvironment.scale.y *= scale;
      }
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
        createLine(tile, tiles, meshes);
      }

      function getCategories(list, linear) {

        if (linear) {
          useLinear(list);
        } else {
          useThreshholds(list);
        }

        return list;

        // inner helper functions

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
    function createLine(tile, tiles, meshes) {

      const geometry = new THREE.Geometry();
      let firstVector = new THREE.Vector3(tile.startPoint.x - centerPoint.x,
        tile.startPoint.y - centerPoint.y, tile.positionZ);
      let secondVector = new THREE.Vector3(tile.endPoint.x - centerPoint.x,
        tile.endPoint.y - centerPoint.y, tile.positionZ);

      let helpVector = new THREE.Vector3();
      helpVector.subVectors(secondVector, firstVector);
      if (helpVector.y > 0) {
        helpVector.cross(new THREE.Vector3(0, 0, 1));
      } else {
        helpVector.cross(new THREE.Vector3(0, 0, -1));
      }
      helpVector.normalize();
      helpVector.multiplyScalar(tile.lineThickness * 0.4);

      geometry.vertices.push(firstVector);

      geometry.vertices.push(secondVector);

      geometry.vertices.unshift(new THREE.Vector3(firstVector.x - helpVector.x, firstVector.y, firstVector.z));

      geometry.vertices.push(new THREE.Vector3(secondVector.x + helpVector.x, secondVector.y, secondVector.z));

      const material = new THREE.LineBasicMaterial({
        color: tile.pipeColor
      });
      const lineMesh = new THREE.Line(geometry,material);

      lineMesh.name = "communication";
      meshes.push(lineMesh);

    } // END createLine

    /*
     * This function is used to create the 
     * 3D-plane (for example closed components)
     */
    function createPlane(model) {

      const emberModelName = model.constructor.modelName;

      var color = self.get('configuration.landscapeColors.' + emberModelName);

      const material = new THREE.MeshBasicMaterial({
        color
      });

      const plane = new THREE.Mesh(new THREE.BoxGeometry(model.get('width'),
        model.get('height'), 0), material);

      plane.userData['model'] = model;
      return plane;

    }

    /*
     * This function is used to create the 
     * 3D-boxes (for example opened components)
     */
    function createBox(model) {

      const emberModelName = model.constructor.modelName;

      var color = self.get('configuration.landscapeColors.' + emberModelName);

      const material = new THREE.MeshBasicMaterial({
        color
      });

      const box = new THREE.Mesh(new THREE.BoxGeometry(model.get('width'),
        model.get('height'), model.get('depth')), material);

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

    const self = this;

    const scene = this.get('scene');
    const canvas = this.get('canvas');
    const camera = this.get('camera');
    const webglrenderer = this.get('webglrenderer');
    const raycaster = this.get('raycaster');
    const controller1 = this.get('controller1');
    const controller2 = this.get('controller2');
    const vrEnvironment = this.get('vrEnvironment');
    const userHeight = 1.9;

    // Init interaction objects
    this.get('interaction').setupInteraction(scene, canvas, camera, webglrenderer,
      raycaster, this.get('vrLandscape').children, controller1, controller2, 
      vrEnvironment, this.get('configuration.landscapeColors'), 
      this.get('configurationApplication.applicationColors'), this.get('textBox'), 
      userHeight, this.get('labeler'), this.get('room'));

    // set listeners
    this.get('interaction').on('redrawScene', function() {
      self.populateScene();
    });

    /*
     * This interaction listener is used to redraw the application3D 
     * ("opened" value of package changed) 
     */
    this.get('interaction').on('redrawApp', function() {

      // Store app3D Data
      var appPosition = self.get('app3DMesh').position;
      var appRotation = self.get('app3DMesh').rotation;
      let app3DModel = self.get('application3D.userData.model');

      // Empty application 3D (remove app3D)
      self.removeApp3D();
      self.set('landscapeRepo.latestApplication', null);

      // Add application3D to scene
      self.add3DApplicationToLandscape(app3DModel, appPosition, appRotation);

    }); ///// End redraw application3D 

    /*
     * This interaction listener is used to create the application3D 
     * (controller button pressed or mouse doubleclick)
     */
    this.get('interaction').on('showApplication', function(emberModel, intersectionPoint) {
      self.set('viewImporter.importedURL', null);

      // Add 3D Application to scene if no exists
      if (!self.get('app3DPresent')) {
        self.set('landscapeRepo.latestApplication', emberModel);
        self.add3DApplicationToLandscape(emberModel, 
          intersectionPoint, new THREE.Vector3(0, 0, 0));

        let bboxApp3D = new THREE.Box3().setFromObject(self.get('application3D'));
        let app3DSize = bboxApp3D.getSize();
        app3DSize.multiplyScalar(0.5);
        let newPosition = new THREE.Vector3();
        // Center x and z
        newPosition.x = intersectionPoint.x - app3DSize.x;
        newPosition.z = intersectionPoint.z - app3DSize.z;
        // Uncenter y for better overview
        newPosition.y = intersectionPoint.y + app3DSize.y;
        self.get('application3D').position.set(newPosition.x, newPosition.y, newPosition.z);
        self.set('app3DPresent', true);
      }
      // Otherwise delete 3D Application and allow creation again
      else {
        self.removeApp3D();
        self.set('app3DPresent', false);
      }

    });
    /*
     * This interaction listener is used to delete an existing application3D 
     * (controller button pressed or mouse doubleclick)
     */
    this.get('interaction').on('removeApplication', function() {

      // Remove 3D Application if presend
      if (self.get('app3DPresent')) {
        self.removeApp3D();
        self.set('app3DPresent', false);
      }
    });
  }, // END initInteraction


  /*
    This function is used to remove an application3D from the scene
  */
  removeApp3D() {

    const scene = this.get('scene');

    removeApp3D(scene);

    function removeApp3D(entity) {
      for (let i = entity.children.length - 1; i >= 0; i--) {
        let child = entity.children[i];

        removeApp3D(child);
        if (child.name === 'app3D' || child.name === 'labelApp3D') {
          if (child.type !== 'Object3D') {
            child.geometry.dispose();
            child.material.dispose();
          }
          entity.remove(child);
        }
      }
    }
    this.actualizeRaycastObjects();
    // remove foundation for re-rendering
    const emberApplication = this.get('application3D.userData.model');
    removeFoundation(emberApplication, this.get('store'));

    this.set('applicationID', null);
    this.set('application3D', null);

    // Update possible objects for intersection with controller
    this.set('interaction.raycastObjects', this.get('scene.children'));
  },

  /*
   * This function is used to add application3D
   * to the landscape(3D)
   */
  add3DApplicationToLandscape(application, position, rotation) {
    const self = this;

    if (application.get('components').get('length') !== 0) {
      // Create foundation for application3D
      const foundation = createFoundation(application, self.get('store'));

      // Draw application in 3D application-view
      applyCityLayout(application);

      self.set('applicationID', application.id);

      self.set('application3D', new THREE.Object3D());
      self.get('application3D').name = 'app3D';
      self.set('application3D.userData.model', application);

      const accuCommunications = application.get('communicationsAccumulated');
      // Draw communication
      accuCommunications.forEach((commu) => {
        if (commu.source !== commu.target) {
          if (commu.startPoint && commu.endPoint) {

            const start = new THREE.Vector3();
            start.subVectors(commu.startPoint, position);
            start.multiplyScalar(0.5);

            const end = new THREE.Vector3();
            end.subVectors(commu.endPoint, position);
            end.multiplyScalar(0.5);

            if (start.y >= end.y) {
              end.y = start.y;
            } else {
              start.y = end.y;
            }

            let transparent = false;
            let opacityValue = 1.0;

            if (commu.state === "TRANSPARENT") {
              transparent = true;
              opacityValue = 0.4;
            }

            const material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(0xf49100),
              opacity: opacityValue,
              transparent: transparent
            });

            const thickness = commu.pipeSize * 0.3;

            const pipe = cylinderMesh(start, end, material, thickness);

            pipe.userData.model = commu;
            pipe.name = 'app3D';


            self.get('application3D').add(pipe);

          }
        }
      });

      addComponentToScene(foundation, 0xCECECE);

      self.get('scene').add(self.get('application3D'));

      // Scale application
      self.get('application3D').scale.x = 0.01;
      self.get('application3D').scale.y = 0.01;
      self.get('application3D').scale.z = 0.01;

      // Apply last position and rotation
      self.get('application3D').position.set(position.x, position.y, position.z);
      self.get('application3D').rotation.set(rotation.x, rotation.y, rotation.z);

      // Store application mesh for redraw
      self.set('app3DMesh', self.get('application3D'));

      // Setup interaction for app3D
      self.get('interaction').setupInteractionApp3D(self.get('application3D'));
    }

    this.actualizeRaycastObjects();

    /*
     *  This function is used to create the pipes
     */
    function cylinderMesh(pointX, pointY, material, thickness) {
      const direction = new THREE.Vector3().subVectors(pointY, pointX);
      const orientation = new THREE.Matrix4();
      orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
      orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1));
      const edgeGeometry = new THREE.CylinderGeometry(thickness, thickness, direction.length(), 20, 1);
      const pipe = new THREE.Mesh(edgeGeometry, material);
      pipe.applyMatrix(orientation);

      pipe.position.x = (pointY.x + pointX.x) / 2.0;
      pipe.position.y = (pointY.y + pointX.y) / 2.0;
      pipe.position.z = (pointY.z + pointX.z) / 2.0;
      return pipe;
    }

    /*
      This function is used to create all boxes for application3D
    */
    function addComponentToScene(component, color) {

      const grey = 0xCECECE;
      const lightGreen = 0x00BB41;
      const darkGreen = 0x169E2B;
      const clazzColor = 0x3E14A0;
      const redHighlighted = 0xFF0000;

      createBoxApp(component, color, false);

      component.set('color', color);

      const clazzes = component.get('clazzes');
      const children = component.get('children');

      clazzes.forEach((clazz) => {
        if (component.get('opened')) {
          if (clazz.get('highlighted')) {
            createBoxApp(clazz, redHighlighted, true);
          } else {
            createBoxApp(clazz, clazzColor, true);
          }
        }
      });

      children.forEach((child) => {
        if (component.get('opened')) {
          if (child.get('opened')) {
            if (component.get('color') === grey) {
              addComponentToScene(child, lightGreen);
            } else if (component.get('color') === darkGreen) {
              addComponentToScene(child, lightGreen);
            } else {
              addComponentToScene(child, darkGreen);
            }
          } else {
            if (component.get('color') === grey) {
              addComponentToScene(child, lightGreen);
            } else if (component.get('color') === darkGreen) {
              addComponentToScene(child, lightGreen);
            } else {
              addComponentToScene(child, darkGreen);
            }
          }
        }
      });
    } // END addComponentToScene

    /*
     *  This function is used to create the meshes for th application3D
     */
    function createBoxApp(component, color, isClass) {

      let centerPoint = new THREE.Vector3(component.get('positionX') +
        component.get('width') / 2.0, component.get('positionY') +
        component.get('height') / 2.0,
        component.get('positionZ') + component.get('depth') / 2.0);

      const material = new THREE.MeshLambertMaterial();

      material.color = new THREE.Color(color);

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

      self.get('labelerApp').createLabel(mesh, self.get('application3D'),
        self.get('font'));

      if (color === 0xCECECE) {
        mesh.name = 'app3DFoundation';
      } else {
        mesh.name = 'app3D';
      }

      self.get('application3D').add(mesh);

    } // END createBoxApp


  }, // END add 3D application to the landscape(3D)


  // ONLY FOR DEBUGGIN
  debugPlane(x, y, z, width, height, color1, parent) {

    const material = new THREE.MeshBasicMaterial({
      color: color1,
      opacity: 0.4,
      transparent: true
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      material);

    plane.position.set(x, y, z);
    parent.add(plane);

  }

});
