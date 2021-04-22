import * as apiGateway from '@aws-cdk/aws-apigatewayv2';
import * as apiGatewayIntegrations from '@aws-cdk/aws-apigatewayv2-integrations';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import * as cdk from '@aws-cdk/core';
import path from 'path';

export class CdkStarterStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 👇 create the User Pool
    const userPool = new cognito.UserPool(this, 'userpool', {
      userPoolName: 'my-user-pool',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      signInAliases: {email: true},
      autoVerify: {email: true},
      passwordPolicy: {
        minLength: 6,
        requireLowercase: false,
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // 👇 create the User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'userpool-client', {
      userPool,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userSrp: true,
        userPassword: true,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      preventUserExistenceErrors: true,
    });

    // 👇 create the Identity Pool
    const identityPool = new cognito.CfnIdentityPool(this, 'identitypool', {
      allowUnauthenticatedIdentities: true,
      identityPoolName: 'my-identity-pool',
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // 👇 create the Lambda that gets the IdentityId
    const cognitoIdFunction = new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'main',
      entry: path.join(__dirname, `/../src/cognito-id/index.ts`),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
        IDENTITY_POOL_ID: identityPool.ref,
      },
    });

    // 👇 create the API with Lambda integration
    const httpApi = new apiGateway.HttpApi(this, 'api', {
      apiName: 'my-api',
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: [
          apiGateway.CorsHttpMethod.OPTIONS,
          apiGateway.CorsHttpMethod.GET,
          apiGateway.CorsHttpMethod.POST,
          apiGateway.CorsHttpMethod.PUT,
          apiGateway.CorsHttpMethod.PATCH,
          apiGateway.CorsHttpMethod.DELETE,
        ],
        allowCredentials: true,
        allowOrigins: ['http://localhost:3000'],
      },
    });

    httpApi.addRoutes({
      path: '/cognitoid',
      methods: [apiGateway.HttpMethod.GET],
      integration: new apiGatewayIntegrations.LambdaProxyIntegration({
        handler: cognitoIdFunction,
      }),
    });

    new cdk.CfnOutput(this, 'region', {value: cdk.Stack.of(this).region});
    new cdk.CfnOutput(this, 'userPoolId', {value: userPool.userPoolId});
    new cdk.CfnOutput(this, 'userPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'apiUrl', {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: httpApi.url!,
    });
  }
}
