
// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// For deployment over github actions. 
// .github/workflows/<branch-name>.yml
// 1) git add cdk/lib/application-stack.yml --> Add changes
// 2) git commit -m "deploy applicationComponetns" --> Trigger this stack deployment
// 2.5) git commit -m "deploy applicationComponents" --allow-empty --> In case no changes were added.
// 3) git push --> Execute pipeline
// The environment will be extracted from the name of the branch where it was triggered. 

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// Resources and components within this stack. 
// - ECS
//        * alb --> 
//        * ecsCluster --> 
//        * fargateTask --> 
//        * container --> 
//        * loadBalancedFargateService --> 
//        * scalableTarget --> 
//        * fargateTaskRole --> 
//        * ecsSecurityGroup --> 


import * as cdk from 'aws-cdk-lib';
import { aws_route53 as route53  } from 'aws-cdk-lib';
import { aws_ssm as ssm  } from 'aws-cdk-lib';
import { aws_iam as iam  } from 'aws-cdk-lib';
import { aws_ecs as ecs  } from 'aws-cdk-lib';
import { aws_ec2 as ec2  } from 'aws-cdk-lib';
import { aws_ecr as ecr  } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as alb  } from 'aws-cdk-lib';
import { aws_ecs_patterns as ecs_patterns  } from 'aws-cdk-lib';
import { aws_certificatemanager as acm  } from 'aws-cdk-lib';

export interface applicationProps extends cdk.StackProps {
  readonly environment: string;
  readonly projectName: string;
  readonly imageTag: string;
  readonly domainName: string;
  readonly vpcID: string;
  readonly acmARN: string;
};



export class applicationComponents extends cdk.Stack {
    

    // VPC Variables
      private vpc: ec2.IVpc;
      private hostedZone: route53.IHostedZone;
      private publicSubnets: ec2.SelectedSubnets;
      private privateSubnets: ec2.SelectedSubnets;


    // ECS Components Variables
      private taskRole: iam.IRole; 
      private appimageRepository: ecr.IRepository;
      private webappImage: ecs.ContainerImage;
      private container: ecs.ContainerDefinition;
      private fargateTask: ecs.FargateTaskDefinition;
      private ecsCluster: ecs.ICluster;
      private alb: alb.IApplicationLoadBalancer;
      private albSG:  ec2.ISecurityGroup;;
      private fargateTaskSG: ec2.ISecurityGroup;
      private certificate: acm.ICertificate;


      
    constructor(scope: cdk.App, id: string, props: applicationProps ) {
       
       super(scope, id, props);
       const { environment } = props;
       const { projectName }  = props;
       const { imageTag }  = props;
       const { domainName }  = props;
       const { vpcID }  = props;
       const { acmARN }  = props;


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

        // this.hostedZone = route53.HostedZone.fromLookup(this, `${projectName}_hostedZone_main`, { domainName:domainName});

      // ----------------------------------------------------------------

      // --------------------------    ECS   ----------------------------
      // ----------------------------------------------------------------


      // Deployment variables.
      // ---------------------------

        this.appimageRepository = ecr.Repository.fromRepositoryName(this, `${projectName}_ecr_${environment}`, `${projectName}_ecr_${environment}`);
        this.webappImage = new ecs.EcrImage(this.appimageRepository, `${imageTag}`);

        // this.certificate = acm.Certificate.fromCertificateArn(this, `${projectName}_acm_${environment}`, acmARN);

      // Security Groups
      // ---------------------------


        const albSG = () => {
        
          const SG = new ec2.SecurityGroup( this,`${projectName}_albSG_${environment}`, {
              vpc: this.vpc,
              allowAllOutbound: true,
              description: 'security group for an application load balancer',
              securityGroupName: `${projectName}_alb_${environment}`,
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

          new ssm.StringParameter(this, `${projectName}_albSGID_${environment}`, {
            parameterName: `${projectName}_albSGID_${environment}`,
            stringValue:  SG.securityGroupId,
          });


          return SG;
        
          // SG.addIngressRule(
          //     ec2.Peer.ipv4('123.123.123.123/16'),
          //     ec2.Port.allIcmp(),
          //     'allow ICMP traffic from a specific IP range',
          //   );

        };

        this.albSG = albSG();

        const fargateTaskSG = () => {

          const SG = new ec2.SecurityGroup( this,`${projectName}_fargateTaskSG_${environment}`, {
              vpc: this.vpc,
              allowAllOutbound: true,
              description: 'security group for fargate task definition',
              securityGroupName: `${projectName}_fargateTaskSG_${environment}`,
            });
        
          SG.addIngressRule(
              ec2.Peer.ipv4('10.0.0.0/16'),
              ec2.Port.allTraffic(),
              'allow access from anywherelocalnetwork',
          );
        
          // SG.addIngressRule(
          //     ec2.Peer.anyIpv4(),
          //     ec2.Port.tcp(80),
          //     'allow HTTP traffic from anywhere',
          // );
        
          // SG.addIngressRule(
          //     ec2.Peer.anyIpv4(),
          //     ec2.Port.tcp(443),
          //     'allow HTTPS traffic from anywhere',
          // );


          SG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(2049),
            'allow EFS traffic from anywhere',
          );

          new ssm.StringParameter(this, `${projectName}_fargateTaskSGID_${environment}`, {
            parameterName: `${projectName}_fargateTaskSGID_${environment}`,
            stringValue:  SG.securityGroupId,
          });


          return SG;
        
          // SG.addIngressRule(
          //     ec2.Peer.ipv4('123.123.123.123/16'),
          //     ec2.Port.allIcmp(),
          //     'allow ICMP traffic from a specific IP range',
          //   );

        };

        this.fargateTaskSG = fargateTaskSG();

      // Task Role Creation
      // ---------------------------


        this.taskRole = new iam.Role(this, `${projectName}_fargateTaskRole_${environment}`, {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'),
          ],
        });

        this.taskRole.attachInlinePolicy(
          new iam.Policy(this,`${projectName}_EFSfargateTaskPolicy_${environment}`, {
            statements : [ new iam.PolicyStatement({
              actions: [
                'elasticfilesystem:ClientRootAccess',
                'elasticfilesystem:ClientWrite',
                'elasticfilesystem:ClientMount',
                'elasticfilesystem:DescribeMountTargets',
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              resources: ['*']
            })]
          })
        );

      
      // Main ALB for ECS Cluster.
      // ---------------------------

        this.alb = new alb.ApplicationLoadBalancer(this, `${projectName}_alb_${environment}`, 
        { 
          loadBalancerName: `${projectName}-alb-${environment}`,
          ipAddressType: alb.IpAddressType.IPV4,
          vpc:this.vpc,
          http2Enabled: true,
          vpcSubnets: this.publicSubnets,
          internetFacing: true, 
          securityGroup: this.albSG,
        
        });

        cdk.Aspects.of(this.alb).add(new cdk.Tag('Name', `${projectName}alb${environment}`));


        new cdk.CfnOutput(this, `${projectName}-albOutput-${environment}`, {
          value: this.alb.loadBalancerDnsName,
          description: 'Default Application DNS record',
          exportName: `${projectName}-alb-${environment}`,
        });

      // Main ECS Cluster.
      // ---------------------------

        this.ecsCluster = new ecs.Cluster(this, `${projectName}_ecs_${environment}`, {
            vpc: this.vpc,
            clusterName: `${projectName}_ecs_${environment}`,
            containerInsights: true,
            enableFargateCapacityProviders: true,
    
        });
    
      // Main Fargate Task definition.
      // ---------------------------

        this.fargateTask = new ecs.FargateTaskDefinition(this, `${projectName}_fargateTask_${environment}`, {
            memoryLimitMiB: 1024,
            cpu: 512,
            executionRole: this.taskRole,
            family: `${projectName}_${environment}`,
        });

      // Container configuration.
      // ---------------------------

        this.container = this.fargateTask.addContainer(`${projectName}_appContainer_${environment}`, {
          image: this.webappImage,
          portMappings: [
            {
              hostPort: 80, 
              containerPort: 80
            },],
          logging: ecs.LogDrivers.awsLogs({
            streamPrefix: `${projectName}_logs_${environment}`,
          }),
          environment: {
            APP_ID: `${projectName}_app_id_${environment}`,
            // DYNAMODB_MESSAGES_TABLE: "",
            // REACT_APP_LAYOUTS_URL: "",
            // REACT_APP_DEFAULT_AXIOS_TIMEOUT: "",
            // REACT_APP_MESSAGING_WSS_URL: "",
            // REACT_APP_DISCREPANCIES_WSS_URL: "",
          },
        });
    
      // Load Balancer for fargate configuration.
      // ---------------------------

        const loadBalancedFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${projectName}_fargateService_${environment}`, {
          serviceName:`${projectName}_fargateService_${environment}`, 
          cluster: this.ecsCluster,
          memoryLimitMiB: 1024,
          desiredCount: 2,
          cpu: 512,
          loadBalancer: this.alb,
          taskSubnets: this.privateSubnets,
          taskDefinition: this.fargateTask,
          securityGroups:  [this.fargateTaskSG],
          certificate: this.certificate,
          // domainName: `${environment}.${projectName}`,
          // domainZone:  this.hostedZone,
          // certificate: this.certificate,
          // domainName: `${environment}.${projectName}`,
          //domainZone:  this.hostedZone,
          // listenerPort: 443,
          redirectHTTP: false, 
          // sslPolicy: ,
        
        });

        loadBalancedFargateService.node.addDependency(this.container);

        // The port for the healthcheck must be a 401, since the NGINX authentication is taking place first.
        loadBalancedFargateService.targetGroup.configureHealthCheck({
          path: "/",
          healthyHttpCodes: "200"
        });


      // Auto-scaling configuration.
      // ---------------------------

        const scalableTarget = loadBalancedFargateService.service.autoScaleTaskCount({
          minCapacity: 2,
          maxCapacity: 6,
        });
        
        scalableTarget.scaleOnCpuUtilization('CpuScaling', {
          targetUtilizationPercent: 50,
        });
        
        scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
          targetUtilizationPercent: 50,
        });

      // ---------------------------

    

      // -------------------------------------------------------- 

    };


};


// For deployment over github actions. 
// .github/workflows/<branch-name>.yml
// 1) git add cdk/lib/application-stack.yml --> Add changes
// 2) git commit -m "deploy applicationComponetns" --> Trigger this stack deployment
// 2.5) git commit -m "deploy applicationComponents" --allow-empty --> In case no changes were added.
// 3) git push --> Execute pipeline
// The environment will be extracted from the name of the branch where it was triggered. 

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------
// --------------------------- Kanu - Devops - GiancarloMaddaloni -------------------------------------
