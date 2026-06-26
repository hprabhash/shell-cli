import betterAuthPlugin from "@shell-cli/plugin-better-auth";
import nextPlugin from "@shell-cli/plugin-next";
import {
  PluginError,
  pluginMetadataSchema,
  type CheckResult,
  type Plugin,
  type PluginCategory,
  type PluginMetadata,
} from "@shell-cli/shared";

const BUILT_IN_PLUGINS: Plugin[] = [nextPlugin, betterAuthPlugin];

/** Validates a plugin's `register()` output every call — cheap, and keeps plugins honest. */
export function getPluginMetadata(plugin: Plugin): PluginMetadata {
  const result = pluginMetadataSchema.safeParse(plugin.register());
  if (!result.success) {
    throw new PluginError(
      `Plugin returned invalid metadata from register(): ${result.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  return result.data;
}

export function getAllPlugins(plugins: Plugin[] = BUILT_IN_PLUGINS): Plugin[] {
  return plugins;
}

export function getPluginsByCategory(
  category: PluginCategory,
  plugins: Plugin[] = BUILT_IN_PLUGINS,
): Plugin[] {
  return plugins.filter((plugin) => getPluginMetadata(plugin).category === category);
}

export function findPluginById(
  id: string,
  plugins: Plugin[] = BUILT_IN_PLUGINS,
): Plugin | undefined {
  return plugins.find((plugin) => getPluginMetadata(plugin).id === id);
}

/** Runs every plugin's `doctor()` and prefixes each result's label with `[<plugin id>]` for `shell doctor`. */
export async function collectPluginDoctorResults(
  plugins: Plugin[] = BUILT_IN_PLUGINS,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const plugin of plugins) {
    const metadata = getPluginMetadata(plugin);
    const pluginResults = await plugin.doctor();
    for (const result of pluginResults) {
      results.push({ ...result, label: `[${metadata.id}] ${result.label}` });
    }
  }
  return results;
}
