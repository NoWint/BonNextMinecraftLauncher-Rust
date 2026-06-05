import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { api } from '../api';
import type { Message } from '../api/chat';

interface ChatState {
  activeChat: string | null;
  messages: Record<string, Message[]>;
  unreadCounts: Record<string, number>;
}

type Action =
  | { type: 'OPEN_CHAT'; peerId: string }
  | { type: 'CLOSE_CHAT' }
  | { type: 'SET_MESSAGES'; peerId: string; messages: Message[] }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_UNREAD'; peerId: string; count: number }
  | { type: 'MARK_READ'; peerId: string };

const initialState: ChatState = {
  activeChat: null,
  messages: {},
  unreadCounts: {},
};

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'OPEN_CHAT':
      return { ...state, activeChat: action.peerId };
    case 'CLOSE_CHAT':
      return { ...state, activeChat: null };
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: { ...state.messages, [action.peerId]: action.messages },
      };
    case 'ADD_MESSAGE': {
      const peerId = action.message.peer_id;
      const existing = state.messages[peerId] || [];
      return {
        ...state,
        messages: { ...state.messages, [peerId]: [...existing, action.message] },
        unreadCounts: action.message.sent_by_me
          ? state.unreadCounts
          : { ...state.unreadCounts, [peerId]: (state.unreadCounts[peerId] || 0) + 1 },
      };
    }
    case 'SET_UNREAD':
      return { ...state, unreadCounts: { ...state.unreadCounts, [action.peerId]: action.count } };
    case 'MARK_READ':
      return { ...state, unreadCounts: { ...state.unreadCounts, [action.peerId]: 0 } };
    default:
      return state;
  }
}

interface ChatContextValue extends ChatState {
  openChat: (peerId: string) => Promise<void>;
  closeChat: () => void;
  sendMessage: (peerId: string, content: string) => Promise<void>;
  loadMessages: (peerId: string) => Promise<void>;
  markRead: (peerId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openChat = useCallback(async (peerId: string) => {
    dispatch({ type: 'OPEN_CHAT', peerId });
    const msgs = await api.chat.getMessages(peerId, null, 50);
    dispatch({ type: 'SET_MESSAGES', peerId, messages: msgs });
    await api.chat.markMessagesRead(peerId);
    dispatch({ type: 'MARK_READ', peerId });
  }, []);

  const closeChat = useCallback(() => {
    dispatch({ type: 'CLOSE_CHAT' });
  }, []);

  const sendMessage = useCallback(async (peerId: string, content: string) => {
    const id = await api.chat.sendMessage(peerId, content);
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id,
        peer_id: peerId,
        content,
        sent_by_me: true,
        timestamp: Math.floor(Date.now() / 1000),
        read: false,
        attachment: null,
      },
    });
  }, []);

  const loadMessages = useCallback(async (peerId: string) => {
    const msgs = await api.chat.getMessages(peerId, null, 50);
    dispatch({ type: 'SET_MESSAGES', peerId, messages: msgs });
  }, []);

  const markRead = useCallback(async (peerId: string) => {
    await api.chat.markMessagesRead(peerId);
    dispatch({ type: 'MARK_READ', peerId });
  }, []);

  return (
    <ChatContext.Provider value={{ ...state, openChat, closeChat, sendMessage, loadMessages, markRead }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
