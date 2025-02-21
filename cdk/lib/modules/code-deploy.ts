import { EnvValues } from "./env/env-values";
import { Construct } from "constructs";
import { EcsApplication, EcsDeploymentGroup } from "aws-cdk-lib/aws-codedeploy";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import {
  ApplicationListener,
  ApplicationTargetGroup,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib";

export interface EcsCodeDeployProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
  readonly ecsService: FargateService;
  readonly blueTargetGroup: ApplicationTargetGroup;
  readonly blueListener: ApplicationListener;
  readonly greenTargetGroup: ApplicationTargetGroup;
  readonly greenListener: ApplicationListener;
}

export class EcsCodeDeploy extends Construct {
  constructor(scope: Construct, id: string, props: EcsCodeDeployProps) {
    super(scope, id);

    const {
      namePrefix,
      ecsService,
      blueListener,
      blueTargetGroup,
      greenListener,
      greenTargetGroup,
    } = props;

    // CodeDeploy ロール
    const codedeployRole = new Role(this, "CodeDeployRole", {
      assumedBy: new ServicePrincipal("codedeploy.amazonaws.com"),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployFullAccess")],
    });

    const application = new EcsApplication(this, "Application", {
      applicationName: `${namePrefix}-application`,
    });
    new EcsDeploymentGroup(this, "DeploymentGroup", {
      deploymentGroupName: `${namePrefix}-deployment-group`,
      application: application,
      service: ecsService,
      blueGreenDeploymentConfig: {
        deploymentApprovalWaitTime: Duration.minutes(30),
        terminationWaitTime: Duration.minutes(5),
        blueTargetGroup: blueTargetGroup,
        greenTargetGroup: greenTargetGroup,
        listener: blueListener,
        testListener: greenListener,
      },
      autoRollback: {
        failedDeployment: true,
      },
      role: codedeployRole,
    });
  }
}
