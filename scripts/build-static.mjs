import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const apiDir = path.resolve("src/app/api");
const tempDir = path.resolve("src/app/_api");

let moved = false;
try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, tempDir);
    moved = true;
  }

  console.log("Building static export for GitHub Pages...");
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      STATIC_EXPORT: "true",
    },
  });
  console.log("Static export build completed successfully! Output generated in out/");
} finally {
  if (moved && fs.existsSync(tempDir)) {
    fs.renameSync(tempDir, apiDir);
  }
}
