import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

type TestEnv = Env & { TEST_MIGRATIONS: { name: string; queries: string[] }[] };

const testEnv = env as TestEnv;
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
