import { invoke } from '@tauri-apps/api/core';

export interface MinecraftServerInfo {
  version: { name: string; protocol: number };
  players: { max: number; online: number; sample?: { name: string; id: string }[] };
  description: { text: string; extra?: { text: string; color?: string }[] };
  favicon: string | null;
}

export interface PingResult {
  info: MinecraftServerInfo;
  latency_ms: number;
}

export interface ServerListEntry {
  id: number;
  name: string;
  address: string;
  port: number;
  is_favorite: boolean;
  last_ping_result: MinecraftServerInfo | null;
  last_ping_at: number | null;
  latency_ms: number | null;
  icon_base64: string | null;
  notes: string | null;
}

export interface ServerAddress {
  name: string;
  address: string;
  port: number;
  hidden: boolean;
  icon: string | null;
  accept_textures: boolean;
}

export async function pingServer(address: string, port: number, timeoutMs?: number): Promise<PingResult | null> {
  try {
    return await invoke<PingResult>('ping_server_info', { address, port, timeoutMs: timeoutMs ?? 5000 });
  } catch {
    return null;
  }
}

export async function batchPingServers(ids: number[]): Promise<void> {
  return invoke('batch_ping_servers', { ids });
}

export async function listServers(): Promise<ServerListEntry[]> {
  return invoke<ServerListEntry[]>('list_servers');
}

export async function addServer(name: string, address: string, port: number): Promise<number> {
  return invoke<number>('add_server', { name, address, port });
}

export async function removeServer(id: number): Promise<void> {
  return invoke('remove_server', { id });
}

export async function toggleServerFavorite(id: number, favorite: boolean): Promise<void> {
  return invoke('toggle_server_favorite', { id, favorite });
}

export async function updateServerPing(id: number, result: MinecraftServerInfo | null, latencyMs: number | null): Promise<void> {
  return invoke('update_server_ping', { id, result, latencyMs });
}

export async function readServersDat(instanceId: string): Promise<ServerAddress[]> {
  return invoke<ServerAddress[]>('read_servers_dat', { instanceId });
}

export async function writeServersDat(instanceId: string, servers: ServerAddress[]): Promise<void> {
  return invoke('write_servers_dat', { instanceId, servers });
}
