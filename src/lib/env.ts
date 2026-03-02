import { z } from "zod";

const envSchema = z.object({
  // ConnectWise
  CW_CLIENT_ID: z.string().min(1, "ConnectWise Client ID required"),
  CW_COMPANY_ID: z.string().min(1, "ConnectWise Company ID required"),
  CW_COMPANY_URL: z.string().min(1, "ConnectWise Company URL required"),
  CW_CODE_BASE: z.string().default("v4_6_release"),
  CW_PUBLIC_KEY: z.string().min(1, "ConnectWise Public API Key required"),
  CW_PRIVATE_KEY: z.string().min(1, "ConnectWise Private API Key required"),
  
  // OpenRouter
  OPENROUTER_API_KEY: z.string().min(1, "OpenRouter API key required"),
  OPENROUTER_MODEL: z.string().default("moonshotai/kimi-k2.5:nitro"),
  
  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// Validate at runtime
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
