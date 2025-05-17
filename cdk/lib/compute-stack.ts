// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// For deployment over github actions. 
// .github/workflows/<branch-name>.yml
// 1) git add cdk/lib/compute-stack.yml --> Add changes
// 2) git commit -m "deploy computeComponents" --> Trigger this stack deployment
// 2.5) git commit -m "deploy computeComponents" --allow-empty --> In case no changes were added.
// 3) git push --> Execute pipeline
// The environment will be extracted from the name of the branch where it was triggered. 

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// Resources and components within this stack. 
// - Lambda
//        * eventsServerlessFunction --> API /events Lambda's from cdk/lib/lambda-functions
//        * layoutsServerlessFunction --> API /layouts Lambda's from cdk/lib/lambda-functions
//        * originFunction --> Cloufront Lambda's from cdk/lib/lambda-functions
// - API
//        * apiFunctions --> Main API frontend for lambdas.

import * as cdk from 'aws-cdk-lib';
import { aws_route53 as route53  } from 'aws-cdk-lib';
import { aws_ssm as ssm  } from 'aws-cdk-lib';
import { aws_iam as iam  } from 'aws-cdk-lib';
import { aws_ec2 as ec2  } from 'aws-cdk-lib';
import { aws_lambda as lambda  } from 'aws-cdk-lib';
import * as apiI from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as api from '@aws-cdk/aws-apigatewayv2-alpha';
import { aws_dynamodb as dynamodb  } from 'aws-cdk-lib';
import { aws_ecr as ecr  } from 'aws-cdk-lib';



declare const parameterMapping : api.ParameterMapping;
declare const payloadFormatVersion : api.PayloadFormatVersion;

export interface computeProps extends cdk.StackProps {
  readonly environment: string;
  readonly projectName: string;
  readonly vpcID: string;
  readonly domainName: string;

};

export class computeComponents extends cdk.Stack {
    
    // VPC Variables
      private vpc: ec2.IVpc;
      private hostedZone: route53.IHostedZone;
      private publicSubnets: ec2.SelectedSubnets;
      private privateSubnets: ec2.SelectedSubnets;

    // Lambda Functions Variables
      private lambdaSG: ec2.ISecurityGroup;
      private lambdaFunctionEvents: lambda.IFunction;
      private lambdaFunctionLayouts: lambda.IFunction;
      private originRequestFunction: lambda.IFunction;

    // DynamoDB Variables
      private dynamoDBEvents: dynamodb.ITable;
      private dynamoDBLayouts: dynamodb.ITable;
      private hashKeyElementNameParam: cdk.CfnParameter;
      private hashKeyElementTypeParam: cdk.CfnParameter;
      private readCapacityUnitsParam: cdk.CfnParameter;
      private writeCapacityUnitsParam: cdk.CfnParameter;

    // API Gateway Variables
      private apiFunctions: api.HttpApi;


    // ECR Variables
      private repository: ecr.IRepository;



    constructor(scope: cdk.App, id: string, props: computeProps ) {
       
       super(scope, id, props);
       const { environment } = props;
       const { projectName }  = props;
       const { domainName }  = props;
       const { vpcID }  = props;

      // -------------------    Virtual Private Network   ---------------
      // ----------------------------------------------------------------

        this.vpc = ec2.Vpc.fromLookup(this, `${projectName}_vpc_main`, { vpcId: vpcID, isDefault: false,});

        this.publicSubnets = this.vpc.selectSubnets(
          {
          subnetType: ec2.SubnetType.PUBLIC
          }
        );

        this.privateSubnets = this.vpc.selectSubnets(
          {
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
          }
        );

      // ----------------------------------------------------------------

      // -----------------------    DNS Domain   ------------------------
      // ----------------------------------------------------------------

      // Reference zone from .github/workflows/<branch>.yml
      // Property "PROJECT_DOMAIN"

        //this.hostedZone = route53.HostedZone.fromLookup(this, `${projectName}_hostedZone_main`, { domainName:domainName});

      // ----------------------------------------------------------------

      // -------------------    LAMBDA Functions   ----------------------
      // ----------------------------------------------------------------


        const lambdaSG = () => {

          const SG = new ec2.SecurityGroup( this,`${projectName}_lambdaSG_${environment}`, {
              vpc: this.vpc,
              allowAllOutbound: true,
              description: 'security group for fargate task definition',
              securityGroupName: `${projectName}_lambdaSG_${environment}`,
            });
        
          SG.addIngressRule(
              ec2.Peer.ipv4('10.0.0.0/16'),
              ec2.Port.allTraffic(),
              'allow access from anywherelocalnetwork',
          );
        
          SG.addIngressRule(
              ec2.Peer.anyIpv4(),
              ec2.Port.tcp(80),
              'allow HTTP traffic from anywhere',
          );
        
          SG.addIngressRule(
              ec2.Peer.anyIpv4(),
              ec2.Port.tcp(443),
              'allow HTTPS traffic from anywhere',
          );

          new ssm.StringParameter(this, `${projectName}_lambdaSGID_${environment}`, {
            parameterName: `${projectName}_lambdaSGID_${environment}`,
            stringValue:  SG.securityGroupId,
          });


          return SG;
        
          // SG.addIngressRule(
          //     ec2.Peer.ipv4('123.123.123.123/16'),
          //     ec2.Port.allIcmp(),
          //     'allow ICMP traffic from a specific IP range',
          //   );

        };

        this.lambdaSG = lambdaSG();

        const lambdaPolicy = new iam.PolicyStatement();
        lambdaPolicy.addActions("s3:*");
        lambdaPolicy.addActions("rds:*");
        lambdaPolicy.addActions("dynamodb:*");
        lambdaPolicy.addResources("*");

        const eventsServerlessFunction = () => {

          let eventsFunction = new lambda.Function(this, `${projectName}_eventsLambda_${environment}`, {
            code: lambda.Code.fromAsset('lib/lambda-functions/eventsFunction'),
            functionName: `${projectName}_eventsFunction_${environment}`,
            handler: 'index.handler',
            memorySize: 1024,
            runtime: lambda.Runtime.NODEJS_14_X,
            timeout: cdk.Duration.seconds(300),
            securityGroups: [this.lambdaSG],
            vpc: this.vpc,
          });

          eventsFunction.addToRolePolicy (lambdaPolicy);

          cdk.Tags.of(eventsFunction).add('apiPath', 'events');

          eventsFunction.node.addDependency(this.vpc);

          return eventsFunction;

        };

        this.lambdaFunctionEvents = eventsServerlessFunction();

        const layoutsServerlessFunction = () => {

          let layoutsFunction = new lambda.Function(this, `${projectName}_layoutsLambda_${environment}`, {
            code: lambda.Code.fromAsset('lib/lambda-functions/layoutsFunction'),
            functionName: `${projectName}_layoutsFunction_${environment}`,
            handler: 'index.handler',
            memorySize: 1024,
            runtime: lambda.Runtime.NODEJS_14_X,
            timeout: cdk.Duration.seconds(300),
            securityGroups: [this.lambdaSG],
            vpc: this.vpc,

          });

          layoutsFunction.addToRolePolicy (lambdaPolicy);

          cdk.Tags.of(layoutsFunction).add('apiPath', 'layouts');

          layoutsFunction.node.addDependency(this.vpc);

          return layoutsFunction;

        };

        this.lambdaFunctionLayouts = layoutsServerlessFunction();

        const originFunction = () => {

          let originRequestFunction = new lambda.Function(this, `${projectName}_originRequestLambda_${environment}`, {
            code: lambda.Code.fromAsset('lib/lambda-functions/originRequestFunction'),
            functionName: `${projectName}_originRequestFunction_${environment}`,
            handler: 'index.handler',
            memorySize: 1024,
            runtime: lambda.Runtime.NODEJS_14_X,
            timeout: cdk.Duration.seconds(300),
            securityGroups: [this.lambdaSG],
            vpc: this.vpc,
          });

          originRequestFunction.node.addDependency(this.vpc);

          return originRequestFunction;

        };

        this.originRequestFunction = originFunction();

      // ----------------------------------------------------------------

      // ---------------------    API Gateway   -------------------------
      // ----------------------------------------------------------------



        this.apiFunctions = new api.HttpApi(this, `${projectName}_apiFunctions_${environment}`, {
          apiName: `${projectName}_apiFunctions_${environment}`,
          corsPreflight: {
            allowHeaders: [
                'Authorization',
                'content-type',
                'referer',
                'accept',
                'user-agent',
                'crossdomain',
            ],
            allowMethods: [
              api.CorsHttpMethod.GET,
              api.CorsHttpMethod.DELETE,
              api.CorsHttpMethod.OPTIONS,
              api.CorsHttpMethod.POST,
              api.CorsHttpMethod.PUT,
            ],
            allowOrigins: ['*'],
            allowCredentials: false,
            // maxAge: Duration.seconds(60),
          },
        });

        // new route53.CnameRecord(this, `${projectName}_apiFunctionsCNAM_${environment}`, {
        //   recordName: `${projectName}_apiFunctionsCNAM_${environment}`,
        //   zone:this.hostedZone,
        //   domainName: `${environment}-api.${domainName}`,
        // });

        // Setting up Lambda permissions
        const apiPrincipal = new iam.ServicePrincipal('apigateway.amazonaws.com');

        new ssm.StringParameter(this, `${projectName}_apiURL_${environment}`, {
          parameterName: `${projectName}_apiURL_${environment}`,
          stringValue: `${this.apiFunctions.url}`,
        });

        const apiEventsLambdaFunction = () => {
          

          this.lambdaFunctionEvents.grantInvoke(apiPrincipal);

          const httpLmabdaIntegrationEvents = new apiI.HttpLambdaIntegration( `${projectName}_eventsLambdaApiIntegration_${environment}`, this.lambdaFunctionEvents);
          

          this.apiFunctions.addRoutes({
            path: '/events',
            methods: [api.HttpMethod.GET,api.HttpMethod.OPTIONS,api.HttpMethod.POST],
            integration: httpLmabdaIntegrationEvents,
          });

          this.apiFunctions.addRoutes({
            path: '/events/{id}',
            methods: [api.HttpMethod.GET,api.HttpMethod.OPTIONS,api.HttpMethod.POST,api.HttpMethod.PUT,api.HttpMethod.DELETE],
            integration: httpLmabdaIntegrationEvents,
          });

          this.apiFunctions.addRoutes({
            path: '/events/{id}/{proxy+}',
            methods: [api.HttpMethod.ANY],
            integration: httpLmabdaIntegrationEvents,
          });

          this.apiFunctions.addRoutes({
            path: '/events/{proxy+}',
            methods: [api.HttpMethod.ANY],
            integration: httpLmabdaIntegrationEvents,
          });



        }

        apiEventsLambdaFunction();


        const apiLayoutsLambdaFunction = () => {

          this.lambdaFunctionLayouts.grantInvoke(apiPrincipal);
          
          const httpLmabdaIntegrationLayouts = new apiI.HttpLambdaIntegration( `${projectName}_layoutsLambdaApiIntegration_${environment}`, this.lambdaFunctionLayouts);
                        
          this.apiFunctions.addRoutes({
            path: '/layouts',
            methods: [api.HttpMethod.GET,api.HttpMethod.OPTIONS,api.HttpMethod.POST],
            integration: httpLmabdaIntegrationLayouts,
          });


          this.apiFunctions.addRoutes({
            path: '/layouts/{id}',
            methods: [
              api.HttpMethod.GET,
              api.HttpMethod.OPTIONS,
              api.HttpMethod.POST,
              api.HttpMethod.PUT,
              api.HttpMethod.DELETE ],
            integration: httpLmabdaIntegrationLayouts,
          });

          this.apiFunctions.addRoutes({
            path: '/layouts/{id}/{proxy+}',
            methods: [api.HttpMethod.ANY],
            integration: httpLmabdaIntegrationLayouts,
          });

          this.apiFunctions.addRoutes({
            path: '/layouts/{proxy+}',
            methods: [api.HttpMethod.ANY],
            integration: httpLmabdaIntegrationLayouts,
          });


        };

        apiLayoutsLambdaFunction();


      // ----------------------------------------------------------------

      // -----------------------    DYNAMODB   --------------------------
      // ----------------------------------------------------------------

        const dynamoSG = () => {

          const SG = new ec2.SecurityGroup( this,`${projectName}_dynamoSG_${environment}`, {
              vpc: this.vpc,
              allowAllOutbound: true,
              description: 'security group for fargate task definition',
              securityGroupName: `${projectName}_dynamoSG_${environment}`,
            });
        
          SG.addIngressRule(
              ec2.Peer.ipv4('10.0.0.0/16'),
              ec2.Port.allTraffic(),
              'allow access from anywherelocalnetwork',
          );



          new ssm.StringParameter(this, `${projectName}_dynamoSGID_${environment}`, {
            parameterName: `${projectName}_dynamoSGID_${environment}`,
            stringValue: SG.securityGroupId,
          });


          return SG;
        
          // SG.addIngressRule(
          //     ec2.Peer.ipv4('123.123.123.123/16'),
          //     ec2.Port.allIcmp(),
          //     'allow ICMP traffic from a specific IP range',
          //   );

        };


        this.hashKeyElementNameParam = new cdk.CfnParameter(this,`${projectName}_HashKeyElementName_${environment}`, {
          type: 'String',
          description: 'HashType PrimaryKey Name',
          default: 'id',
          allowedPattern: '[a-zA-Z0-9]*',
          minLength: 1,
          maxLength: 2048,
          constraintDescription: 'must contain only alphanumberic characters'
        });

        this.hashKeyElementTypeParam = new cdk.CfnParameter(this, `${projectName}_HashKeyElementType_${environment}`, {
          type: 'String',
          description: 'HashType PrimaryKey Name',
          default: 'S',
          allowedPattern: '[S|N]',
          minLength: 1,
          maxLength: 1,
          constraintDescription: 'must be either S or N'
        });

        this.readCapacityUnitsParam = new cdk.CfnParameter(this, `${projectName}_ReadCapacityUnits_${environment}`, {
          type: 'Number',
          description: 'Provisioned read throughput',
          default: 10,
          minValue: 5,
          maxValue: 10000,
          constraintDescription: 'must be between 5 and 10000'
        });

        this.writeCapacityUnitsParam = new cdk.CfnParameter(this, `${projectName}_WriteCapacityUnits_${environment}`, {
          type: 'Number',
          description: 'Provisioned write throughput',
          default: 10,
          minValue: 5,
          maxValue: 10000,
          constraintDescription: 'must be between 5 and 10000'
        });

        // DynamoDB table for Events

        this.dynamoDBEvents = new dynamodb.Table(this, `${projectName}_dynamodbEvents_${environment}`, {
          partitionKey: {
            name: this.hashKeyElementNameParam.valueAsString,
            type: this.hashKeyElementTypeParam.valueAsString as dynamodb.AttributeType
          },
          readCapacity: this.readCapacityUnitsParam.valueAsNumber,
          writeCapacity: this.writeCapacityUnitsParam.valueAsNumber
        });

        new ssm.StringParameter(this, `${projectName}dynamodbEventsARN${environment}`, {
          parameterName: `${projectName}dynamodbEventsARN${environment}`,
          stringValue: this.dynamoDBEvents.tableArn,
        });


        // DynamoDB table for Layouts

        this.dynamoDBLayouts = new dynamodb.Table(this, `${projectName}_dynamodbLayouts_${environment}`, {
          partitionKey: {
            name: this.hashKeyElementNameParam.valueAsString,
            type: this.hashKeyElementTypeParam.valueAsString as dynamodb.AttributeType
          },
          readCapacity: this.readCapacityUnitsParam.valueAsNumber,
          writeCapacity: this.writeCapacityUnitsParam.valueAsNumber
        });

        new ssm.StringParameter(this, `${projectName}dynamodbLayoutsARN${environment}`, {
            parameterName: `${projectName}dynamodbLayoutsARN${environment}`,
            stringValue: this.dynamoDBLayouts.tableArn,
        });

     // ----------------------------------------------------------------



     // --------------------------    ECR   ----------------------------
     // ----------------------------------------------------------------


        this.repository = new ecr.Repository(this, `${projectName}_ecr_${environment}`, {
          repositoryName: `${projectName}_ecr_${environment}`,
        });

        new ssm.StringParameter(this, `${projectName}_ecrURI_${environment}`, {
          parameterName: `${projectName}_ecrURI_${environment}`,
          stringValue: this.repository.repositoryUri,
        });

        new ssm.StringParameter(this, `${projectName}_ecrARN_${environment}`, {
          parameterName: `${projectName}_ecrARN_${environment}`,
          stringValue: this.repository.repositoryArn,
        });


     // ----------------------------------------------------------------

    };
};

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// For deployment over github actions. 
// .github/workflows/<branch-name>.yml
// 1) git add cdk/lib/compute-stack.yml --> Add changes
// 2) git commit -m "deploy computeComponents" --> Trigger this stack deployment
// 2.5) git commit -m "deploy computeComponents" --allow-empty --> In case no changes were added.
// 3) git push --> Execute pipeline
// The environment will be extracted from the name of the branch where it was triggered. 

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------
// --------------------------- Kanu - Devops - GiancarloMaddaloni -------------------------------------
