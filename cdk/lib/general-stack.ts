// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// For deployment over github actions. 
// .github/workflows/<branch-name>.yml
// 1) git add cdk/lib/general-stack.yml --> Add changes
// 2) git commit -m "deploy generalComponents" --> Trigger this stack deployment
// 2.5) git commit -m "deploy generalComponents" --allow-empty --> In case no changes were added.
// 3) git push --> Execute pipeline
// The environment will be extracted from the name of the branch where it was triggered. 

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// Resources and components within this stack. 
// - Certificate
//        * certificate --> Main Certificate request pulled from <PROJECT_DOMAIN> within .github/workflows/<branch-name>.yml
// - ECR
//        * repository --> Image Repository.
// - S3
//        * bucket --> s3 bucket for loggin. 


import * as cdk from 'aws-cdk-lib';
import { aws_route53 as route53  } from 'aws-cdk-lib';
import { aws_ssm as ssm  } from 'aws-cdk-lib';
import { aws_certificatemanager as acm  } from 'aws-cdk-lib';
import { aws_s3 as s3  } from 'aws-cdk-lib';
import { aws_ecr as ecr  } from 'aws-cdk-lib';


export interface generalProps extends cdk.StackProps {
  readonly environment: string;
  readonly projectName: string;
  readonly domainName: string;
};



export class generalComponents extends cdk.Stack {

    // Certificates Variables
      private certificate: acm.ICertificate;
      private hostedZone: route53.IHostedZone;

    // ECR Variables
      private repository: ecr.IRepository;

    // S3 Variables
      private bucket: s3.IBucket;


    

    constructor(scope: cdk.App, id: string, props: generalProps ) {
       
       super(scope, id, props);
       const { environment } = props;
       const { projectName }  = props;
       const { domainName }  = props;

    // -----------------------    DNS Domain   ------------------------
    // ----------------------------------------------------------------

    // Reference zone from .github/workflows/<branch>.yml
    // Property "PROJECT_DOMAIN"

      this.hostedZone = route53.HostedZone.fromLookup(this, `${projectName}_hostedZone_main`, { domainName:domainName});


    // ----------------------------------------------------------------

    // ------------------------    CERTIFICATE   ----------------------   
    // ---------------------------------------------------------------- 
 

      this.hostedZone = route53.HostedZone.fromLookup(this, `${projectName}_hostedZone_${environment}`, { domainName:domainName});

    
      this.certificate = new acm.Certificate(this, `${projectName}_certificate_${environment}`, {
        domainName: `${environment}.${projectName}.${domainName}`,
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
      });
  
      new ssm.StringParameter(this, `${projectName}_acmARN_${environment}`, {
          parameterName: `${projectName}_acmARN_${environment}`,
          stringValue: this.certificate.certificateArn,
        });
  
      new ssm.StringParameter(this, `${projectName}_hostedZoneID_${environment}`, {
          parameterName: `${projectName}_hostedZoneID_${environment}`,
          stringValue: this.hostedZone.hostedZoneId,
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

    // -----------------------    S3 Buckets   ------------------------
    // ----------------------------------------------------------------
       

      this.bucket = new s3.Bucket(this, `${projectName}_${environment}`,{
        bucketName: `${projectName}-s3-${environment}`
      });

      new ssm.StringParameter(this, `${projectName}_s3ARN_${environment}`, {
        parameterName: `${projectName}-s3-${environment}`,
        stringValue: this.bucket.bucketArn,
      });
    };

};

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// For deployment over github actions. 
// .github/workflows/<branch-name>.yml
// 1) git add cdk/lib/general-stack.yml --> Add changes
// 2) git commit -m "deploy generalComponents" --> Trigger this stack deployment
// 2.5) git commit -m "deploy generalComponents" --allow-empty --> In case no changes were added.
// 3) git push --> Execute pipeline
// The environment will be extracted from the name of the branch where it was triggered. 

// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------
// --------------------------- Kanu - Devops - GiancarloMaddaloni -------------------------------------
