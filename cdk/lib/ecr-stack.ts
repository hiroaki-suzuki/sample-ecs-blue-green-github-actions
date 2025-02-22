import * as cdk from "aws-cdk-lib";
import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Ecr } from "./modules/app/ecr";
import { setRemovalPolicy } from "./modules/aspect/removal-policy-setter";
import { addCommonTags } from "./modules/aspect/common-tag-setter";
import { EnvValues } from "./modules/env/env-values";

export interface EcrStackProps extends cdk.StackProps {
  readonly namePrefix: string;
  readonly envValues: EnvValues;
}

export class EcrStack extends cdk.Stack {
  public readonly repositoryUri: string;
  public readonly repositoryName: string;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { namePrefix, envValues } = props;

    // ECRの作成
    const ecr = new Ecr(this, "Ecr", {
      namePrefix,
    });

    this.repositoryUri = ecr.repository.repositoryUri;
    this.exportValue(this.repositoryUri, {
      name: `${namePrefix}-uri`,
    });

    this.repositoryName = ecr.repository.repositoryName;
    this.exportValue(this.repositoryName, {
      name: `${namePrefix}-name`,
    });

    setRemovalPolicy(this, RemovalPolicy.DESTROY);
    addCommonTags(this, { project: namePrefix, env: envValues.env });
  }
}
