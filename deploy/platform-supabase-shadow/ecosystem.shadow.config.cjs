const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "rivnos-shadow",
      script: path.join(__dirname, "shadow-app.sh"),
      args: "start",
      cwd: path.resolve(__dirname, "../.."),
      interpreter: "/bin/sh",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 5,
      min_uptime: "10s",
      restart_delay: 5000,
    },
  ],
};
