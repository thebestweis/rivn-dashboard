module.exports = {
  apps: [
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
  ],
};
