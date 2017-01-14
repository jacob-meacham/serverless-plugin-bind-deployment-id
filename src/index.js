import _ from 'lodash'

export class DeplyomentId {
  constructor(serverless) {
    this.serverless = serverless
    this.hooks = {
      'before:deploy:deploy': this.bindDeploymentId.bind(this)
    }
  }

  bindDeploymentId() {
    const template = this.serverless.service.provider.compiledCloudFormationTemplate

    // Find the deployment resource
    let deploymentId
    for (let key of Object.keys(template.Resources)) {
      const resource = template.Resources[key]
      if (resource.Type === 'AWS::ApiGateway::Deployment') {
        deploymentId = key
        break
      }
    }

    // Now, replace the reference to the deployment id
    const resources = _.get(this.serverless.service, 'resources.Resources', null)
    if (resources) {
      const variableRegex = new RegExp(_.get(this.serverless.service, 'custom.deploymentId.variableSyntax', '{{.*}}'), 'g')
      this.serverless.service.resources.Resources = this.replaceDeploymentIdReferences(resources, deploymentId, variableRegex)

      const customStages = this.getCustomStages(this.serverless.service)
      if (customStages.length > 0) {
        // We have custom stages. The deployment will also create a stage, so we'll map
        // that to an unused stage instead. The API keys will also need to depend on
        // the stage, instead of the deployment
        template.Resources = this.fixUpDeploymentStage(template.Resources, deploymentId)
        template.Resources = this.fixUpApiKeys(template.Resources, customStages)
      }
    }
  }

  replaceDeploymentIdReferences(resources, deploymentId, variableRegex) {
    if (!resources) {
      return null
    }

    return JSON.parse(JSON.stringify(resources).replace(variableRegex))
  }

  getCustomStage(service) {
    const resources = _.get(service, 'resources.Resources', null)
    if (!resources) {
      return []
    }

    return _.filter(resources, (resource) => {
      return resource.Type === 'AWS:ApiGateway::Stage'
    })
  }

  fixUpDeploymentStage(resources, deploymentId) {
    const newResources = _.cloneDeep(resources)
    newResources[deploymentId].Properties.StageName = '__unused_stage__'

    return newResources
  }

  fixUpApiKeys(resources, stages) {
    const dependOnStage = _.first(Object.keys(stages))
    if (stages.length > 1) {
      this.serverless.cli.log(`Multiple stages detected. The API keys will depend on ${dependOnStage}`)
    }

    return _.mapValues(resources, (resource) => {
      if (resource['Type'] === 'AWS::ApiGateway::ApiKey') {
        return { ...resource, DependsOn: dependOnStage }
      }
      return resource
    })
  }
}
