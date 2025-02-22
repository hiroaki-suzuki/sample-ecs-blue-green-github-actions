import { EnvValues } from "./env/env-values";
import { Construct } from "constructs";
import {
  EcsApplication,
  EcsDeploymentConfig,
  EcsDeploymentGroup,
  TimeBasedCanaryTrafficRouting,
} from "aws-cdk-lib/aws-codedeploy";
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
  public readonly application: EcsApplication;
  public readonly deploymentConfig: EcsDeploymentConfig;
  public readonly deploymentGroup: EcsDeploymentGroup;

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

    this.application = new EcsApplication(this, "Application", {
      applicationName: `${namePrefix}-application`,
    });

    this.deploymentConfig = new EcsDeploymentConfig(this, "DeploymentConfig", {
      deploymentConfigName: `${namePrefix}-deployment-config`,
      trafficRouting: new TimeBasedCanaryTrafficRouting({
        interval: Duration.minutes(2),
        percentage: 100,
      }),
    });

    this.deploymentGroup = new EcsDeploymentGroup(this, "DeploymentGroup", {
      deploymentGroupName: `${namePrefix}-deployment-group`,
      application: this.application,
      service: ecsService,
      blueGreenDeploymentConfig: {
        deploymentApprovalWaitTime: Duration.minutes(60),
        terminationWaitTime: Duration.minutes(5),
        blueTargetGroup: blueTargetGroup,
        greenTargetGroup: greenTargetGroup,
        listener: blueListener,
        testListener: greenListener,
      },
      deploymentConfig: this.deploymentConfig,
      autoRollback: {
        failedDeployment: true,
      },
      role: codedeployRole,
    });
  }
}
