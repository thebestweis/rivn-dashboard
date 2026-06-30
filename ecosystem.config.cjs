const apps = [
    {
      name: "rivnos",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      name: "rivn-leads-reader",
      script: "npm",
      args: "run leads:reader",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
    },
];

if (process.env.AVITO_TELEGRAM_WORKER_ENABLED === "true") {
  apps.push({
    name: "avito-telegram-worker",
    script: "npm",
    args: "run avito:telegram-worker",
    cwd: __dirname,
    env: {
      NODE_ENV: "production",
    },
    max_restarts: 10,
    min_uptime: "10s",
    restart_delay: 5000,
  });
}

module.exports = {
  apps,
};
