import * as cdk from "aws-cdk-lib";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvValues } from "./modules/env/env-values";
import { setRemovalPolicy } from "./modules/aspect/removal-policy-setter";
import { addCommonTags } from "./modules/aspect/common-tag-setter";
import { Network } from "./modules/network/network";
import { AppSecurityGroups } from "./modules/network/app-security-group";
import { Ecs } from "./modules/app/ecs";
import { LoadBalancer } from "./modules/app/load-balancer";
import { EcsCodeDeploy } from "./modules/code-deploy";

export interface CdkStackProps extends cdk.StackProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
  readonly ecrRepositoryName: string;
  readonly imageTag: string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);

    const { namePrefix, envValues, ecrRepositoryName, imageTag } = props;

    // ネットワークの作成
    const network = new Network(this, "Network", {
      namePrefix,
      envValues,
    });

    // セキュリティグループの作成
    const securityGroup = new AppSecurityGroups(this, "AppSecurityGroups", {
      namePrefix,
      envValues,
      vpc: network.vpc,
    });

    // ECSの作成
    const ecs = new Ecs(this, "Ecs", {
      namePrefix,
      vpc: network.vpc,
      securityGroup: securityGroup.ecsSecurityGroup,
      imageTag: imageTag,
      ecrRepositoryName: ecrRepositoryName,
    });

    // ALBの作成
    const loadBalancer = new LoadBalancer(this, "LoadBalancer", {
      namePrefix,
      envValues,
      vpc: network.vpc,
      albSecurityGroup: securityGroup.albSecurityGroup,
      ecsService: ecs.service,
    });

    const codeDeploy = new EcsCodeDeploy(this, "EcsCodeDeploy", {
      namePrefix,
      envValues,
      ecsService: ecs.service,
      blueTargetGroup: loadBalancer.blueTargetGroup,
      blueListener: loadBalancer.blueListener,
      greenTargetGroup: loadBalancer.greenTargetGroup,
      greenListener: loadBalancer.greenListener,
    });

    new CfnOutput(this, "EcsTaskDefinitionArn", {
      exportName: "EcsTaskDefinitionArn",
      value: ecs.taskDefinition.taskDefinitionArn,
    });

    new CfnOutput(this, "EcsAppContainerName", {
      exportName: "EcsAppContainerName",
      value: ecs.containerDefinition.containerName,
    });

    new CfnOutput(this, "CodeDeployApplicationName", {
      exportName: "CodeDeployApplicationName",
      value: codeDeploy.application.applicationName,
    });

    new CfnOutput(this, "CodeDeployDeploymentConfigName", {
      exportName: "CodeDeployDeploymentConfigName",
      value: codeDeploy.deploymentConfig.deploymentConfigName,
    });

    new CfnOutput(this, "CodeDeployDeploymentGroupName", {
      exportName: "CodeDeployDeploymentGroupName",
      value: codeDeploy.deploymentGroup.deploymentGroupName,
    });

    setRemovalPolicy(this, RemovalPolicy.DESTROY);
    addCommonTags(this, { project: namePrefix, env: envValues.env });
  }
}
