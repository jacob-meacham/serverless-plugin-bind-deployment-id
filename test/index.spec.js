import test from 'ava'
import _ from 'lodash'

import BindDeploymentId from '../src'

function buildServerless() {
  return {
    cli: { log: console.log },
    service: {
      provider: { },
      custom: {
        bindDeploymentId: { }
      }
    }
  }
}

function defaultCompiledCloudFormation() {
  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Resources: {
      ApiGatewayRestApi: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: 'test-api'
        }
      },
      ApiGatewayDeployment1484416530047: {
        Type: 'AWS::ApiGateway::Deployment',
        Properties: {
          RestApiId: {
            Ref: 'ApiGatewayRestApi'
          },
          StageName: 'staging'
        },
        DependsOn: ['a', 'b', 'c']
      }
    }
  }
}

test('bindDeploymentId#noCustomResources', t => {
  const serverless = buildServerless()
  serverless.service.provider.compiledCloudFormationTemplate = defaultCompiledCloudFormation()
  const originalTemplate = _.cloneDeep(serverless.service.provider.compiledCloudFormationTemplate)

  const plugin = new BindDeploymentId(serverless, {})
  plugin.bindDeploymentId()
  t.deepEqual(serverless.service.provider.compiledCloudFormationTemplate, originalTemplate)
})

test('bindDeploymentId#default', t => {
  const serverless = buildServerless()
  serverless.service.provider.compiledCloudFormationTemplate = defaultCompiledCloudFormation()
  serverless.service.resources = {
    Resources: {
      ApiGatewayStage: {
        DependsOn: '__deployment__',
        Type: 'AWS::ApiGateway::Stage',
        Properties: {
          MethodSettings: []
        }
      },
      __deployment__: {
        Properties: {
          DataTraceEnabled: true,
          MetricsEnabled: true
        }
      }
    }
  }

  const plugin = new BindDeploymentId(serverless, {})
  plugin.bindDeploymentId()

  t.is(serverless.service.provider.compiledCloudFormationTemplate.Resources.ApiGatewayDeployment1484416530047.Properties.StageName, '__unused_stage__')
  t.is(serverless.service.resources.Resources.ApiGatewayStage.DependsOn, 'ApiGatewayDeployment1484416530047')
  t.deepEqual(serverless.service.resources.Resources.ApiGatewayDeployment1484416530047, {
    Properties: {
      DataTraceEnabled: true,
      MetricsEnabled: true
    }
  })
})

test('bindDeploymentId#noCustomStages', t => {
  const serverless = buildServerless()
  serverless.service.provider.compiledCloudFormationTemplate = defaultCompiledCloudFormation()
  const originalTemplate = _.cloneDeep(serverless.service.provider.compiledCloudFormationTemplate)

  serverless.service.resources = {
    Resources: {
      __deployment__: {
        Properties: {
          DataTraceEnabled: true,
          MetricsEnabled: true
        }
      }
    }
  }

  const plugin = new BindDeploymentId(serverless, {})
  plugin.bindDeploymentId()

  t.deepEqual(serverless.service.provider.compiledCloudFormationTemplate, originalTemplate)
})

test('replaceDeploymentIdReferences#references', t => {
  const plugin = new BindDeploymentId(buildServerless(), {})

  const toReplace = {
    __deployment__: {
      a: [],
      b: {
        c: ['__deployment__']
      }
    }
  }

  const expected = {
    foo: {
      a: [],
      b: {
        c: ['foo']
      }
    }
  }

  const actual = plugin.replaceDeploymentIdReferences(toReplace, 'foo', /__deployment__/g)

  t.deepEqual(actual, expected)
})

test('fixUpApiKeys#oneStage', t => {
  const plugin = new BindDeploymentId(buildServerless(), {})

  const resources = {
    A: {
      Type: 'AWS::ApiGateway::ApiKey',
      Properties: { },
      DependsOn: 'DeploymentId'
    },
    B: {
      Type: 'AWS::ApiGateway::ApiStage',
      Properties: { }
    }
  }

  const stages = {
    StageA: {
      Type: 'AWS::ApiGateway::ApiStage'
    }
  }

  const fixedUpResources = plugin.fixUpApiKeys(resources, stages)
  t.is(fixedUpResources.A.DependsOn, 'StageA')
})

test('fixUpApiKeys#multipleStages', t => {
  const plugin = new BindDeploymentId(buildServerless(), {})

  const resources = {
    A: {
      Type: 'AWS::ApiGateway::ApiKey',
      Properties: { },
      DependsOn: 'DeploymentId'
    },
    B: {
      Type: 'AWS::ApiGateway::ApiStage',
      Properties: { }
    }
  }

  const stages = {
    StageA: {
      Type: 'AWS::ApiGateway::ApiStage'
    },
    AStageB: {
      Type: 'AWS::ApiGateway::ApiStage'
    }
  }

  const fixedUpResources = plugin.fixUpApiKeys(resources, stages)
  t.is(fixedUpResources.A.DependsOn, 'StageA')
})

test('getCustomStages#noResources', t => {
  const serverless = buildServerless()
  const plugin = new BindDeploymentId(serverless, {})

  t.deepEqual(plugin.getCustomStages(serverless.service), {})
})

test('getCustomStages#noStages', t => {
  const serverless = buildServerless()
  serverless.service.resources = {
    Resources: {
      A: {
        Type: 'AWS::ApiGateway::ApiKey'
      },
      B: {
        Type: 'AWS::ApiGateway::Deployment'
      }
    }
  }
  const plugin = new BindDeploymentId(serverless, {})

  t.deepEqual(plugin.getCustomStages(serverless.service), {})
})

test('getCustomStages#stages', t => {
  const serverless = buildServerless()
  const expectedStages = {
    A: {
      Type: 'AWS::ApiGateway::Stage',
      Properties: {}
    },
    C: {
      Type: 'AWS::ApiGateway::Stage',
      Properties: {}
    }
  }

  serverless.service.resources = {
    Resources: { ...expectedStages, B: { Type: 'AWS::ApiGateway::Deployment' } }
  }

  const plugin = new BindDeploymentId(serverless, {})

  const stages = plugin.getCustomStages(serverless.service)
  t.deepEqual(stages, expectedStages)
})
