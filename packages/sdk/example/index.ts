import "dotenv/config";
import { client, projectAll } from "../src/index.ts";

client.setConfig({
  baseUrl: process.env.DOKPLOY_URL,
  headers: {
    "x-api-key": process.env.DOKPLOY_TOKEN,
  },
});

const { data: projects, error } = await projectAll();

if (error) {
  console.error("Error fetching projects:", error);
  process.exit(1);
}

console.log("Projects:", projects);
