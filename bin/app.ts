#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PalworldServerStack } from "../lib/palworld-server-stack";

const awsRegion = process.env.AWS_DEFAULT_REGION || "us-east-1";
const awsAccount = process.env.AWS_ACCOUNT_ID || "";

const app = new cdk.App();
new PalworldServerStack(app, "PalworldServerStack", {
  env: { region: awsRegion, account: awsAccount },
  tags: {
    project: "Palworld",
    environment: "Production",
  },
});

app.synth();
