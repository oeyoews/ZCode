import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import semver from "semver";

const desktopPackageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(desktopPackageDir, "../..");

type PackageJsonLike = {
  name?: string;
  version?: string;
};

function readPackageJson(packageDir: string): PackageJsonLike {
  return JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf8"));
}

// Bugfix: dev 启动直接崩溃 `App version is not a valid semver version: "0.0"`。
// 原因链：
// 1. packages/desktop/package.json 没有 version 字段；
// 2. Electron 浏览器进程初始化是 `null!=d.version&&a.setVersion(d.version)`，
//    缺字段时不会调用 setVersion，app.getVersion() 回落原生默认值 "0.0"；
// 3. src/main/autoUpdater.ts 顶层 `const { autoUpdater } = pkg` 会在导入阶段触发
//    electron-updater 的惰性 getter，构造 AppUpdater；
// 4. AppUpdater 构造函数执行 `semver.parse(app.getVersion())`，"0.0" 不是合法 semver，
//    直接抛 ERR_UPDATER_INVALID_VERSION，主进程启动失败。
// 打包态不受影响：electron-builder 的 extraMetadata.version 会 deepAssign
// 覆盖根 package.json 版本，因此这里同时守护两条版本来源。
test("desktop app package.json version is valid semver for electron-updater", () => {
  const desktopPackageJson = readPackageJson(desktopPackageDir);
  const parsed = semver.parse(desktopPackageJson.version ?? "");
  assert.ok(
    parsed != null,
    `packages/desktop/package.json version must be valid semver (electron-updater AppUpdater 会拒绝非 semver), got: ${String(
      desktopPackageJson.version,
    )}`,
  );
});

test("workspace root version is valid semver for packaged app metadata", () => {
  const rootPackageJson = readPackageJson(workspaceRoot);
  const parsed = semver.parse(rootPackageJson.version ?? "");
  assert.ok(
    parsed != null,
    `workspace root package.json version must be valid semver (electron-builder extraMetadata.version 来源), got: ${String(
      rootPackageJson.version,
    )}`,
  );
});
