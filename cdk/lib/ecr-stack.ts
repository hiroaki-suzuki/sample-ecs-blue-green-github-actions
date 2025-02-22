import * as cdk from "aws-cdk-lib";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Ecr } from "./modules/app/ecr";
import { setRemovalPolicy } from "./modules/aspect/removal-policy-setter";
import { addCommonTags } from "./modules/aspect/common-tag-setter";
import { EnvValues } from "./modules/env/env-values";
import * as changeCase from "change-case";

export interface EcrStackProps extends cdk.StackProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
}

export class EcrStack extends cdk.Stack {
  public readonly repositoryName: string;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { namePrefix, envValues } = props;

    // ECRの作成
    const ecr = new Ecr(this, "Ecr", {
      namePrefix,
    });

    new CfnOutput(this, "RepositoryUri", {
      exportName: changeCase.pascalCase(`${namePrefix}-uri`),
      value: ecr.repository.repositoryUri,
    });

    this.repositoryName = ecr.repository.repositoryName;
    new CfnOutput(this, "RepositoryName", {
      exportName: changeCase.pascalCase(`${namePrefix}-name`),
      value: this.repositoryName,
    });

    setRemovalPolicy(this, RemovalPolicy.DESTROY);
    addCommonTags(this, { project: namePrefix, env: envValues.env });
  }
}
