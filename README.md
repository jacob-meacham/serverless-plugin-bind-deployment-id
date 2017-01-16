# serverless-plugin-bind-deployment-id
[![Coverage Status](https://coveralls.io/repos/github/jacob-meacham/serverless-plugin-bind-deployment-id/badge.svg?branch=develop)](https://coveralls.io/github/jacob-meacham/serverless-plugin-bind-deployment-id?branch=develop)
[![Build Status](https://travis-ci.org/jacob-meacham/serverless-plugin-bind-deployment-id.svg?branch=develop)](https://travis-ci.org/jacob-meacham/serverless-plugin-bind-deployment-id)

Bind the serverless deployment to your custom resources like magic! Simply use `__deployment__` in place of anywhere you want the deployment to show up.

# Usage
```yaml

custom:
  myVariable: bar

resources:
  Resources:
    PathMapping:
      Type: AWS::ApiGateway::BasePathMapping
      DependsOn: ApiGatewayStage
      Properties:
        BasePath: analytics
        DomainName: ${self:provider.domain}
        RestApiId:
          Ref: __deployment__
        Stage: ${self:provider.stage}
    __deployment__:
      Properties:
        DataTraceEnabled: true
        MetricsEnabled: true
    ApiGatewayStage:
      Type: AWS::ApiGateway::Stage
      Properties:
        DeploymentId:
          Ref: __deployment__
        Variables: [${self:custom.myVariable}]
        MethodSettings:
          - DataTraceEnabled: false
            HttpMethod: "GET"
            LoggingLevel: INFO
            ResourcePath: "/foo"
            MetricsEnabled: false
plugins:
  - serverless-plugin-bind-deployment-id
```

When built, this will merge the custom properties set above with the default CloudFormation template, allowing you to apply custom properties to your Deployment or Stage. This will even allow you to add multiple Stages!

## Advanced Usage
By default `__deployment__` is the sentinel value which is replaced by the API Deployment Id. This is configurable. If you'd like to use a different value, you can set:

```yaml
custom:
  deploymentId:
    variableSyntax: ApiGatewayDeployment
```

In this example, any instance of ApiGatewayDeployment in your custom resources will be replaced with the true deployment Id.
