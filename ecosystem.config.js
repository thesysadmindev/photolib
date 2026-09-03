// PM2 process definitions for the native (no-Docker) VPS deployment.
// Usage: pm2 start ecosystem.config.js --env production
//        pm2 save && pm2 startup   (to survive reboots)
module.exports = {
  apps: [
    {
      name: "photolib-web",
      cwd: "./apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      out_file: "../../logs/web.out.log",
      error_file: "../../logs/web.error.log",
      time: true,
    },
    {
      name: "photolib-worker",
      cwd: "./apps/worker",
      script: "dist/index.js",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      // darktable-cli is CPU-heavy - cap memory so a runaway conversion job
      // restarts the worker rather than starving the box.
      max_memory_restart: "2G",
      out_file: "../../logs/worker.out.log",
      error_file: "../../logs/worker.error.log",
      time: true,
    },
    {
      name: "photolib-watermark-svc",
      cwd: "./services/watermark-svc",
      script: ".venv/bin/uvicorn",
      args: "app:app --host 127.0.0.1 --port 8000",
      interpreter: "none",
      env: { PYTHONUNBUFFERED: "1" },
      autorestart: true,
      max_restarts: 10,
      out_file: "../../logs/watermark-svc.out.log",
      error_file: "../../logs/watermark-svc.error.log",
      time: true,
    },
  ],
};
