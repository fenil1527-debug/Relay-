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
  
  // Supabase Database
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Auth
  jwtSecret: process.env.AUTH_SECRET ? process.env.AUTH_SECRET.trim().replace(/^["']|["']$/g, '') : 'dev-secret-change-me',
  githubClientId: process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID.trim().replace(/^["']|["']$/g, '') : undefined,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ? process.env.GITHUB_CLIENT_SECRET.trim().replace(/^["']|["']$/g, '') : undefined,
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL ? process.env.GITHUB_CALLBACK_URL.trim().replace(/^["']|["']$/g, '') : '',
  clientUrl: process.env.CLIENT_URL ? process.env.CLIENT_URL.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '') : 'http://localhost:5173',
  
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
