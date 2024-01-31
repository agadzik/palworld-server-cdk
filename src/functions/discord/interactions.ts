import {
  ECSClient,
  UpdateServiceCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import express from "express";
import { Request, Response } from "express";
import { verifyKeyMiddleware } from "discord-interactions";
import serverless from "serverless-http";

const client = new ECSClient();

const PUBLIC_KEY = process.env.APPLICATION_PUBLIC_KEY || "";
const ECS_CLUSTER_ARN = process.env.ECS_CLUSTER_ARN || "";
const ECS_SERVICE_NAME = process.env.ECS_SERVICE_NAME || "";

const app = express();

app.use(express.json()); // For parsing application/json

app.post(
  "/discord",
  verifyKeyMiddleware(PUBLIC_KEY),
  async (req: Request, res: Response) => {
    if (req.body.type === 1) {
      return res.json({ type: 1 });
    } else {
      console.info(req.body);
      let interactionOption = "status";
      try {
        interactionOption = req.body.data.options[0].value;
      } catch (error) {
        console.info("Could not parse the interaction option");
      }

      console.info("Interaction:");
      console.info(interactionOption);

      let content = "";

      if (interactionOption === "status") {
        try {
          const command = new DescribeServicesCommand({
            cluster: ECS_CLUSTER_ARN,
            services: [ECS_SERVICE_NAME],
          });
          const resp = await client.send(command);
          const desiredCount = resp.services?.[0].desiredCount;
          const runningCount = resp.services?.[0].runningCount;
          const pendingCount = resp.services?.[0].pendingCount;

          content = `Desired: ${desiredCount} | Running: ${runningCount} | Pending: ${pendingCount}`;
        } catch (e) {
          content = "Could not get server status";
          console.info("Could not get the server status");
          console.error(e);
        }
      } else if (interactionOption === "start") {
        content = "Starting the server";
        const command = new UpdateServiceCommand({
          cluster: ECS_CLUSTER_ARN,
          service: ECS_SERVICE_NAME,
          desiredCount: 1,
        });
        await client.send(command);
      } else if (interactionOption === "stop") {
        content = "Stopping the server";
        const command = new UpdateServiceCommand({
          cluster: ECS_CLUSTER_ARN,
          service: ECS_SERVICE_NAME,
          desiredCount: 0,
        });
        await client.send(command);
      } else {
        content = "Unknown command";
      }

      return res.json({
        type: 4,
        data: {
          tts: false,
          content: content,
          embeds: [],
          allowed_mentions: { parse: [] },
        },
      });
    }
  }
);

const handler = serverless(app, {
  binary: ["image/png"],
});

export { handler };
