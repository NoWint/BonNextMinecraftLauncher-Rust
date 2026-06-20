import { invoke } from '@tauri-apps/api/core';

export interface AttachmentInfo {
  filename: string;
  file_path: string;
  size_bytes: number;
}

export interface Message {
  id: number | null;
  peer_id: string;
  content: string;
  sent_by_me: boolean;
  timestamp: number;
  read: boolean;
  attachment: AttachmentInfo | null;
}

export const chatApi = {
  sendMessage: (peerId: string, content: string) => invoke<number>('send_message', { peerId, content }),

  getMessages: (peerId: string, before: number | null, limit: number) =>
    invoke<Message[]>('get_messages', { peerId, before, limit }),

  markMessagesRead: (peerId: string) => invoke<void>('mark_messages_read', { peerId }),

  getUnreadCount: (peerId: string) => invoke<number>('get_unread_count', { peerId }),
};
