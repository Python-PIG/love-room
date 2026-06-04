module.exports = {
  apps: [
    {
      name: "love-room",
      script: "src/server.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
