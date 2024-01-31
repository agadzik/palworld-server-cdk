import * as cdk from "aws-cdk-lib/core";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as backup from "aws-cdk-lib/aws-backup";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apig from "aws-cdk-lib/aws-apigatewayv2";
import * as apig_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

export class PalworldServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const volumeName = "PalworldSaveDataEFS";

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
    });

    const cluster = new ecs.Cluster(this, "PalworldCluster", {
      vpc,
    });

    const fileSystem = new efs.FileSystem(this, "PalworldSaveDataEFS", {
      vpc,
      encrypted: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
    });

    fileSystem.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["elasticfilesystem:ClientMount"],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            "elasticfilesystem:AccessedViaMountTarget": "true",
          },
        },
      })
    );

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "PalworldServerTaskDef",
      {
        memoryLimitMiB: 16384,
        cpu: 4096,
      }
    );

    taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
      },
    });

    const container = taskDefinition.addContainer("PalworldServer", {
      image: ecs.ContainerImage.fromRegistry(
        "thijsvanloef/palworld-server-docker"
      ),
      environment: {
        TZ: "UTC",
        PLAYERS: "16",
        PORT: "8211",
        PUID: "1000",
        PGID: "1000",
        MULTITHREADING: "true",
        COMMUNITY: "false",
        UPDATE_ON_BOOT: "true",
        RCON_ENABLED: "true",
        RCON_PORT: "25575",
        QUERY_PORT: "27015",
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "PalworldServer" }),
      portMappings: [
        { containerPort: 8211, protocol: ecs.Protocol.UDP },
        { containerPort: 27015, protocol: ecs.Protocol.UDP },
      ],
    });

    container.addMountPoints({
      sourceVolume: volumeName,
      containerPath: "/palworld",
      readOnly: false,
    });

    const service = new ecs.FargateService(this, "PalworldServerService", {
      cluster,
      taskDefinition,
      assignPublicIp: true,
    });

    // Allow access to Palworld from the internet
    service.connections.allowFromAnyIpv4(ec2.Port.udp(8211));

    // Allow access to RCON from the internet
    service.connections.allowFromAnyIpv4(ec2.Port.udp(25575));

    // Allow access to EFS from Fargate ECS
    fileSystem.grantRootAccess(service.taskDefinition.taskRole.grantPrincipal);
    fileSystem.connections.allowDefaultPortFrom(service.connections);

    const plan = new backup.BackupPlan(this, "PalworldServerBackupPlan", {
      backupVault: new backup.BackupVault(this, "PalworldServerBackupVault", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    plan.addRule(
      new backup.BackupPlanRule({
        deleteAfter: cdk.Duration.days(3),
        scheduleExpression: events.Schedule.cron({ hour: "*", minute: "0" }),
      })
    );

    plan.addSelection("PalworldServerEfsSelection", {
      resources: [backup.BackupResource.fromEfsFileSystem(fileSystem)],
    });

    // API Gateway for controlling discord interactions
    const expressAppLambda = new nodejs.NodejsFunction(
      this,
      "ExpressAppLambda",
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        entry: "src/functions/discord/interactions.ts",
        functionName: "express-app-handler",
        handler: "handler",
        timeout: cdk.Duration.seconds(60),
        environment: {
          APPLICATION_PUBLIC_KEY: process.env.APPLICATION_PUBLIC_KEY || "",
          ECS_SERVICE_NAME: service.serviceName,
          ECS_CLUSTER_ARN: service.cluster.clusterArn,
        },
      }
    );

    expressAppLambda.role?.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "ECS_FullAccessPolicy",
        "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
      )
    );

    const discordInteractionsIntegration =
      new apig_integrations.HttpLambdaIntegration(
        "DiscordInteractionsIntegration",
        expressAppLambda
      );
    const httpApi = new apig.HttpApi(this, "ExpressAppEndpoint");

    httpApi.addRoutes({
      integration: discordInteractionsIntegration,
      path: "/discord",
      methods: [apig.HttpMethod.ANY],
    });
  }
}
