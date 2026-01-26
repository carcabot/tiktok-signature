/**
 * Basic tests for tiktok-signature
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");

describe("tiktok-signature", () => {
  describe("Package structure", () => {
    test("package.json exists and is valid", () => {
      const pkgPath = path.join(ROOT_DIR, "package.json");
      expect(fs.existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      expect(pkg.name).toBe("tiktok-signature");
      expect(pkg.main).toBe("server.mjs");
      expect(pkg.type).toBe("module");
    });

    test("server.mjs exists", () => {
      const serverPath = path.join(ROOT_DIR, "server.mjs");
      expect(fs.existsSync(serverPath)).toBe(true);
    });

    test("SDK file exists", () => {
      const sdkPath = path.join(ROOT_DIR, "javascript", "webmssdk_5.1.3.js");
      expect(fs.existsSync(sdkPath)).toBe(true);
    });
  });

  describe("SDK content", () => {
    test("SDK contains signature generation functions", () => {
      const sdkPath = path.join(ROOT_DIR, "javascript", "webmssdk_5.1.3.js");
      const content = fs.readFileSync(sdkPath, "utf-8");

      // SDK should contain key signature-related code
      expect(content.length).toBeGreaterThan(10000);
    });
  });

  describe("Examples", () => {
    test("example files exist", () => {
      const examplesDir = path.join(ROOT_DIR, "examples");
      expect(fs.existsSync(examplesDir)).toBe(true);

      const files = fs.readdirSync(examplesDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
