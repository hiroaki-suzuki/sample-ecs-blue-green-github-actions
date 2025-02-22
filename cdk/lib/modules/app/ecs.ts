import { Construct } from "constructs";
import {
  Cluster,
  ContainerDefinition,
  ContainerImage,
  CpuArchitecture,
  DeploymentControllerType,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  OperatingSystemFamily,
  TaskDefinition,
} from "aws-cdk-lib/aws-ecs";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { IVpc, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { BaseLogGroup } from "../base/base-log-group";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import {
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

export interface EcsProps {
  readonly namePrefix: string;
  readonly vpc: IVpc;
  readonly securityGroup: SecurityGroup;
  readonly imageTag: string;
  readonly ecrRepositoryName: string;
}

export class Ecs extends Construct {
  public readonly cluster: Cluster;
  public readonly service: FargateService;
  public readonly taskDefinition: TaskDefinition;
  public readonly containerDefinition: ContainerDefinition;

  constructor(scope: Construct, id: string, props: EcsProps) {
    super(scope, id);

    const { namePrefix, vpc, securityGroup, imageTag, ecrRepositoryName } = props;

    // クラスターの作成
    this.cluster = this.createCluster(namePrefix, vpc);

    // ロググループの作成
    const logGroup = this.createLogGroup(namePrefix);

    // タスクロールの作成
    const taskRole = this.createTaskRole(namePrefix, logGroup);

    // タスク実行ロールの作成
    const executionRole = this.createExecutionTole(namePrefix);

    // タスク定義の作成
    this.taskDefinition = this.createFargateTaskDefinition(namePrefix, taskRole, executionRole);

    // コンテナ定義の作成
    this.containerDefinition = this.createContainerDefinition(
      namePrefix,
      this.taskDefinition,
      ecrRepositoryName,
      logGroup,
      imageTag,
    );

    this.service = this.createService(namePrefix, this.cluster, this.taskDefinition, securityGroup);
  }

  private createCluster(namePrefix: string, vpc: IVpc): Cluster {
    return new Cluster(this, "Cluster", {
      clusterName: `${namePrefix}-cluster`,
      enableFargateCapacityProviders: true,
      vpc,
    });
  }

  private createLogGroup(namePrefix: string): LogGroup {
    return new BaseLogGroup(this, "ContainerLogGroup", {
      logGroupName: `/ecs/${namePrefix}-task-log`,
    });
  }

  private createTaskRole(namePrefix: string, logGroup: LogGroup): Role {
    return new Role(this, "EcsTaskRole", {
      roleName: `${namePrefix}-ecs-task-role`,
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
      inlinePolicies: {
        "allow-logs": new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["logs:PutLogEvents", "logs:CreateLogGroup", "logs:CreateLogStream"],
              resources: [`${logGroup.logGroupArn}`, `${logGroup.logGroupArn}:*`],
            }),
          ],
        }),
      },
    });
  }

  private createExecutionTole(namePrefix: string): Role {
    return new Role(this, "EcsExecutionRole", {
      roleName: `${namePrefix}-ecs-execution-role`,
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });
  }

  private createFargateTaskDefinition(
    namePrefix: string,
    taskRole: Role,
    executionRole: Role,
  ): FargateTaskDefinition {
    return new FargateTaskDefinition(this, "TaskDefinition", {
      family: `${namePrefix}-task-def`,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.X86_64,
      },
      cpu: 1024,
      memoryLimitMiB: 2048,
      taskRole: taskRole,
      executionRole: executionRole,
    });
  }

  private createContainerDefinition(
    namePrefix: string,
    taskDefinition: TaskDefinition,
    ecrRepositoryName: string,
    logGroup: LogGroup,
    imageTag: string,
  ): ContainerDefinition {
    // バッチ
    const repository = Repository.fromRepositoryName(this, "Repository", ecrRepositoryName);

    return new ContainerDefinition(this, "BatchContainerDefinition", {
      taskDefinition,
      containerName: `${namePrefix}-container`,
      image: ContainerImage.fromEcrRepository(repository, imageTag),
      cpu: 1024,
      memoryReservationMiB: 2048,
      memoryLimitMiB: 2048,
      portMappings: [
        {
          containerPort: 3000,
          hostPort: 3000,
        },
      ],
      logging: LogDriver.awsLogs({
        logGroup,
        streamPrefix: "ecs",
      }),
    });
  }

  private createService(
    namePrefix: string,
    cluster: Cluster,
    taskDef: TaskDefinition,
    securityGroup: SecurityGroup,
  ): FargateService {
    const service = new FargateService(this, `${namePrefix}-front-service`, {
      serviceName: `${namePrefix}-front-service`,
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      deploymentController: {
        type: DeploymentControllerType.CODE_DEPLOY,
      },
      securityGroups: [securityGroup],
    });

    service.node.addDependency(taskDef);

    return service;
  }
}
