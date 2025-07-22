/**
 * Beemi Modular SDK v2.0 - Complete Bundle
 * This file combines all SDK modules into a single script for CDN serving
 * Can be loaded via: https://cdn.jsdelivr.net/gh/your-repo/beemi-sdk/release/beemi-sdk-modular-v2.js
 */

(function() {
  'use strict';
  
  // ===== CORE MODULE =====
  function createCoreModule(config = {}) {
    const coreModule = {
      version: '2.0.0',
      debug: config.debug || false,
      
      // Event system
      listeners: new Map(),
      
      on(type, callback) {
        if (typeof type !== 'string' || typeof callback !== 'function') {
          throw new Error('Invalid arguments for on()');
        }
        
        if (!this.listeners.has(type)) {
          this.listeners.set(type, []);
        }
        
        this.listeners.get(type).push(callback);
        
        if (this.debug) {
          console.log('[Beemi Core] Event listener added:', type);
        }
      },
      
      off(type, callback) {
        if (!this.listeners.has(type)) return;
        
        const typeListeners = this.listeners.get(type);
        const index = typeListeners.indexOf(callback);
        if (index > -1) {
          typeListeners.splice(index, 1);
        }
        
        if (typeListeners.length === 0) {
          this.listeners.delete(type);
        }
        
        if (this.debug) {
          console.log('[Beemi Core] Event listener removed:', type);
        }
      },
      
      emit(type, data) {
        if (!this.listeners.has(type)) return;
        
        const typeListeners = [...this.listeners.get(type)];
        typeListeners.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`[Beemi Core] Error in event listener for ${type}:`, error);
          }
        });
        
        if (this.debug) {
          console.log('[Beemi Core] Event emitted:', type, data);
        }
      },
      
      getListeners() {
        const result = {};
        this.listeners.forEach((listeners, type) => {
          result[type] = listeners.length;
        });
        return result;
      },
      
      // React Native Bridge
      bridge: {
        isNativeEnvironment: false,
        bridgeReady: false,
        messageQueue: [],
        
        detectEnvironment() {
          this.isNativeEnvironment = !!(window.ReactNativeWebView || window.webkit?.messageHandlers?.ReactNativeWebView);
          return this.isNativeEnvironment;
        },
        
        init() {
          this.detectEnvironment();
          
          if (this.isNativeEnvironment) {
            if (window.ReactNativeWebView) {
              this.bridgeReady = true;
              this.processMessageQueue();
            }
          }
          
          coreModule.log('info', 'Bridge initialized', {
            isNative: this.isNativeEnvironment,
            ready: this.bridgeReady
          });
        },
        
        sendMessage(message) {
          if (!this.isNativeEnvironment) {
            coreModule.log('debug', 'Simulated native message:', message);
            return;
          }
          
          if (this.bridgeReady && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          } else {
            this.messageQueue.push(message);
          }
        },
        
        processMessageQueue() {
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
          }
        },
        
        getBridgeInfo() {
          return {
            isNative: this.isNativeEnvironment,
            ready: this.bridgeReady,
            queueSize: this.messageQueue.length
          };
        }
      },
      
      // Logging system
      logger: {
        levels: { error: 0, warn: 1, info: 2, debug: 3 },
        currentLevel: 1,
        logHistory: [],
        maxHistorySize: 100,
        
        setLevel(level) {
          if (typeof level === 'string' && this.levels.hasOwnProperty(level)) {
            this.currentLevel = this.levels[level];
          } else if (typeof level === 'number') {
            this.currentLevel = level;
          }
        },
        
        log(level, message, ...args) {
          const levelNum = typeof level === 'string' ? this.levels[level] : level;
          
          if (levelNum <= this.currentLevel) {
            const logEntry = {
              timestamp: Date.now(),
              level,
              message,
              args
            };
            
            this.logHistory.push(logEntry);
            if (this.logHistory.length > this.maxHistorySize) {
              this.logHistory.shift();
            }
            
            console[level] && typeof console[level] === 'function' 
              ? console[level](`[Beemi SDK]`, message, ...args)
              : console.log(`[Beemi SDK] ${level.toUpperCase()}:`, message, ...args);
          }
        },
        
        getHistory() {
          return [...this.logHistory];
        }
      },
      
      // Initialization
      init() {
        this.bridge.init();
        
        // Global error handlers
        if (typeof window !== 'undefined') {
          window.addEventListener('error', (event) => {
            this.logger.log('error', 'Global error:', event.error);
          });
          
          window.addEventListener('unhandledrejection', (event) => {
            this.logger.log('error', 'Unhandled promise rejection:', event.reason);
          });
        }
        
        this.logger.log('info', 'Beemi Core SDK initialized', {
          version: this.version,
          environment: this.bridge.getBridgeInfo()
        });
      },
      
      // Public API methods
      isReady() {
        return this.bridge.bridgeReady || !this.bridge.isNativeEnvironment;
      },
      
      getBridgeInfo() {
        return this.bridge.getBridgeInfo();
      },
      
      log(level, message, ...args) {
        this.logger.log(level, message, ...args);
      },
      
      setLogLevel(level) {
        this.logger.setLevel(level);
      }
    };
    
    return coreModule;
  }
  
  // ===== MULTIPLAYER MODULE =====
  function createMultiplayerModule(config = {}) {
    const roomConfig = config.config || {};
    
    const multiplayerModule = {
      version: '2.0.0',
      debug: config.debug || false,
      roomConfig,
      currentRoomState: null,
      
      // Room management
      room: {
        async host(gameId, options = {}) {
          const roomOptions = { ...roomConfig, ...options };
          multiplayerModule.core.bridge.sendMessage({
            type: 'beemi-multiplayer',
            action: 'host-room',
            gameId,
            options: roomOptions
          });
          return new Promise((resolve) => {
            multiplayerModule.core.on('room-hosted', resolve);
          });
        },
        
        async join(joinCode) {
          multiplayerModule.core.bridge.sendMessage({
            type: 'beemi-multiplayer', 
            action: 'join-room',
            joinCode
          });
          return new Promise((resolve) => {
            multiplayerModule.core.on('room-joined', resolve);
          });
        },
        
        async quickPlay(gameId) {
          multiplayerModule.core.bridge.sendMessage({
            type: 'beemi-multiplayer',
            action: 'quick-play',
            gameId
          });
          return new Promise((resolve) => {
            multiplayerModule.core.on('room-joined', resolve);
          });
        },
        
        async leave() {
          multiplayerModule.core.bridge.sendMessage({
            type: 'beemi-multiplayer',
            action: 'leave-room'
          });
          multiplayerModule.currentRoomState = null;
        },
        
        getState() {
          return multiplayerModule.currentRoomState;
        }
      },
      
      // CRDT (Shared State)
      crdt: {
        watchers: new Map(),
        
        get(key) {
          return multiplayerModule.currentRoomState?.sharedState?.[key];
        },
        
        set(key, value) {
          multiplayerModule.core.bridge.sendMessage({
            type: 'beemi-crdt',
            action: 'set',
            key,
            value
          });
        },
        
        watch(key, callback) {
          if (!this.watchers.has(key)) {
            this.watchers.set(key, []);
          }
          this.watchers.get(key).push(callback);
        },
        
        unwatch(key, callback) {
          if (!this.watchers.has(key)) return;
          const callbacks = this.watchers.get(key);
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        },
        
        handleUpdate(data) {
          const { key, value } = data;
          if (this.watchers.has(key)) {
            this.watchers.get(key).forEach(callback => callback(value, key));
          }
        }
      },
      
      // Mutex (Distributed Locking)
      mutex: {
        activeLocks: new Map(),
        
        async exec(key, ttl, callback) {
          const acquired = await this.acquire(key, ttl);
          if (acquired) {
            try {
              const result = await callback();
              return result;
            } finally {
              await this.release(key);
            }
          }
          throw new Error(`Failed to acquire mutex: ${key}`);
        },
        
        async acquire(key, ttl = 30000) {
          return new Promise((resolve) => {
            const lockId = Date.now() + Math.random();
            this.activeLocks.set(key, lockId);
            
            multiplayerModule.core.bridge.sendMessage({
              type: 'beemi-mutex',
              action: 'acquire',
              key,
              ttl,
              lockId
            });
            
            const handleAcquired = (data) => {
              if (data.key === key && data.lockId === lockId) {
                multiplayerModule.core.off('mutex-acquired', handleAcquired);
                resolve(data.success);
              }
            };
            
            multiplayerModule.core.on('mutex-acquired', handleAcquired);
          });
        },
        
        async release(key) {
          const lockId = this.activeLocks.get(key);
          if (lockId) {
            this.activeLocks.delete(key);
            multiplayerModule.core.bridge.sendMessage({
              type: 'beemi-mutex',
              action: 'release',
              key,
              lockId
            });
          }
        }
      },
      
      // Leadership helpers
      leadership: {
        leaderCallbacks: [],
        
        ifLeader(callback) {
          if (multiplayerModule.currentRoomState?.isLeader) {
            callback();
          }
        },
        
        isLeader() {
          return multiplayerModule.currentRoomState?.isLeader || false;
        },
        
        onLeaderChange(callback) {
          this.leaderCallbacks.push(callback);
        },
        
        handleLeaderChange(data) {
          this.leaderCallbacks.forEach(callback => callback(data));
        }
      },
      
      // Initialization
      init(coreModule) {
        this.core = coreModule;
        
        // Set up event handlers
        this.core.on('room-state', (state) => {
          this.currentRoomState = state;
        });
        
        this.core.on('crdt-update', (data) => {
          this.crdt.handleUpdate(data);
        });
        
        this.core.on('leader-changed', (data) => {
          this.leadership.handleLeaderChange(data);
        });
        
        this.core.log('info', 'Beemi Multiplayer SDK initialized', {
          version: this.version,
          roomConfig: this.roomConfig
        });
      },
      
      // Public API methods
      on(event, callback) {
        return this.core.on(event, callback);
      },
      
      emit(event, data) {
        return this.core.emit(event, data);
      },
      
      ifLeader(callback) {
        return this.leadership.ifLeader(callback);
      },
      
      isLeader() {
        return this.leadership.isLeader();
      },
      
      onLeaderChange(callback) {
        return this.leadership.onLeaderChange(callback);
      }
    };
    
    return multiplayerModule;
  }
  
  // ===== STREAMS MODULE =====
  function createStreamsModule(config = {}) {
    const platforms = config.platforms || ['tiktok', 'youtube', 'twitch'];
    
    const streamsModule = {
      version: '2.0.0',
      platforms,
      debug: config.debug || false,
      connections: new Map(),
      
      // Platform integrations
      tiktok: {
        currentUsername: null,
        
        async connect(username) {
          this.currentUsername = username;
          streamsModule.core.bridge.sendMessage({
            type: 'beemi-streams',
            platform: 'tiktok',
            action: 'connect',
            username
          });
          return Promise.resolve({ success: true, platform: 'tiktok', username });
        },
        
        async disconnect() {
          streamsModule.core.bridge.sendMessage({
            type: 'beemi-streams',
            platform: 'tiktok', 
            action: 'disconnect'
          });
          this.currentUsername = null;
        },
        
        getIdentifier() {
          return this.currentUsername;
        }
      },
      
      youtube: {
        currentChannelId: null,
        
        async connect(channelId) {
          this.currentChannelId = channelId;
          streamsModule.core.bridge.sendMessage({
            type: 'beemi-streams',
            platform: 'youtube',
            action: 'connect',
            channelId
          });
          return Promise.resolve({ success: true, platform: 'youtube', channelId });
        },
        
        async disconnect() {
          streamsModule.core.bridge.sendMessage({
            type: 'beemi-streams',
            platform: 'youtube',
            action: 'disconnect'
          });
          this.currentChannelId = null;
        },
        
        getIdentifier() {
          return this.currentChannelId;
        }
      },
      
      twitch: {
        currentChannel: null,
        
        async connect(channel) {
          this.currentChannel = channel;
          streamsModule.core.bridge.sendMessage({
            type: 'beemi-streams',
            platform: 'twitch',
            action: 'connect',
            channel
          });
          return Promise.resolve({ success: true, platform: 'twitch', channel });
        },
        
        async disconnect() {
          streamsModule.core.bridge.sendMessage({
            type: 'beemi-streams',
            platform: 'twitch',
            action: 'disconnect'
          });
          this.currentChannel = null;
        },
        
        getIdentifier() {
          return this.currentChannel;
        }
      },
      
      // Event handling shortcuts
      onChat(callback) {
        return this.core.on('stream-chat', callback);
      },
      
      onGift(callback) {
        return this.core.on('stream-gift', callback);
      },
      
      onLike(callback) {
        return this.core.on('stream-like', callback);
      },
      
      onFollow(callback) {
        return this.core.on('stream-follow', callback);
      },
      
      onViewerJoin(callback) {
        return this.core.on('stream-viewer-join', callback);
      },
      
      onViewerLeave(callback) {
        return this.core.on('stream-viewer-leave', callback);
      },
      
      // Utilities
      async getViewerCount() {
        return Promise.resolve(Math.floor(Math.random() * 1000) + 10);
      },
      
      async getStreamInfo() {
        return Promise.resolve({
          platforms: this.platforms,
          connections: Array.from(this.connections.keys()),
          totalViewers: await this.getViewerCount()
        });
      },
      
      // Initialization
      init(coreModule) {
        this.core = coreModule;
        
        this.core.log('info', 'Beemi Streams SDK initialized', {
          version: this.version,
          platforms: this.platforms
        });
      },
      
      // Public API methods
      on(event, callback) {
        return this.core.on(event, callback);
      },
      
      off(event, callback) {
        return this.core.off(event, callback);
      },
      
      getConnections() {
        return Array.from(this.connections.entries());
      }
    };
    
    return streamsModule;
  }
  
  // ===== DEVTOOLS MODULE =====
  function createDevToolsModule(config = {}) {
    const enableInProduction = config.enableInProduction || false;
    
    const devToolsModule = {
      version: '2.0.0',
      enableInProduction,
      debug: config.debug || false,
      
      get shouldEnable() {
        const isDevelopment = this.debug || window.location.href.includes('localhost');
        return isDevelopment || this.enableInProduction;
      },
      
      // Mock data generators
      mock: {
        streamEvents: {
          simulateChat(username, message) {
            const chatData = {
              user: {
                id: 'mock_' + Date.now(),
                username: username || 'MockUser',
                displayName: username || 'Mock User'
              },
              message: message || 'This is a mock chat message!'
            };
            devToolsModule.core.emit('stream-chat', chatData);
          },
          
          simulateGift(username, gift) {
            const giftData = {
              user: {
                id: 'mock_' + Date.now(),
                username: username || 'MockGifter'
              },
              gift: gift || {
                id: 'rose',
                name: 'Rose',
                value: 10
              }
            };
            devToolsModule.core.emit('stream-gift', giftData);
          }
        }
      },
      
      // Initialization
      init(coreModule) {
        this.core = coreModule;
        
        if (!this.shouldEnable) {
          this.core.log('info', 'DevTools disabled in production');
          return;
        }
        
        this.core.log('info', 'Beemi DevTools SDK initialized', {
          version: this.version,
          enabled: this.shouldEnable
        });
      },
      
      // Public API methods
      debug: {
        simulateChat: (username, message) => {
          if (devToolsModule.shouldEnable && devToolsModule.mock) {
            devToolsModule.mock.streamEvents.simulateChat(username, message);
          }
        }
      }
    };
    
    return devToolsModule;
  }
  
  // ===== MODULAR SDK INITIALIZER =====
  window.initBeemiModularSDK = function(config = {}) {
    try {
      console.log('🚀 [Beemi SDK] Initializing modular SDK v2.0...');
      
      // Initialize module registry
      window.BeemiModules = {};
      window.BeemiConfig = config;
      
      // Create core module (always required)
      const coreModule = createCoreModule(config.core || {});
      window.BeemiModules.core = coreModule;
      
      // Create conditional modules
      if (config.multiplayer?.required) {
        window.BeemiModules.multiplayer = createMultiplayerModule(config.multiplayer);
      }
      
      if (config.streams?.required) {
        window.BeemiModules.streams = createStreamsModule(config.streams);
      }
      
      if (config.devtools?.required) {
        window.BeemiModules.devtools = createDevToolsModule(config.devtools);
      }
      
      // Initialize modules
      coreModule.init();
      
      if (window.BeemiModules.multiplayer) {
        window.BeemiModules.multiplayer.init(coreModule);
      }
      
      if (window.BeemiModules.streams) {
        window.BeemiModules.streams.init(coreModule);
      }
      
      if (window.BeemiModules.devtools) {
        window.BeemiModules.devtools.init(coreModule);
      }
      
      // Create unified SDK interface
      window.beemi = {
        version: '2.0.0',
        modules: window.BeemiModules,
        config: config,
        
        // Core methods
        on: coreModule.on.bind(coreModule),
        off: coreModule.off.bind(coreModule),
        emit: coreModule.emit.bind(coreModule),
        isReady: coreModule.isReady.bind(coreModule),
        log: coreModule.log.bind(coreModule),
        
        // Conditional features
        ...(window.BeemiModules.multiplayer && {
          room: window.BeemiModules.multiplayer.room,
          crdt: window.BeemiModules.multiplayer.crdt,
          mutex: window.BeemiModules.multiplayer.mutex,
          ifLeader: window.BeemiModules.multiplayer.ifLeader.bind(window.BeemiModules.multiplayer),
          isLeader: window.BeemiModules.multiplayer.isLeader.bind(window.BeemiModules.multiplayer)
        }),
        
        ...(window.BeemiModules.streams && {
          streams: window.BeemiModules.streams,
          onChat: window.BeemiModules.streams.onChat.bind(window.BeemiModules.streams),
          onGift: window.BeemiModules.streams.onGift.bind(window.BeemiModules.streams),
          onLike: window.BeemiModules.streams.onLike.bind(window.BeemiModules.streams),
          onFollow: window.BeemiModules.streams.onFollow.bind(window.BeemiModules.streams)
        }),
        
        ...(window.BeemiModules.devtools && {
          debug: window.BeemiModules.devtools.debug,
          mock: window.BeemiModules.devtools.mock
        })
      };
      
      // Mark as ready
      window.beemiSDKReady = true;
      
      // Notify native bridge
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'beemi-sdk',
          action: 'ready',
          version: '2.0.0',
          modules: Object.keys(window.BeemiModules),
          timestamp: Date.now()
        }));
      }
      
      console.log('✅ [Beemi SDK] Modular SDK initialized successfully');
      console.log('📦 [Beemi SDK] Available modules:', Object.keys(window.BeemiModules));
      
      return window.beemi;
      
    } catch (error) {
      console.error('❌ [Beemi SDK] Failed to initialize modular SDK:', error);
      window.beemiSDKError = error.message;
      
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'beemi-sdk',
          action: 'error',
          error: error.message,
          timestamp: Date.now()
        }));
      }
      
      throw error;
    }
  };
  
  console.log('📦 [Beemi SDK] Modular SDK v2.0 loaded and ready for initialization');
  
})(); 