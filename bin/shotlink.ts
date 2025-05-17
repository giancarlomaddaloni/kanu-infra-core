#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';

import { computeComponents } from '../cdk/lib/compute-stack';
import { applicationComponents } from '../cdk/lib/application-stack';

const app = new cdk.App();


function validate(parameter: string){
  let variable = `${app.node.tryGetContext(parameter)}`
  if (variable === undefined || !(typeof(variable) === 'string') || variable.trim() === '') {
    throw new Error(`Must pass a '-c parameter=<parameter>' context ${parameter}`);
  }
  return variable;
  
};

function deployComponent(parameter: string){
  let variable = `${app.node.tryGetContext(parameter)}`
  if (variable === undefined || !(typeof(variable) === 'string') || variable.trim() === '') {
    variable='false';
  }
  return variable;
  
};

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// General Variables
let region = validate("region");
let account = validate("account");
let projectName = validate("projectName");
let environment = validate("environment");
let domainName = validate("domainName");
let imageTag = validate("imageTag");
let vpcID = validate("vpcID");
let acmARN = validate("acmARN");



function stacktenant() {

  let stacktenant = `${capitalizeFirstLetter(projectName)}${capitalizeFirstLetter(environment)}`;
  return stacktenant;

};

const application_Components = new applicationComponents(app, `applicationComponents_${environment}`, {
  stackName: `applicationComponents${stacktenant()}`,
  projectName: projectName,
  environment: environment,
  domainName: domainName,
  imageTag: imageTag,
  vpcID: vpcID, 
  acmARN: acmARN, 
  description: "A stack creating a load balancer, secgroups, iamroles, ecs cluster, fargate task and services.",
  env: {
    region: region,
    account: account,
  },
});

const compute_Components = new computeComponents(app, `computeComponents_${environment}`, {
  stackName: `computeComponents${stacktenant()}`,
  projectName: projectName,
  environment: environment,
  domainName: domainName,
  vpcID: vpcID, 
  description: "A stack creating lambda functions, api gateways and dynamoDB tables.",
  env: {
    region: region,
    account: account,
  },
});


app.synth();


// -----------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------
// --------------------------- Kanu - Devops - GiancarloMaddaloni -------------------------------------
