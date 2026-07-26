import { z } from "zod";

const WebEnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:3001"),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

export const env: WebEnv = WebEnvSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
