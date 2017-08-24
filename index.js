var path = require('path');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');

module.exports = {
  name: 'explorviz-frontend-plugin-vr',

  treeForVendor: function(tree) {
    var packagePath = path.dirname(require.resolve('three-obj-loader'));
    var packageTree = new Funnel(this.treeGenerator(packagePath), {
      srcDir: '/',
      destDir: 'three-obj-loader'
    });

    return mergeTrees([tree, packageTree]);
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
