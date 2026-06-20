import { invoke } from '@tauri-apps/api/core';

export interface FriendEntry {
  id: string;
  name: string;
  status: string;
  current_game: string | null;
}

export interface PeerAnnouncement {
  peer_id: string;
  display_name: string;
  port: number;
}

export interface FileInfo {
  filename: string;
  sha1: string;
  size_bytes: number;
}

export interface PeerConfigSnapshot {
  minecraft_version: string;
  loader_type: string | null;
  loader_version: string | null;
  mods: FileInfo[];
  resource_packs: FileInfo[];
  shaders: FileInfo[];
  jvm_args: string | null;
  memory_mb: number | null;
}

export interface ConfigDiff {
  version_match: boolean;
  loader_match: boolean;
  missing_mods: FileInfo[];
  extra_mods: FileInfo[];
  missing_resource_packs: FileInfo[];
  missing_shaders: FileInfo[];
  total_download_bytes: number;
  total_file_count: number;
}

export const socialApi = {
  // Identity
  getMyPeerId: () => invoke<string>('get_my_peer_id'),
  exportIdentityKey: () => invoke<string>('export_identity_key'),
  importIdentityKey: (encoded: string) => invoke<string>('import_identity_key', { encoded }),

  // Discovery
  startSocialDiscovery: (displayName: string) => invoke<void>('start_social_discovery', { displayName }),
  stopSocialDiscovery: () => invoke<void>('stop_social_discovery'),
  scanSocialPeers: () => invoke<PeerAnnouncement[]>('scan_social_peers'),

  // Friends (existing commands)
  listFriends: () => invoke<FriendEntry[]>('list_friends'),
  addFriend: (id: string, name: string) => invoke<void>('add_friend', { id, name }),
  removeFriend: (id: string) => invoke<void>('remove_friend', { id }),

  // Co-play sync
  generateInstanceSnapshot: (
    instanceId: string,
    minecraftVersion: string,
    loaderType: string | null,
    loaderVersion: string | null,
  ) =>
    invoke<PeerConfigSnapshot>('generate_instance_snapshot', {
      instanceId,
      minecraftVersion,
      loaderType,
      loaderVersion,
    }),
  computeCoplayDiff: (local: PeerConfigSnapshot, remote: PeerConfigSnapshot) =>
    invoke<ConfigDiff>('compute_coplay_diff', { local, remote }),

  // Discord RPC (existing commands)
  startDiscordRpc: () => invoke<void>('start_discord_rpc'),
  stopDiscordRpc: () => invoke<void>('stop_discord_rpc'),
  updateDiscordPresence: (details: string, state: string) =>
    invoke<void>('update_discord_presence', { details, state }),
};
