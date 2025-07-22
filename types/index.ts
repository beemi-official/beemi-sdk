// Beemi SDK v2.0 - Modular TypeScript Definitions

// Base event interface
export interface BaseEvent {
  id: string;
  timestamp: number;
  source: 'native' | 'web' | 'server';
}

// SDK Module Configuration Types
export interface SDKModuleManifest {
  core: CoreModuleConfig;
  'multiplayer-p2p'?: MultiplayerP2PModuleConfig;
  streams?: StreamsModuleConfig;
}

// Core Module (Always Required)
export interface CoreModuleConfig {
  required: true;
}

export interface CoreSDK {
  // Event system
  on<T = any>(event: string, callback: (data: T) => void): void;
  off(event: string, callback: Function): void;
  emit(event: string, data: any): void;
  
  // Bridge
  isReady(): boolean;
  getBridgeInfo(): BridgeInfo;
  
  // Logging
  log(level: 'info' | 'error' | 'debug', message: string): void;
}

export interface BridgeInfo {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  version: string;
}

// Multiplayer P2P Module  
export interface MultiplayerP2PModuleConfig {
  required: boolean;
  config?: {
    maxPlayers?: number;
    visibility?: 'public' | 'private';
    persistState?: boolean;
  };
}

export interface MultiplayerEvent extends BaseEvent {
  roomId: string;
  memberId: string;
}

export interface RoomStateEvent extends MultiplayerEvent {
  type: 'room-state';
  data: RoomState;
}

export interface PlayerJoinedEvent extends MultiplayerEvent {
  type: 'player-joined';
  data: {
    player: Player;
    playerCount: number;
    players: Player[];
  };
}

export interface PlayerLeftEvent extends MultiplayerEvent {
  type: 'player-left';
  data: {
    playerId: string;
    playerCount: number;
    players: Player[];
  };
}

export interface LeaderChangedEvent extends MultiplayerEvent {
  type: 'leader-changed';
  data: {
    newLeaderId: string;
    previousLeaderId: string;
    reason: 'disconnected' | 'timeout' | 'transfer';
  };
}

export interface CRDTUpdateEvent extends MultiplayerEvent {
  type: 'crdt-update';
  data: {
    key: string;
    value: any;
    version: number;
    updatedBy: string;
  };
}

export interface MutexEvent extends MultiplayerEvent {
  type: 'mutex-acquired' | 'mutex-released';
  data: {
    key: string;
    success: boolean;
    ttl?: number;
    holder?: string;
  };
}

export interface RoomState {
  roomId: string;
  joinCode: string;
  gameId: string;
  playerId: string;
  isLeader: boolean;
  playerCount: number;
  maxPlayers: number;
  leaderId: string;
  players: Player[];
  sharedState: Record<string, any>;
}

export interface Player {
  id: string;
  name: string;
  role?: string;
  isAlive: boolean;
  isHost: boolean;
}

export interface RoomOptions {
  max?: number;
  visibility?: 'public' | 'private';
}

export interface MultiplayerSDK {
  // Room management
  room: {
    host(gameId: string, options?: RoomOptions): Promise<RoomState>;
    join(joinCode: string): Promise<RoomState>;
    quickPlay(gameId: string): Promise<RoomState>;
    leave(): Promise<void>;
    getState(): RoomState | null;
  };
  
  // Event system (typed)
  on(event: 'room-state', callback: (data: RoomStateEvent['data']) => void): void;
  on(event: 'player-joined', callback: (data: PlayerJoinedEvent['data']) => void): void;
  on(event: 'player-left', callback: (data: PlayerLeftEvent['data']) => void): void;
  on(event: 'leader-changed', callback: (data: LeaderChangedEvent['data']) => void): void;
  on(event: 'crdt-update', callback: (data: CRDTUpdateEvent['data']) => void): void;
  on(event: 'mutex-acquired' | 'mutex-released', callback: (data: MutexEvent['data']) => void): void;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data: any): void;
  
  // CRDT (Shared State)
  crdt: {
    get<T = any>(key: string): T | undefined;
    set<T = any>(key: string, value: T): void;
    watch<T = any>(key: string, callback: (value: T, key: string) => void): void;
    unwatch(key: string, callback: Function): void;
  };
  
  // Mutex (Distributed Locking)
  mutex: {
    exec<T = any>(key: string, ttl: number, callback: () => T | Promise<T>): Promise<T>;
    acquire(key: string, ttl: number): Promise<boolean>;
    release(key: string): Promise<void>;
  };
  
  // Leader helpers
  ifLeader(callback: () => void | Promise<void>): void;
  isLeader(): boolean;
  onLeaderChange(callback: (data: LeaderChangedEvent['data']) => void): void;
}

// Streams Module
export interface StreamsModuleConfig {
  required: boolean;
}

export interface StreamEvent extends BaseEvent {
  streamId: string;
  platform: 'tiktok' | 'youtube' | 'twitch' | 'generic';
}

export interface StreamChatEvent extends StreamEvent {
  type: 'stream-chat';
  data: {
    user: StreamUser;
    message: string;
    messageId: string;
  };
}

export interface StreamGiftEvent extends StreamEvent {
  type: 'stream-gift';
  data: {
    user: StreamUser;
    gift: {
      id: string;
      name: string;
      emoji: string;
      value: number;
      count: number;
    };
  };
}

export interface StreamLikeEvent extends StreamEvent {
  type: 'stream-like';
  data: {
    user: StreamUser;
    count: number;
  };
}

export interface StreamFollowEvent extends StreamEvent {
  type: 'stream-follow';
  data: {
    user: StreamUser;
  };
}

export interface StreamViewerEvent extends StreamEvent {
  type: 'stream-viewer-join' | 'stream-viewer-leave' | 'stream-viewer-count';
  data: {
    user?: StreamUser;
    count?: number;
    total?: number;
  };
}

export interface StreamUser {
  id: string;
  username: string;
  displayName: string;
  imageUrl?: string;
  isFollower?: boolean;
  isModerator?: boolean;
  isSubscriber?: boolean;
  badges?: string[];
}

export interface StreamInfo {
  platform: string;
  streamId: string;
  title?: string;
  viewerCount: number;
  isLive: boolean;
}

export interface PlatformIntegration {
  connect(identifier: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getIdentifier(): string | null;
}

export interface StreamsSDK {
  // Event listeners (typed)
  on(event: 'stream-chat', callback: (data: StreamChatEvent['data']) => void): void;
  on(event: 'stream-gift', callback: (data: StreamGiftEvent['data']) => void): void;
  on(event: 'stream-like', callback: (data: StreamLikeEvent['data']) => void): void;
  on(event: 'stream-follow', callback: (data: StreamFollowEvent['data']) => void): void;
  on(event: 'stream-viewer-join' | 'stream-viewer-leave' | 'stream-viewer-count', callback: (data: StreamViewerEvent['data']) => void): void;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: Function): void;
  
  // Platform integrations
  tiktok: PlatformIntegration;
  youtube: PlatformIntegration;
  twitch: PlatformIntegration;
  
  // Event handling shortcuts
  onChat(callback: (data: StreamChatEvent['data']) => void): void;
  onGift(callback: (data: StreamGiftEvent['data']) => void): void;
  onLike(callback: (data: StreamLikeEvent['data']) => void): void;
  onFollow(callback: (data: StreamFollowEvent['data']) => void): void;
  onViewerJoin(callback: (data: StreamViewerEvent['data']) => void): void;
  onViewerLeave(callback: (data: StreamViewerEvent['data']) => void): void;
  
  // Utilities
  getViewerCount(): Promise<number>;
  getStreamInfo(): Promise<StreamInfo>;
}



export interface TestUser {
  id: string;
  username: string;
  simulate(): void;
}

export interface TestRoom {
  id: string;
  playerCount: number;
  simulate(): void;
}

export interface TestStream {
  platform: string;
  simulate(): void;
}

export interface EventInspector {
  getHistory(): any[];
  filter(type: string): any[];
  clear(): void;
}

export interface NetworkMonitor {
  start(): void;
  stop(): void;
  getStats(): any;
}



// Conditional SDK Types based on manifest
export type BeemiSDK<T extends SDKModuleManifest> = 
  CoreSDK & 
  (T['multiplayer-p2p'] extends { required: true } ? MultiplayerSDK : {}) &
  (T['streams'] extends { required: true } ? StreamsSDK : {});

// Module loader types
export interface ModuleLoadResult {
  success: boolean;
  content?: string;
  error?: string;
  size?: number;
}

export interface SDKInjectionOptions {
  gameId: string;
  gameUrl: string;
  manifest?: SDKModuleManifest;
  fallbackToLegacy?: boolean;
}

// Global window interface extension
declare global {
  interface Window {
    BeemiModules?: any;
    BeemiConfig?: SDKModuleManifest;
    beemi?: any;
    beemiSDKReady?: boolean;
    beemiSDKError?: string;
  }
} 