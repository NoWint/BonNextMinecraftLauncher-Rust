import type { CommandResult, OpenAITool, ToolCall, ParsedCommand } from './types';
import { api } from '../api';

export interface AICommand {
  name: string;
  description: string;
  riskLevel: 'low' | 'high';
  paramDefs: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>;
  execute: (params: Record<string, unknown>) => Promise<CommandResult>;
}

const commandRegistry: Record<string, AICommand> = {
  search_mods: {
    name: 'search_mods',
    description: 'Search for Minecraft mods on Modrinth or CurseForge',
    riskLevel: 'low',
    paramDefs: {
      query: { type: 'string', description: 'Search query keywords', required: true },
      source: { type: 'string', description: 'Search source platform', enum: ['modrinth', 'curseforge'] },
    },
    execute: async (params) => {
      try {
        const query = String(params.query || '');
        const source = String(params.source || 'modrinth');
        if (source === 'curseforge') {
          const results = await api.searchCfMods(query);
          return {
            success: true,
            data: results,
            message: `Found ${Array.isArray(results) ? results.length : 0} mods on CurseForge`,
          };
        }
        const [mods] = await api.searchMods(query);
        return {
          success: true,
          data: mods,
          message: `Found ${Array.isArray(mods) ? mods.length : 0} mods on Modrinth`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Search failed' };
      }
    },
  },

  install_mod: {
    name: 'install_mod',
    description: 'Install a mod to a specific game instance. Requires user confirmation.',
    riskLevel: 'high',
    paramDefs: {
      slug: { type: 'string', description: 'Mod slug or project ID', required: true },
      instance_id: { type: 'string', description: 'Target instance ID (optional, uses default if omitted)' },
      version_id: { type: 'string', description: 'Specific version ID to install (optional, uses latest if omitted)' },
      source: { type: 'string', description: 'Mod source platform', enum: ['modrinth', 'curseforge'] },
    },
    execute: async (params) => {
      try {
        const slug = String(params.slug || '');
        const instanceId = params.instance_id ? String(params.instance_id) : '';
        const versionId = params.version_id ? String(params.version_id) : undefined;
        const source = String(params.source || 'modrinth');

        if (source === 'curseforge') {
          const files = await api.getCfModFiles(Number(slug) || 0);
          const file = files[0];
          if (!file) return { success: false, error: 'No files found for this mod on CurseForge' };
          await api.downloadCfMod(
            file.url,
            file.filename,
            instanceId,
            undefined,
            file.hashes?.sha1 || undefined,
            slug,
            versionId,
          );
          return { success: true, message: `Mod ${slug} installed successfully from CurseForge` };
        }

        const versions = await api.getModVersions(slug);
        const latest = versions?.[0];
        if (!latest) return { success: false, error: 'No versions found for this mod' };
        const targetVersion = versionId ? versions.find((v) => v.id === versionId) || latest : latest;
        const primaryFile = targetVersion.files?.[0];
        if (!primaryFile) return { success: false, error: 'No download file found for this version' };
        await api.installContent(
          primaryFile.url,
          primaryFile.filename,
          instanceId,
          'mod',
          primaryFile.hashes?.sha1 ?? undefined,
          slug,
          targetVersion.id,
        );
        return { success: true, message: `Mod ${slug} installed successfully` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Install failed' };
      }
    },
  },

  launch_game: {
    name: 'launch_game',
    description: 'Launch Minecraft game with a specific instance. Requires user confirmation.',
    riskLevel: 'high',
    paramDefs: {
      instance_id: { type: 'string', description: 'Instance ID to launch (optional, uses first instance if omitted)' },
    },
    execute: async (params) => {
      try {
        const instanceId = params.instance_id ? String(params.instance_id) : undefined;
        const instances = await api.listInstances();
        const target = instanceId ? instances.find((i) => i.id === instanceId) : instances[0];

        if (!target)
          return { success: false, error: instanceId ? `Instance ${instanceId} not found` : 'No instances available' };

        const active = await api.getActiveAccount();
        if (!active) return { success: false, error: 'No active account. Please login first.' };

        await api.launchGame(
          target.version_id,
          target.version_url,
          active.username,
          active.uuid,
          active.access_token || '',
          target.max_memory,
          target.min_memory,
          target.java_path || undefined,
          target.jvm_args || undefined,
          target.id,
        );
        return { success: true, message: `Launching ${target.name}...` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Launch failed' };
      }
    },
  },

  update_settings: {
    name: 'update_settings',
    description: 'Update a launcher configuration setting. Requires user confirmation. Only specific keys are allowed.',
    riskLevel: 'high',
    paramDefs: {
      key: {
        type: 'string',
        description: 'Setting key to update',
        required: true,
        enum: [
          'max_memory',
          'min_memory',
          'fullscreen',
          'download_source',
          'keep_launcher_open',
          'show_log_on_crash',
          'auto_update_java',
          'force_memory',
          'force_java_path',
          'window_width',
          'window_height',
          'jvm_args',
        ],
      },
      value: {
        type: 'string',
        description: 'New value for the setting (as string, will be converted automatically)',
        required: true,
      },
    },
    execute: async (params) => {
      try {
        const key = String(params.key || '');
        const rawValue = params.value;
        const config = await api.getConfig();
        const allowedKeys = [
          'max_memory',
          'min_memory',
          'fullscreen',
          'download_source',
          'keep_launcher_open',
          'show_log_on_crash',
          'auto_update_java',
          'force_memory',
          'force_java_path',
          'window_width',
          'window_height',
          'jvm_args',
        ];

        if (!allowedKeys.includes(key)) {
          return { success: false, error: `Setting "${key}" is not allowed. Allowed: ${allowedKeys.join(', ')}` };
        }

        let value: unknown = rawValue;
        if (['max_memory', 'min_memory', 'window_width', 'window_height'].includes(key)) {
          value = Number(rawValue);
        } else if (
          [
            'fullscreen',
            'keep_launcher_open',
            'show_log_on_crash',
            'auto_update_java',
            'force_memory',
            'force_java_path',
          ].includes(key)
        ) {
          value = String(rawValue).toLowerCase() === 'true';
        }

        const configObj = config as unknown as Record<string, unknown>;
        configObj[key] = value;
        await api.saveConfig(config);
        return { success: true, message: `Setting "${key}" updated to ${JSON.stringify(value)}` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Settings update failed' };
      }
    },
  },

  get_instances: {
    name: 'get_instances',
    description: 'Get the list of all game instances with their details',
    riskLevel: 'low',
    paramDefs: {},
    execute: async () => {
      try {
        const instances = await api.listInstances();
        return {
          success: true,
          data: instances.map((i) => ({
            id: i.id,
            name: i.name,
            version_id: i.version_id,
            loader_type: i.loader_type,
          })),
          message: `Found ${instances.length} instance(s)`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to get instances' };
      }
    },
  },

  get_config: {
    name: 'get_config',
    description: 'Get the current launcher configuration settings',
    riskLevel: 'low',
    paramDefs: {},
    execute: async () => {
      try {
        const config = await api.getConfig();
        const safeConfig = { ...config };
        if (safeConfig.security) {
          safeConfig.security = { ...safeConfig.security, proxy_password: null };
        }
        return { success: true, data: safeConfig, message: 'Current configuration retrieved' };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to get config' };
      }
    },
  },

  search_versions: {
    name: 'search_versions',
    description: 'Search for available Minecraft versions',
    riskLevel: 'low',
    paramDefs: {
      type: { type: 'string', description: 'Version type filter', enum: ['release', 'snapshot', 'all'] },
    },
    execute: async (params) => {
      try {
        const versions = await api.getVersions();
        const type = params.type ? String(params.type) : 'release';
        const filtered = versions.filter((v) => type === 'all' || v.type === type);
        return {
          success: true,
          data: filtered.slice(0, 20).map((v) => ({ id: v.id, type: v.type, time: v.time })),
          message: `Found ${filtered.length} version(s)`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to search versions' };
      }
    },
  },
};

export function getCommand(name: string): AICommand | undefined {
  return commandRegistry[name];
}

export function getAllCommands(): AICommand[] {
  return Object.values(commandRegistry);
}

export function buildOpenAITools(): OpenAITool[] {
  return getAllCommands().map((cmd) => ({
    type: 'function' as const,
    function: {
      name: cmd.name,
      description: cmd.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(cmd.paramDefs).map(([key, def]) => [
            key,
            {
              type: def.type,
              description: def.description,
              ...(def.enum ? { enum: def.enum } : {}),
            },
          ]),
        ),
        required: Object.entries(cmd.paramDefs)
          .filter(([, def]) => def.required)
          .map(([key]) => key),
      },
    },
  }));
}

export function buildSystemPrompt(): string {
  return `You are BonNext AI Assistant, an intelligent helper for a Minecraft launcher. You help users manage their game through natural language.

You have access to tools that can search mods, install mods, launch games, check instances, view/modify settings, and search versions. Use these tools when the user asks you to perform actions. All tools execute automatically.

Rules:
1. Always explain what you're doing before and after calling a tool
2. If a user's request is ambiguous (e.g. "install some mods" without specifying which), ask for clarification
3. Respond in the same language as the user's message
4. Be concise and helpful
5. When showing search results, highlight the most relevant items
6. Execute tools promptly based on user intent — don't ask for unnecessary confirmation`;
}

export function parseToolCallsToCommands(toolCalls: ToolCall[]): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  for (const tc of toolCalls) {
    const cmd = commandRegistry[tc.function.name];
    if (!cmd) continue;
    try {
      const params = JSON.parse(tc.function.arguments || '{}');
      commands.push({
        id: tc.id,
        command: tc.function.name,
        params,
        risk_level: cmd.riskLevel,
      });
    } catch {
      // skip malformed arguments
    }
  }
  return commands;
}
