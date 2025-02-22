#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack";
import { EnvValues } from "../lib/modules/env/env-values";
import { EcrStack } from "../lib/ecr-stack";

const app = new cdk.App();

// プロジェクト名、リソース名のプレフィックスとして利用
const projectName = app.node.tryGetContext("projectName");
if (!projectName) {
  throw new Error("projectName is not defined.");
}

// コミットID、コンテナイメージのタグとして利用
const commitId = process.env.GITHUB_SHA?.slice(0, 7);
if (!commitId) {
  throw new Error("GITHUB_SHA is not defined.");
}

// 環境変数の取得
const envKey = app.node.tryGetContext("environment");
const envValues: EnvValues = app.node.tryGetContext(envKey);
let namePrefix = `${projectName}-${envValues.env}`;

const ecrStack = new EcrStack(app, `${namePrefix}-ecr`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  namePrefix,
  envValues,
});

new AppStack(app, `${namePrefix}-app`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  namePrefix,
  envValues,
  ecrRepositoryName: ecrStack.repositoryName,
  commitId,
});
