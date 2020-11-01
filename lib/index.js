"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class BindDeploymentId {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.hooks = {
      'before:aws:package:finalize:mergeCustomProviderResources': this.bindDeploymentId.bind(this)
    };
  }

  bindDeploymentId() {
    const template = this.serverless.service.provider.compiledCloudFormationTemplate; // Find the deployment resource

    let deploymentId;

    for (const key of Object.keys(template.Resources)) {
      const resource = template.Resources[key];

      if (resource.Type === 'AWS::ApiGateway::Deployment') {
        deploymentId = key;
        break;
      }
    } // Now, replace the reference to the deployment id


    const resources = _lodash.default.get(this.serverless.service, 'resources.Resources', null);

    if (resources) {
      const variableRegex = new RegExp(_lodash.default.get(this.serverless.service, 'custom.deploymentId.variableSyntax', '__deployment__'), 'g');
      this.serverless.service.resources.Resources = this.replaceDeploymentIdReferences(resources, deploymentId, variableRegex);
      const customStages = this.getCustomStages(this.serverless.service);

      if (Object.keys(customStages).length > 0) {
        // We have custom stages. The deployment will also create a stage, so we'll map
        // that to an unused stage instead. The API keys will also need to depend on
        // the stage, instead of the deployment
        template.Resources = this.fixUpDeploymentStage(template.Resources, deploymentId);
        template.Resources = this.fixUpApiKeys(template.Resources, customStages);
      }
    }

    const resourceExtensions = _lodash.default.get(this.serverless.service, 'resources.extensions', null);

    if (resourceExtensions) {
      const variableRegex = new RegExp(_lodash.default.get(this.serverless.service, 'custom.deploymentId.variableSyntax', '__deployment__'), 'g');
      this.serverless.service.resources.extensions = this.replaceDeploymentIdReferences(resourceExtensions, deploymentId, variableRegex);
    }
  }

  replaceDeploymentIdReferences(resources, deploymentId, variableRegex) {
    return JSON.parse(JSON.stringify(resources).replace(variableRegex, deploymentId));
  }

  getCustomStages(service) {
    const resources = _lodash.default.get(service, 'resources.Resources', null);

    if (!resources) {
      return {};
    }

    return _lodash.default.pickBy(resources, resource => {
      return resource.Type === 'AWS::ApiGateway::Stage';
    });
  }

  fixUpDeploymentStage(resources, deploymentId) {
    const newResources = _lodash.default.cloneDeep(resources);

    newResources[deploymentId].Properties.StageName = '__unused_stage__';
    return newResources;
  }

  fixUpApiKeys(resources, stages) {
    const stageKeys = Object.keys(stages);

    const stageToDependOn = _lodash.default.first(stageKeys);

    if (stageKeys.length > 1) {
      this.serverless.cli.log(`Multiple stages detected. The API keys will depend on ${stageToDependOn}`);
    }

    return _lodash.default.mapValues(resources, resource => {
      if (resource.Type === 'AWS::ApiGateway::ApiKey') {
        return { ...resource,
          DependsOn: stageToDependOn
        };
      }

      return resource;
    });
  }

}

exports.default = BindDeploymentId;