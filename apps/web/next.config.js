const path = require("path");
// Loads the monorepo-root .env (not apps/web/.env) before anything else - runs for
// `next dev`, `next build`, and `next start` alike, since all of them load this file
// first. Without this, route handlers importing @photolib/shared would throw
// "DATABASE_URL is not set" since that package reads process.env at import time.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deployment runs `next start` (see ecosystem.config.js), not the standalone
  // server output, so `output: "standalone"` isn't used here - and enabling it
  // requires symlink creation, which fails outright on Windows without Developer
  // Mode enabled.
  transpilePackages: ["@photolib/shared"],
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
};

module.exports = nextConfig;
