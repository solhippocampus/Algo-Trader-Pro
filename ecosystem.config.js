module.exports = {
  apps: [
    {
      name: "algo-trader-pro",
      script: "dist/index.cjs",
      cwd: ".",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
