import fs from "node:fs";
import path from "node:path";

import {
  MIN_NODE_MAJOR_VERSION,
  NPM_REGISTRY_BASE_URL,
  type CheckResult,
  type CommandRunner,
} from "@shell-cli/shared";

import { realCommandRunner } from "./command-runner";
import { loadConfig } from "./config-store";
import { detectAllPackageManagers } from "./package-manager";
import { getConfigDir } from "./paths";

export type { CheckResult, CheckStatus } from "@shell-cli/shared";

export function checkNodeVersion(nodeVersion: string = process.version): CheckResult {
  const major = Number(nodeVersion.replace(/^v/, "").split(".")[0]);
  const pass = Number.isFinite(major) && major >= MIN_NODE_MAJOR_VERSION;
  return {
    id: "node",
    label: "Node.js version",
    status: pass ? "pass" : "fail",
    message: pass
      ? `${nodeVersion} (>= v${MIN_NODE_MAJOR_VERSION} required)`
      : `${nodeVersion} — Node >= v${MIN_NODE_MAJOR_VERSION} is required.`,
  };
}

export async function checkGit(runner: CommandRunner = realCommandRunner): Promise<CheckResult> {
  try {
    const result = await runner("git", ["--version"]);
    if (result.exitCode === 0) {
      return { id: "git", label: "git", status: "pass", message: result.stdout.trim() };
    }
  } catch {
    // fall through to the warn result below
  }
  return {
    id: "git",
    label: "git",
    status: "warn",
    message: "Not found on PATH — `shell create`'s git-init step will fail.",
  };
}

export async function checkPackageManagers(
  runner: CommandRunner = realCommandRunner,
): Promise<CheckResult> {
  const infos = await detectAllPackageManagers(runner);
  const available = infos.filter((info) => info.available);
  if (available.length === 0) {
    return {
      id: "package-managers",
      label: "Package managers",
      status: "fail",
      message: "None of npm/pnpm/yarn/bun were found on PATH.",
    };
  }
  return {
    id: "package-managers",
    label: "Package managers",
    status: "pass",
    message: available.map((info) => `${info.name}@${info.version ?? "?"}`).join(", "),
  };
}

export function checkHomeDirWritable(): CheckResult {
  const dir = getConfigDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probePath = path.join(dir, `.write-check-${process.pid}`);
    fs.writeFileSync(probePath, "ok");
    fs.rmSync(probePath);
    return {
      id: "home-writable",
      label: "Config directory writable",
      status: "pass",
      message: dir,
    };
  } catch (error) {
    return {
      id: "home-writable",
      label: "Config directory writable",
      status: "fail",
      message: `Cannot write to ${dir}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function checkNetwork(): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 2000);
  try {
    const response = await fetch(NPM_REGISTRY_BASE_URL, { signal: controller.signal });
    return {
      id: "network",
      label: "npm registry reachable",
      status: response.ok ? "pass" : "warn",
      message: response.ok ? "OK" : `Responded with HTTP ${response.status}`,
    };
  } catch {
    return {
      id: "network",
      label: "npm registry reachable",
      status: "warn",
      message: "Could not reach registry.npmjs.org (offline — cached data will still work).",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkRegistry(
  registryUrl: string = loadConfig().registryUrl,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 2000);
  try {
    const response = await fetch(registryUrl, { signal: controller.signal });
    return {
      id: "registry",
      label: "Template registry reachable",
      status: response.ok ? "pass" : "warn",
      message: response.ok ? "OK" : `Responded with HTTP ${response.status}`,
    };
  } catch {
    return {
      id: "registry",
      label: "Template registry reachable",
      status: "warn",
      message: `Could not reach ${registryUrl} (offline — cached templates will still work).`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runAllChecks(
  runner: CommandRunner = realCommandRunner,
): Promise<CheckResult[]> {
  const [git, packageManagers, network, registry] = await Promise.all([
    checkGit(runner),
    checkPackageManagers(runner),
    checkNetwork(),
    checkRegistry(),
  ]);
  return [checkNodeVersion(), git, packageManagers, checkHomeDirWritable(), network, registry];
}
