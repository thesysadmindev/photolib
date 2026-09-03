const path = require("path");
// Loads the monorepo-root .env (not apps/web/.env) before anything else - runs for
// `next dev`, `next build`, and `next start` alike, since all of them load this file
// first. Without this, route handlers importing @photolib/shared would throw
// "DATABASE_URL is not set" since that package reads process.env at import time.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@photolib/shared"],
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
};

module.exports = nextConfig;
