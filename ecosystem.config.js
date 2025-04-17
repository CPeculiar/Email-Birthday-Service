module.exports = {
    apps: [{
      name: "birthday-email-service",
      script: "index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      log_date_format: "YYYY-MM-DD HH:mm Z"
    }]
  };