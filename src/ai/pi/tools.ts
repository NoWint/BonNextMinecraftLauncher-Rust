import { commandRegistry } from '../commands';
import type { AICommand } from '../commands';
import type { PiTool } from './types';

export const HIGH_RISK_TOOLS = new Set([
  'install_mod', 'launch_game', 'update_settings',
  'create_instance', 'install_loader', 'apply_fix',
  'execute_modpack_plan', 'analyze_and_fix_crash',
]);

function toPiTool(cmd: AICommand): PiTool {
  return {
    name: cmd.name,
    description: cmd.description,
    riskLevel: cmd.riskLevel,
    execute: async (params: Record<string, unknown>) => {
      return await cmd.execute(params);
    },
  };
}

export const piTools: PiTool[] = (Object.values(commandRegistry) as AICommand[]).map(toPiTool);

export const piToolMap = new Map(piTools.map(t => [t.name, t]));
