import EmberObject from '@ember/object';
import Evented from '@ember/object/evented';

/*
 *  This util is used to define the important information  
 *  about a given entity of the landscape or 3D-application
 *  and return them as an array.
 *
 */
export default EmberObject.extend(Evented, {

  alreadyDestroyed: true,
  enableTooltips: true,

  /*
   *  The following function is used to detect the
   *  type of entity and handle it
   */
  buildContent(emberModel) {
    let content = { title: '', innerContent: "" };

    const modelType = emberModel.constructor.modelName;

    // Build information for landscape 
    if (modelType === 'application') {
      content = buildApplicationContent(emberModel);
    }
    else if (modelType === 'system') {
      content = buildSystemContent(emberModel);
    }
    else if (modelType === 'node') {
      content = buildNodeContent(emberModel);
    }
    else if (modelType === 'nodegroup') {
      content = buildNodegroupContent(emberModel);
    }
    // Build information for application3D
    else if (modelType === 'component') {
      content = buildComponentContent(emberModel);
    }
    else if (modelType === 'clazz') {
      content = buildClazzContent(emberModel);
    }
    else if (modelType === 'drawableclazzcommunication') {
      content = buildDrawableclasscommunicationContent(emberModel);
    }
    else if (modelType === 'applicationcommunication') {
      content = buildApplicationcommunicationContent(emberModel);
    }

    return content;

    // Helper functions landscape

    /*
     *  This function is used to build the information about 
     *  applications
     */
    function buildApplicationContent(application) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "" };

      content.innerContent.entry1 = { name1: 'Last Usage:', value1: "" };
      content.innerContent.entry2 = { name2: 'Language:', value2: "" };

      content.title = application.get('name');

      const year = new Date(application.get('lastUsage')).toLocaleString();

      content.innerContent.entry1.value1 = year;
      content.innerContent.entry2.value2 = application.get('programmingLanguage');

      return content;
    }

    /*
     *  This function is used to build the information about 
     *  systems
     */
    function buildSystemContent(system) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "" };

      content.innerContent.entry1 = { name1: 'Nodes:', value1: "" };
      content.innerContent.entry2 = { name2: 'Applications:', value2: "" };

      content.title = system.get('name');

      var nodesCount = 0;
      var applicationCount = 0;

      // Calculate node and application count
      const nodeGroups = system.get('nodegroups');

      nodeGroups.forEach((nodeGroup) => {

        nodesCount += nodeGroup.get('nodes').get('length');

        const nodes = nodeGroup.get('nodes');

        nodes.forEach((node) => {
          applicationCount += node.get('applications').get('length');
        });

      });

      content.innerContent.entry1.value1 = nodesCount;
      content.innerContent.entry2.value2 = applicationCount;

      return content;
    }

    /*
     *  This function is used to build the information about 
     *  nodes
     */
    function buildNodeContent(node) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "", entry3: "" };

      content.innerContent.entry1 = { name1: 'CPU Utilization:', value1: "" };
      content.innerContent.entry2 = { name2: 'Free RAM:', value2: "" };
      content.innerContent.entry3 = { name3: 'Total RAM:', value3: "" };

      content.title = node.getDisplayName();

      const formatFactor = (1024 * 1024 * 1024);

      content.innerContent.entry1.value1 = round(node.get('cpuUtilization') * 100, 0) + '%';
      content.innerContent.entry2.value2 = round(node.get('freeRAM') / formatFactor, 2).toFixed(2) + " GB";
      content.innerContent.entry3.value3 = round((node.get('usedRAM') + node.get('freeRAM')) / formatFactor, 2).toFixed(2) + " GB";

      return content;
    }

    /*
     *  This function is used to build the information about 
     *  nodegroups
     */
    function buildNodegroupContent(nodeGroup) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "", entry3: "" };

      content.innerContent.entry1 = { name1: 'Nodes:', value1: "" };
      content.innerContent.entry2 = { name2: 'Applications:', value2: "" };
      content.innerContent.entry3 = { name3: 'Avg. CPU Utilization:', value3: "" };

      content.title = nodeGroup.get('name');

      var avgNodeCPUUtil = 0.0;
      var applicationCount = 0;

      // Calculate node and application count
      const nodes = nodeGroup.get('nodes');

      nodes.forEach((node) => {

        avgNodeCPUUtil += node.get('cpuUtilization');

        applicationCount += node.get('applications').get('length');

      });

      content.innerContent.entry1.value1 = nodes.get('length');
      content.innerContent.entry2.value2 = applicationCount;
      content.innerContent.entry3.value3 = round((avgNodeCPUUtil * 100) / nodes.get('length'), 0) + '%';

      return content;
    } // END Helper function Landscape


    // Helper function application 3D

    /*
     *  This function is used to build the information about 
     *  packages
     */
    function buildComponentContent(component) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "" };

      content.innerContent.entry1 = { name1: 'Contained Classes:', value1: "" };
      content.innerContent.entry2 = { name2: 'Contained Packages:', value2: "" };

      content.title = component.get('name');

      const clazzesCount = getClazzesCount(component);
      const packageCount = getPackagesCount(component);

      content.innerContent.entry1.value1 = clazzesCount;
      content.innerContent.entry2.value2 = packageCount;

      // Inner helper functions
      function getClazzesCount(component) {
        let result = component.get('clazzes').get('length');

        const children = component.get('children');

        children.forEach((child) => {
          result += getClazzesCount(child);
        });

        return result;
      }

      function getPackagesCount(component) {
        let result = component.get('children').get('length');

        const children = component.get('children');

        children.forEach((child) => {
          result += getPackagesCount(child);
        });

        return result;
      } // END inner helper functions landscape

      return content;
    }

    /*
     *  This function is used to build the information about 
     *  clazzes
     */
    function buildClazzContent(clazz) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "" };

      content.innerContent.entry1 = { name1: 'Active Instances:', value1: "" };
      content.innerContent.entry2 = { name2: 'Called Methods:', value2: "" };

      content.title = clazz.get('name');

      const calledMethods = getCalledMethods();

      content.innerContent.entry1.value1 = clazz.get('instanceCount');
      content.innerContent.entry2.value2 = calledMethods;

      return content;

      function getCalledMethods() {
        return 0;
      }

    }

    /*
     *  This function is used to build the information about 
     *  application communication lines
     */
    function buildApplicationcommunicationContent(communication) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "", entry3: "" };

      content.innerContent.entry1 = { name1: 'Requests:', value1: "" };
      content.innerContent.entry2 = { name2: 'Technology:', value2: "" };
      content.innerContent.entry2 = { name3: 'Avg. Response Time (ms):', value2: "" };

      content.title = communication.get('sourceApplication').get('name') + " \u2192 " + communication.get('targetApplication').get('name');

      content.innerContent.entry1.value1 = communication.get('requests');
      content.innerContent.entry2.value2 = communication.get('technology');
      content.innerContent.entry3.value3 = round(communication.get('averageResponseTime') / 1000000, 4);

      return content;

    }

    /*
     *  This function is used to build the information about 
     *  class communication lines
     */
    function buildDrawableclasscommunicationContent(communication) {
      let content = { title: '', innerContent: "" };

      content.innerContent = { entry1: '', entry2: "" };

      content.innerContent.entry1 = { name1: 'Requests:', value1: "" };
      content.innerContent.entry2 = { name2: 'Avg. Response Time (ms):', value2: "" };

      content.title = communication.get('sourceClazz').get('name') + " \u2192 " + communication.get('targetClazz').get('name');

      content.innerContent.entry1.value1 = communication.get('requests');
      //content.innerContent.entry2.value2 = round(communication.get('averageResponseTime'), 2);
      content.innerContent.entry2.value2 = round(communication.get('averageResponseTime') / 1000000, 4);

      return content;

    }

    function round(value, precision) {
      let multiplier = Math.pow(10, precision || 0);
      return Math.round(value * multiplier) / multiplier;
    }


    // END helper functions application 3D

  } // END build Content

});
