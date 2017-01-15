# serverless-plugin-bind-deployment-id
Bind the serverless deployment to your custom resources like magic!

# Usage
```yaml

custom:
  stageVariables:
    bucket_name: ${env.BUCKET_NAME}
    endpoint: { "Fn::GetAtt": "CloudFrontEndpoint.DomainName" }
    foo: bar

resources:
  Resources:
    PathMapping:
      Type: AWS::ApiGateway::BasePathMapping
      DependsOn: ApiGatewayStage
      Properties:
        BasePath: analytics
        DomainName: ${self:provider.domain}
        RestApiId:
          Ref: ApiGatewayRestApi{{deploy:deploymentId}}
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
