import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { z } from "zod";

export const RskConfigSchema = z.object({
  RPC_URL: z
    .string()
    .default("https://public-node.testnet.rsk.co")
    .describe("RSK RPC URL for blockchain connections"),
});

export type RskConfig = z.infer<typeof RskConfigSchema>;

export const validateRskConfig = async (
  runtime: IAgentRuntime
): Promise<RskConfig> => {
  const RPC_URL = runtime.getSetting("RPC_URL");

  const result = RskConfigSchema.safeParse({
    RPC_URL,
  });

  if (!result.success) {
    const errorMessage = `Invalid RSK Configuration: ${result.error.message}`;
    elizaLogger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return result.data;
};

export const getRskConfig = async (
  runtime: IAgentRuntime
): Promise<RskConfig> => {
  try {
    return await validateRskConfig(runtime);
  } catch (error) {
    elizaLogger.error("Failed to get RSK configuration:", error);
    throw error;
  }
}; 