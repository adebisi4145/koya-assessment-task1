import { config } from "dotenv";

// Local runs read .env.local; CI and production runs pass API_URL / API_KEY explicitly.
// (Not BASE_URL: Vite reserves that name for its asset base path.)
config({ path: ".env.local", quiet: true });

if (!process.env.API_KEY) throw new Error("API_KEY must be set to run contract tests");
process.env.API_URL = process.env.API_URL || "http://localhost:3000";
