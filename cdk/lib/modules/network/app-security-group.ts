import { Construct } from "constructs";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { EnvValues } from "../env/env-values";
import { BaseSecurityGroup } from "../base/base-security-group";

export class AppSecurityGroupProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
  readonly vpc: Vpc;
}

export class AppSecurityGroups extends Construct {
  public readonly albSecurityGroup: SecurityGroup;
  public readonly ecsSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: AppSecurityGroupProps) {
    super(scope, id);

    const { namePrefix, vpc } = props;

    // ALBのセキュリティグループを作成
    this.albSecurityGroup = this.createAlbSecurityGroup(namePrefix, vpc);

    // セキュリティグループの作成
    this.ecsSecurityGroup = this.createEcsSecurityGroup(namePrefix, vpc);
  }

  private createAlbSecurityGroup(namePrefix: string, vpc: Vpc): SecurityGroup {
    const securityGroup = new BaseSecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      securityGroupName: `${namePrefix}-alb-sg`,
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.HTTP, "Allow HTTP from anywhere");

    return securityGroup;
  }

  private createEcsSecurityGroup(namePrefix: string, vpc: Vpc): SecurityGroup {
    const securityGroup = new BaseSecurityGroup(this, "EcsSecurityGroup", {
      vpc,
      securityGroupName: `${namePrefix}-ecs-sg`,
    });
    securityGroup.addIngressRule(this.albSecurityGroup, Port.HTTP, "Allow HTTP from ALB");
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.HTTP, "Allow HTTP from anywhere");

    return securityGroup;
  }
}
