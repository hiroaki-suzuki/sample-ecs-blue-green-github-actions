import { Construct } from "constructs";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { RemovalPolicy } from "aws-cdk-lib";

export interface EcrProps {
  readonly namePrefix: string;
}

export class Ecr extends Construct {
  public readonly repository: Repository;

  constructor(scope: Construct, id: string, props: EcrProps) {
    super(scope, id);

    const { namePrefix } = props;

    // ECRリポジトリの作成
    this.repository = this.createRepository(namePrefix);
  }

  private createRepository(namePrefix: string): Repository {
    return new Repository(this, "Repository", {
      repositoryName: `${namePrefix}-repository`,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
    });
  }
}
