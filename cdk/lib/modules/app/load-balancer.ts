import { Construct } from "constructs";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  ApplicationListener,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  TargetType,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import { ArnPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { EnvValues } from "../env/env-values";

interface LoadBalancerProps {
  namePrefix: string;
  envValues: EnvValues;
  vpc: Vpc;
  albSecurityGroup: SecurityGroup;
  ecsService: FargateService;
}

export class LoadBalancer extends Construct {
  public readonly alb: ApplicationLoadBalancer;
  public readonly blueTargetGroup: ApplicationTargetGroup;
  public readonly blueListener: ApplicationListener;
  public readonly greenTargetGroup: ApplicationTargetGroup;
  public readonly greenListener: ApplicationListener;

  constructor(scope: Construct, id: string, props: LoadBalancerProps) {
    super(scope, id);

    const { namePrefix, vpc, albSecurityGroup, ecsService } = props;

    // ALBを作成する
    const alb = this.createApplicationLoadBalancer(namePrefix, vpc, albSecurityGroup);

    // ALBのログを保存するバケットを作成する
    this.createAlbLogBucket(namePrefix, alb);

    // ブルーターゲットグループ,リスナーを作成する
    this.blueTargetGroup = this.createBlueTargetGroup(namePrefix, vpc);
    this.blueListener = this.createBlueListener(alb, this.blueTargetGroup);

    // グリーンターゲットグループ,リスナーを作成する
    this.greenTargetGroup = this.createGreenTargetGroup(namePrefix, vpc);
    this.greenListener = this.createGreenListener(alb, this.greenTargetGroup);

    this.alb = alb;

    ecsService.attachToApplicationTargetGroup(this.blueTargetGroup);
  }

  private createApplicationLoadBalancer(
    namePrefix: string,
    vpc: Vpc,
    albSecurityGroup: SecurityGroup,
  ): ApplicationLoadBalancer {
    return new ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
      loadBalancerName: `${namePrefix}-alb`,
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });
  }

  private createAlbLogBucket(namePrefix: string, alb: ApplicationLoadBalancer): Bucket {
    const bucket = new Bucket(this, "AlbLogBucket", {
      bucketName: `${namePrefix}-alb-log`,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: `${namePrefix}-delete-lifecycle-rule`,
          enabled: true,
          expiration: Duration.days(30),
        },
      ],
      autoDeleteObjects: true,
    });
    bucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:PutObject"],
        resources: [bucket.arnForObjects("*")],
        principals: [
          new ArnPrincipal("arn:aws:iam::582318560864:root"), // ALB自体のアカウント
        ],
      }),
    );
    alb.logAccessLogs(bucket);

    return bucket;
  }

  private createBlueTargetGroup(namePrefix: string, vpc: Vpc): ApplicationTargetGroup {
    return new ApplicationTargetGroup(this, "BlueTargetGroup", {
      targetGroupName: `${namePrefix}-blue-tg`,
      vpc,
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.IP,
    });
  }

  private createBlueListener(
    alb: ApplicationLoadBalancer,
    blueTargetGroup: ApplicationTargetGroup,
  ): ApplicationListener {
    return alb.addListener("BlueListener", {
      port: 80,
      defaultAction: ListenerAction.forward([blueTargetGroup]),
    });
  }

  private createGreenTargetGroup(namePrefix: string, vpc: Vpc): ApplicationTargetGroup {
    return new ApplicationTargetGroup(this, "GreenTargetGroup", {
      targetGroupName: `${namePrefix}-green-tg`,
      vpc,
      port: 8080,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.IP,
    });
  }

  private createGreenListener(
    alb: ApplicationLoadBalancer,
    greenTargetGroup: ApplicationTargetGroup,
  ): ApplicationListener {
    return alb.addListener("GreenListener", {
      port: 8080,
      defaultAction: ListenerAction.forward([greenTargetGroup]),
    });
  }
}
