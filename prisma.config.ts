import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

const fallbackDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/oficina_tecnica?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
