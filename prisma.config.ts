import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` (run from postinstall on every deploy) doesn't need a
    // live connection — using env() here would throw when DATABASE_URL isn't
    // set yet (e.g. before the production database is provisioned).
    url: process.env.DATABASE_URL ?? "",
  },
});
