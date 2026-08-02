import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Test configuration.
 *
 * The suite targets the pure domain layer and the security-critical primitives.
 * Those are the parts where a silent regression is most expensive and least
 * likely to be noticed by clicking around: a wrong percentage looks plausible,
 * and a broken authorization rule looks like nothing at all.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: "default",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
