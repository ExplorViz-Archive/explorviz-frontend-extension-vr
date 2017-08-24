var path = require('path');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');

module.exports = {
  name: 'explorviz-frontend-plugin-vr',
  
    treeForPublic: function(tree) {
    var assetsTree = new Funnel('public');
    return mergeTrees([tree, assetsTree], {
      overwrite: true
    });
  },

  included: function(app) {
    this._super.included.apply(this, arguments);

    if (app.import) {
      this.importDependencies(app);
    }
  },

  importDependencies: function(app) {
    app.import('vendor/OBJLoader.js');

    app.import('vendor/vr/VRController.js');
    app.import('vendor/vr/VRControls.js');
    app.import('vendor/vr/VREffect.js');
    app.import('vendor/vr/ViveController.js');
    app.import('vendor/vr/WebVR.js');
    app.import('vendor/vr/WebVRCamera.js');

  return app.toTree();
  }
};
