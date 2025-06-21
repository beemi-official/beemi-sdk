/**
 * Beemi SDK v0.1
 * Multiplayer game SDK that abstracts transport layer and provides
 * room management, event bus, leader election, and shared state primitives.
 */

// =============================================================================
// 1. TRANSPORT ABSTRACTION
// =============================================================================

class Transport {
  constructor() {
    this.isConnected = false;
    this.messageQueue = [];
    this.messageHandlers = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.lastSequence = 0;
    this.pendingFrames = new Map(); // For resending unacked frames
  }

  // Detect if we're in React Native WebView or browser
  detectTransport() {
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      return 'bridge';
    } else if (typeof WebSocket !== 'undefined') {
      return 'websocket';
    } else {
      throw new Error('No supported transport available');
    }
  }

  async connect(config) {
    const transportType = this.detectTransport();
    
    if (transportType === 'bridge') {
      await this.connectViaBridge(config);
    } else {
      await this.connectViaWebSocket(config);
    }
  }

  async connectViaBridge(config) {
    // Set up bridge communication
    this.transportType = 'bridge';
    
    // Listen for messages from native layer
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.source === 'beemi') {
            this.handleIncomingMessage(data);
          }
        } catch (e) {
          console.warn('Failed to parse bridge message:', e);
        }
      });
    }

    this.isConnected = true;
    this.processQueue();
  }

  async connectViaWebSocket(config) {
    return new Promise((resolve, reject) => {
      const wsUrl = config.serverUrl || 'ws://localhost:8080';
      this.ws = new WebSocket(wsUrl);
      this.transportType = 'websocket';

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.processQueue();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.attemptReconnect(config);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  send(frame) {
    frame.seq = ++this.lastSequence;
    frame.timestamp = Date.now();

    if (frame.type !== 'heartbeat') {
      this.pendingFrames.set(frame.seq, frame);
    }

    if (this.isConnected) {
      this.sendFrame(frame);
    } else {
      this.messageQueue.push(frame);
    }
  }

  sendFrame(frame) {
    if (this.transportType === 'bridge') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        source: 'beemi',
        ...frame
      }));
    } else if (this.transportType === 'websocket' && this.ws) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  handleIncomingMessage(data) {
    // Handle ACKs
    if (data.type === 'ack' && data.seq) {
      this.pendingFrames.delete(data.seq);
    }

    // Forward to registered handlers
    this.messageHandlers.forEach(handler => handler(data));
  }

  processQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const frame = this.messageQueue.shift();
      this.sendFrame(frame);
    }
  }

  attemptReconnect(config) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect(config).then(() => {
        // Resend pending frames
        this.pendingFrames.forEach(frame => this.sendFrame(frame));
      }).catch(console.error);
    }, delay);
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }
}

// =============================================================================
// 2. ROOMS API
// =============================================================================

class Room {
  constructor(roomData) {
    this.id = roomData.roomId;
    this.code = roomData.joinCode;
    this.role = roomData.role || 'peer';
    this.gameId = roomData.gameId;
    this.maxPlayers = roomData.maxPlayers;
    this.members = roomData.members || [];
    this.leaderId = roomData.leaderId;
    
    this.eventListeners = {};
    this.leaderCallbacks = [];
    this.isLeaderCallbacksExecuted = false;
  }

  // Event bus methods
  emit(type, payload) {
    const frame = {
      type: 'event',
      roomId: this.id,
      eventType: type,
      payload: payload
    };
    transport.send(frame);
  }

  on(type, callback) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(callback);
  }

  off(type, callback) {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(cb => cb !== callback);
    }
  }

  // Leader helper
  ifLeader(callback) {
    this.leaderCallbacks.push(callback);
    if (this.role === 'leader' && !this.isLeaderCallbacksExecuted) {
      this.executeLeaderCallbacks();
    }
  }

  executeLeaderCallbacks() {
    this.isLeaderCallbacksExecuted = true;
    this.leaderCallbacks.forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('Error executing leader callback:', e);
      }
    });
  }

  // Get current players
  async players() {
    return this.members.map(m => m.id);
  }

  // Share link helper
  shareLink() {
    return `beemi://join/${this.gameId}/${this.code}`;
  }

  // Handle incoming messages
  handleMessage(data) {
    switch (data.type) {
      case 'event':
        if (data.roomId === this.id && this.eventListeners[data.eventType]) {
          this.eventListeners[data.eventType].forEach(callback => callback(data.payload));
        }
        break;
      case 'roleChange':
        if (data.roomId === this.id) {
          const wasLeader = this.role === 'leader';
          this.role = data.newLeader === data.memberId ? 'leader' : 'peer';
          this.leaderId = data.newLeader;
          
          if (this.role === 'leader' && !wasLeader) {
            this.isLeaderCallbacksExecuted = false;
            this.executeLeaderCallbacks();
          }
        }
        break;
      case 'memberJoined':
      case 'memberLeft':
        if (data.roomId === this.id) {
          this.members = data.members || [];
        }
        break;
    }
  }
}

// =============================================================================
// 3. SHARED STATE (CRDT)
// =============================================================================

class CRDT {
  constructor(roomId) {
    this.roomId = roomId;
    this.data = {};
    this.watchers = {};
  }

  get(key) {
    return this.data[key]?.value;
  }

  set(key, value) {
    const version = (this.data[key]?.version || 0) + 1;
    this.data[key] = { value, version };

    const frame = {
      type: 'crdt',
      roomId: this.roomId,
      key,
      value,
      version
    };
    transport.send(frame);

    this.notifyWatchers(key, value);
  }

  watch(key, callback) {
    if (!this.watchers[key]) {
      this.watchers[key] = [];
    }
    this.watchers[key].push(callback);
  }

  unwatch(key, callback) {
    if (this.watchers[key]) {
      this.watchers[key] = this.watchers[key].filter(cb => cb !== callback);
    }
  }

  handleUpdate(data) {
    if (data.roomId !== this.roomId) return;

    const currentVersion = this.data[data.key]?.version || 0;
    if (data.version > currentVersion) {
      this.data[data.key] = { value: data.value, version: data.version };
      this.notifyWatchers(data.key, data.value);
    }
  }

  notifyWatchers(key, value) {
    if (this.watchers[key]) {
      this.watchers[key].forEach(callback => {
        try {
          callback(value, key);
        } catch (e) {
          console.error('Error in CRDT watcher:', e);
        }
      });
    }
  }
}

// =============================================================================
// 4. MUTEX MANAGER
// =============================================================================

class Mutex {
  constructor(roomId) {
    this.roomId = roomId;
    this.locks = {};
  }

  async exec(key, ttl, fn) {
    const lockFrame = {
      type: 'lock',
      roomId: this.roomId,
      key,
      ttl
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to acquire lock for key: ${key}`));
      }, ttl + 1000);

      const handleLockResponse = (data) => {
        if (data.type === 'lockAcquired' && data.key === key && data.roomId === this.roomId) {
          clearTimeout(timeout);
          transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleLockResponse);
          
          try {
            const result = fn();
            Promise.resolve(result).then(resolve).catch(reject).finally(() => {
              this.release(key);
            });
          } catch (error) {
            this.release(key);
            reject(error);
          }
        } else if (data.type === 'lockFailed' && data.key === key && data.roomId === this.roomId) {
          clearTimeout(timeout);
          transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleLockResponse);
          reject(new Error(`Lock acquisition failed for key: ${key}`));
        }
      };

      transport.onMessage(handleLockResponse);
      transport.send(lockFrame);
    });
  }

  release(key) {
    const unlockFrame = {
      type: 'unlock',
      roomId: this.roomId,
      key
    };
    transport.send(unlockFrame);
  }
}

// =============================================================================
// 5. MAIN SDK INTERFACE
// =============================================================================

const transport = new Transport();
const rooms = {};
const crdtInstances = {};
const mutexInstances = {};

// Room management functions
async function host(gameId, options = {}) {
  const config = {
    serverUrl: options.serverUrl,
    ...options
  };

  await transport.connect(config);

  return new Promise((resolve, reject) => {
    const createFrame = {
      type: 'createRoom',
      gameId,
      maxPlayers: options.max || 4,
      visibility: 'private'
    };

    const handleResponse = (data) => {
      if (data.type === 'roomCreated') {
        transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleResponse);
        const room = new Room({ ...data, role: 'leader' });
        rooms[room.id] = room;
        
        // Set up message handling for this room
        transport.onMessage((msg) => room.handleMessage(msg));
        
        resolve(room);
      } else if (data.type === 'error') {
        transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleResponse);
        reject(new Error(data.message));
      }
    };

    transport.onMessage(handleResponse);
    transport.send(createFrame);
  });
}

async function quickPlay(gameId, options = {}) {
  const config = {
    serverUrl: options.serverUrl,
    ...options
  };

  await transport.connect(config);

  return new Promise((resolve, reject) => {
    const joinFrame = {
      type: 'quickPlay',
      gameId,
      maxPlayers: options.max || 4
    };

    const handleResponse = (data) => {
      if (data.type === 'roomJoined') {
        transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleResponse);
        const room = new Room(data);
        rooms[room.id] = room;
        
        // Set up message handling for this room
        transport.onMessage((msg) => room.handleMessage(msg));
        
        resolve(room);
      } else if (data.type === 'error') {
        transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleResponse);
        reject(new Error(data.message));
      }
    };

    transport.onMessage(handleResponse);
    transport.send(joinFrame);
  });
}

async function joinByCode(gameId, code, options = {}) {
  const config = {
    serverUrl: options.serverUrl,
    ...options
  };

  await transport.connect(config);

  return new Promise((resolve, reject) => {
    const joinFrame = {
      type: 'joinByCode',
      gameId,
      joinCode: code
    };

    const handleResponse = (data) => {
      if (data.type === 'roomJoined') {
        transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleResponse);
        const room = new Room(data);
        rooms[room.id] = room;
        
        // Set up message handling for this room
        transport.onMessage((msg) => room.handleMessage(msg));
        
        resolve(room);
      } else if (data.type === 'error') {
        transport.messageHandlers = transport.messageHandlers.filter(h => h !== handleResponse);
        reject(new Error(data.message));
      }
    };

    transport.onMessage(handleResponse);
    transport.send(joinFrame);
  });
}

// CRDT helper functions
function getCRDT(roomId) {
  if (!crdtInstances[roomId]) {
    crdtInstances[roomId] = new CRDT(roomId);
    // Set up CRDT message handling
    transport.onMessage((data) => {
      if (data.type === 'crdt') {
        crdtInstances[roomId].handleUpdate(data);
      }
    });
  }
  return crdtInstances[roomId];
}

// Mutex helper functions
function getMutex(roomId) {
  if (!mutexInstances[roomId]) {
    mutexInstances[roomId] = new Mutex(roomId);
  }
  return mutexInstances[roomId];
}

// =============================================================================
// 6. EXPORTS
// =============================================================================

// Main SDK interface
export const sdk = {
  rooms: {
    host,
    quickPlay,
    joinByCode
  }
};

// Convenience exports for games
export { host, quickPlay, joinByCode };

// Global CRDT and Mutex interfaces
export const crdt = {
  get: (key) => {
    const room = Object.values(rooms)[0]; // Get first room for now
    if (!room) throw new Error('No active room');
    return getCRDT(room.id).get(key);
  },
  set: (key, value) => {
    const room = Object.values(rooms)[0];
    if (!room) throw new Error('No active room');
    getCRDT(room.id).set(key, value);
  },
  watch: (key, callback) => {
    const room = Object.values(rooms)[0];
    if (!room) throw new Error('No active room');
    getCRDT(room.id).watch(key, callback);
  }
};

export const mutex = {
  exec: (key, ttl, fn) => {
    const room = Object.values(rooms)[0];
    if (!room) throw new Error('No active room');
    return getMutex(room.id).exec(key, ttl, fn);
  }
};

// Legacy event bus exports (for backward compatibility)
const legacyListeners = {};

export function on(type, cb) { 
  (legacyListeners[type] ||= []).push(cb); 
}

export function emit(type, data) { 
  (legacyListeners[type] || []).forEach(f => f(data)); 
}

export const leaderboard = { 
  update: data => emit('__leaderboard__', data) 
};

// Expose globally for RN bridge
if (typeof window !== 'undefined') {
  window.beemi = { 
    on, 
    emit, 
    leaderboard,
    rooms: { host, quickPlay, joinByCode },
    crdt,
    mutex,
    sdk
  };
} 