const fs = require("fs");
const { execSync } = require("child_process");

if (!fs.existsSync(".git")) {
  process.exit(0);
}

try {
  execSync("husky install", { stdio: "pipe" });
} catch (error) {
  console.warn("Skipping husky install.");
}
