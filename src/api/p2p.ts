import { invoke } from '@tauri-apps/api/core';
import type { P2PStatus } from './types';

export const getP2PStatus = () => invoke<P2PStatus>('p2p_get_status');

export const p2pConnect = (peerId: string) => invoke<string>('p2p_connect', { peerId });

export const p2pDisconnect = (peerId: string) => invoke<string>('p2p_disconnect', { peerId });
