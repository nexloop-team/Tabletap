import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // The real package throws outside a React Server bundle.
      "server-only": path.resolve(import.meta.dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Tests always use a throwaway embedded database and local files, never a real server or bucket.
    env: { DATABASE_URL: "", S3_BUCKET: "" },
    // The first query in each file starts an embedded Postgres, which takes a few seconds.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
