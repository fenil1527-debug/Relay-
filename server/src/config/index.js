import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env file regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  databaseUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/relay',
  
  // Auth
  jwtSecret: process.env.AUTH_SECRET || 'dev-secret-change-me',
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  
  // Providers
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiCompatBaseUrl: process.env.OPENAI_COMPAT_BASE_URL,
  openaiCompatApiKey: process.env.OPENAI_COMPAT_API_KEY,
  openaiCompatModel: process.env.OPENAI_COMPAT_MODEL,
  
  // Feature flags
  enableSimulation: process.env.ENABLE_SIMULATION === 'true',

  // Limits
  maxStepsPerTurn: 25,
  maxFilesPerSession: 50,
  maxFileSizeBytes: 100_000,
  maxRetries: 2,
  defaultTokenCap: 100_000,
};

export default config;
