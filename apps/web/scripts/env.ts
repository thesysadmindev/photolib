import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Must be the first import in any script here - loads the monorepo-root .env before
// any other module (e.g. @photolib/shared's db client) reads process.env at import time.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });
