import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../api';
import type { FriendEntry, PeerAnnouncement } from '../api/social';

interface SocialState {
  myPeerId: string | null;
  friends: FriendEntry[];
  discoveredPeers: PeerAnnouncement[];
  isDiscovering: boolean;
  isLoaded: boolean;
}

type Action =
  | { type: 'SET_MY_PEER_ID'; peerId: string }
  | { type: 'SET_FRIENDS'; friends: FriendEntry[] }
  | { type: 'ADD_FRIEND'; friend: FriendEntry }
  | { type: 'REMOVE_FRIEND'; id: string }
  | { type: 'SET_DISCOVERED_PEERS'; peers: PeerAnnouncement[] }
  | { type: 'SET_DISCOVERING'; active: boolean }
  | { type: 'SET_LOADED' };

const initialState: SocialState = {
  myPeerId: null,
  friends: [],
  discoveredPeers: [],
  isDiscovering: false,
  isLoaded: false,
};

function reducer(state: SocialState, action: Action): SocialState {
  switch (action.type) {
    case 'SET_MY_PEER_ID':
      return { ...state, myPeerId: action.peerId };
    case 'SET_FRIENDS':
      return { ...state, friends: action.friends };
    case 'ADD_FRIEND':
      if (state.friends.some((f) => f.id === action.friend.id)) return state;
      return { ...state, friends: [...state.friends, action.friend] };
    case 'REMOVE_FRIEND':
      return { ...state, friends: state.friends.filter((f) => f.id !== action.id) };
    case 'SET_DISCOVERED_PEERS':
      return { ...state, discoveredPeers: action.peers };
    case 'SET_DISCOVERING':
      return { ...state, isDiscovering: action.active };
    case 'SET_LOADED':
      return { ...state, isLoaded: true };
    default:
      return state;
  }
}

interface SocialContextValue extends SocialState {
  load: () => Promise<void>;
  startDiscovery: (displayName: string) => Promise<void>;
  stopDiscovery: () => Promise<void>;
  scanPeers: () => Promise<void>;
  addFriend: (id: string, name: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(async () => {
    const [peerId, friends] = await Promise.all([
      api.social.getMyPeerId().catch(() => null),
      api.social.listFriends().catch(() => []),
    ]);
    if (peerId) dispatch({ type: 'SET_MY_PEER_ID', peerId });
    dispatch({ type: 'SET_FRIENDS', friends });
    dispatch({ type: 'SET_LOADED' });
  }, []);

  const startDiscovery = useCallback(async (displayName: string) => {
    await api.social.startSocialDiscovery(displayName);
    dispatch({ type: 'SET_DISCOVERING', active: true });
  }, []);

  const stopDiscovery = useCallback(async () => {
    await api.social.stopSocialDiscovery();
    dispatch({ type: 'SET_DISCOVERING', active: false });
  }, []);

  const scanPeers = useCallback(async () => {
    const peers = await api.social.scanSocialPeers();
    dispatch({ type: 'SET_DISCOVERED_PEERS', peers });
  }, []);

  const addFriend = useCallback(async (id: string, name: string) => {
    await api.social.addFriend(id, name);
    dispatch({ type: 'ADD_FRIEND', friend: { id, name, status: 'offline', current_game: null } });
  }, []);

  const removeFriend = useCallback(async (id: string) => {
    await api.social.removeFriend(id);
    dispatch({ type: 'REMOVE_FRIEND', id });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SocialContext.Provider
      value={{ ...state, load, startDiscovery, stopDiscovery, scanPeers, addFriend, removeFriend }}
    >
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialProvider');
  return ctx;
}
