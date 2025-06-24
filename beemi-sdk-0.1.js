/* 
 * Beemi SDK v0.1 - Multiplayer Game SDK
 * 
 * Provides multiplayer functionality through React Native bridge:
 * - Room management (host, join, quickPlay)
 * - Real-time event broadcasting
 * - Leader election and role management
 * - Shared state (CRDT) management
 * - Distributed mutex/locking
 */

/* Event bus for internal communication */
const listeners = {};
let roomState = null;
let isInitialized = false;
let currentRoom = null;
let messageId = 0;
let pendingCallbacks = new Map();

/* Core event system */
function on(type, cb) { 
  (listeners[type] ||= []).push(cb); 
}

function emit(type, data) { 
  (listeners[type] || []).forEach(f => f(data)); 
}

/* React Native Bridge Communication */
function sendToNative(message) {
  const msgId = ++messageId;
  const payload = {
    type: 'beemi-multiplayer',
    messageId: msgId,
    timestamp: Date.now(),
    ...message
  };
  
  console.log('📤 Sending to RN:', payload);
  
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  } else {
    // Browser fallback - simulate for testing
    console.log('🔄 Browser fallback - simulating RN response');
    simulateBrowserResponse(payload);
  }
  
  return msgId;
}

function handleNativeMessage(message) {
  console.log('📥 Received from RN:', message);
  
  // Handle responses to specific message IDs
  if (message.messageId && pendingCallbacks.has(message.messageId)) {
    const callback = pendingCallbacks.get(message.messageId);
    pendingCallbacks.delete(message.messageId);
    callback(message);
    return;
  }
  
  switch (message.type) {
    case 'room-state':
      updateRoomState(message.data);
      break;
    case 'room-joined':
    case 'room-created':
      updateRoomState(message.data);
      emit('room-ready', message.data);
      break;
    case 'player-joined':
      if (roomState) {
        roomState.playerCount = message.data.playerCount;
        roomState.players = message.data.players;
      }
      emit('player-joined', message.data);
      break;
    case 'player-left':
      if (roomState) {
        roomState.playerCount = message.data.playerCount;
        roomState.players = message.data.players;
      }
      emit('player-left', message.data);
      break;
    case 'leader-changed':
      if (roomState) {
        const wasLeader = roomState.isLeader;
        roomState.isLeader = message.data.newLeaderId === roomState.playerId;
        roomState.leaderId = message.data.newLeaderId;
        
        console.log(`👑 Leadership change: ${wasLeader} -> ${roomState.isLeader} (my ID: ${roomState.playerId}, new leader: ${message.data.newLeaderId})`);
        
        emit('leader-changed', {
          ...message.data,
          isLeader: roomState.isLeader,
          wasLeader
        });
        
        // Trigger leader callbacks if we became leader
        if (!wasLeader && roomState.isLeader && currentRoom) {
          currentRoom._triggerLeaderCallbacks();
        }
      }
      break;
    case 'room-event':
      emit(message.data.eventType, message.data.payload);
      break;
    case 'crdt-update':
      if (roomState && roomState.sharedState) {
        roomState.sharedState[message.data.key] = message.data.value;
      }
      emit('crdt-update', message.data);
      break;
    case 'mutex-acquired':
      emit('mutex-acquired', message.data);
      break;
    case 'mutex-released':
      emit('mutex-released', message.data);
      break;
    case 'players-list':
      emit('players-list', message.data);
      break;
    case 'error':
      console.error('❌ RN Error:', message.error);
      emit('error', message);
      break;
  }
}

function updateRoomState(newState) {
  const oldState = roomState;
  roomState = { ...newState };
  
  console.log('🏠 Room state updated:', {
    playerId: roomState.playerId,
    isLeader: roomState.isLeader,
    playerCount: roomState.playerCount,
    leaderId: roomState.leaderId
  });
  
  // Notify about state changes
  if (oldState?.playerId !== newState.playerId) {
    emit('player-id-changed', { playerId: newState.playerId });
  }
  
  if (oldState?.isLeader !== newState.isLeader) {
    console.log(`🔄 Role changed: ${oldState?.isLeader} -> ${newState.isLeader}`);
    emit('role-changed', { 
      isLeader: newState.isLeader, 
      role: newState.isLeader ? 'leader' : 'peer',
      playerId: newState.playerId
    });
  }
  
  if (oldState?.playerCount !== newState.playerCount) {
    emit('player-count-changed', { count: newState.playerCount });
  }
  
  emit('room-state-updated', roomState);
}

/* Room Management API */
const rooms = {
  async quickPlay(gameId, options = {}) {
    return new Promise((resolve, reject) => {
      console.log('🎮 QuickPlay request:', gameId, options);
      
      const msgId = sendToNative({
        action: 'quick-play',
        gameId,
        options
      });
      
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 15000);
      
      const handleRoomReady = (state) => {
        clearTimeout(timeout);
        console.log('✅ QuickPlay successful:', state);
        const room = createRoomObject(state);
        currentRoom = room;
        resolve(room);
      };
      
      // Listen for room ready event
      const removeListener = () => {
        // Clean up listener
      };
      
      on('room-ready', handleRoomReady);
    });
  },
  
  async host(gameId, options = {}) {
    return new Promise((resolve, reject) => {
      console.log('🏠 Host request:', gameId, options);
      
      const msgId = sendToNative({
        action: 'host-room',
        gameId,
        options
      });
      
      const timeout = setTimeout(() => {
        reject(new Error('Room creation timeout'));
      }, 15000);
      
      const handleRoomReady = (state) => {
        clearTimeout(timeout);
        console.log('✅ Host successful:', state);
        const room = createRoomObject(state);
        currentRoom = room;
        resolve(room);
      };
      
      on('room-ready', handleRoomReady);
    });
  },
  
  async joinByCode(gameId, code, options = {}) {
    return new Promise((resolve, reject) => {
      console.log('🔑 Join by code:', gameId, code);
      
      const msgId = sendToNative({
        action: 'join-by-code',
        gameId,
        code,
        options
      });
      
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 15000);
      
      const handleRoomReady = (state) => {
        clearTimeout(timeout);
        console.log('✅ Join successful:', state);
        const room = createRoomObject(state);
        currentRoom = room;
        resolve(room);
      };
      
      on('room-ready', handleRoomReady);
    });
  }
};

/* Room Object Factory */
function createRoomObject(state) {
  const leaderCallbacks = [];
  let leaderCallbacksExecuted = false;
  
  const room = {
    id: state.roomId,
    code: state.joinCode,
    gameId: state.gameId,
    role: state.isLeader ? 'leader' : 'peer',
    playerId: state.playerId,
    playerCount: state.playerCount,
    maxPlayers: state.maxPlayers,
    isLeader: state.isLeader,
    leaderId: state.leaderId,
    players: state.players || [],
    
    // Event broadcasting
    emit(eventType, payload) {
      console.log(`📡 Broadcasting event: ${eventType}`, payload);
      sendToNative({
        action: 'broadcast-event',
        eventType,
        payload,
        roomId: state.roomId
      });
    },
    
    on(eventType, callback) {
      on(eventType, callback);
    },
    
    off(eventType, callback) {
      if (listeners[eventType]) {
        listeners[eventType] = listeners[eventType].filter(cb => cb !== callback);
      }
    },
    
    // Leader-only operations
    ifLeader(callback) {
      leaderCallbacks.push(callback);
      
      // Execute immediately if currently leader
      if (state.isLeader && !leaderCallbacksExecuted) {
        console.log('👑 Executing leader callback immediately');
        try {
          callback();
          leaderCallbacksExecuted = true;
        } catch (error) {
          console.error('Error in leader callback:', error);
        }
      }
    },
    
    // Internal method to trigger leader callbacks
    _triggerLeaderCallbacks() {
      if (roomState && roomState.isLeader && !leaderCallbacksExecuted) {
        console.log('👑 Triggering leader callbacks after leadership change');
        leaderCallbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('Error in leader callback:', error);
          }
        });
        leaderCallbacksExecuted = true;
      }
    },
    
    // Player management
    async players() {
      return new Promise((resolve) => {
        if (roomState && roomState.players) {
          resolve(roomState.players);
          return;
        }
        
        sendToNative({
          action: 'get-players',
          roomId: state.roomId
        });
        
        const handlePlayersList = (data) => {
          resolve(data.players);
        };
        
        on('players-list', handlePlayersList);
      });
    },
    
    // Share link
    shareLink() {
      return `beemi://join/${state.gameId}/${state.joinCode}`;
    },
    
    // Get current room state
    getState() {
      return {
        ...roomState,
        role: roomState?.isLeader ? 'leader' : 'peer'
      };
    }
  };
  
  // Listen for leadership changes
  on('leader-changed', (data) => {
    if (data.isLeader && !data.wasLeader) {
      leaderCallbacksExecuted = false;
      room._triggerLeaderCallbacks();
    }
  });
  
  return room;
}

/* CRDT (Shared State) Management */
const crdt = {
  get(key) {
    const value = roomState?.sharedState?.[key];
    console.log(`📖 CRDT get: ${key} = ${value}`);
    return value;
  },
  
  set(key, value) {
    console.log(`📝 CRDT set: ${key} = ${value}`);
    
    // Update local state immediately
    if (roomState && roomState.sharedState) {
      roomState.sharedState[key] = value;
    }
    
    sendToNative({
      action: 'crdt-set',
      key,
      value,
      roomId: roomState?.roomId
    });
    
    // Trigger local watchers
    emit('crdt-update', { key, value });
  },
  
  watch(key, callback) {
    console.log(`👀 CRDT watch: ${key}`);
    on('crdt-update', (data) => {
      if (data.key === key) {
        callback(data.value, key);
      }
    });
  }
};

/* Mutex (Distributed Locking) */
const mutex = {
  async exec(key, ttl, callback) {
    console.log(`🔒 Mutex acquire: ${key} (ttl: ${ttl}ms)`);
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Mutex timeout: ${key}`));
      }, ttl + 1000);
      
      sendToNative({
        action: 'mutex-acquire',
        key,
        ttl,
        roomId: roomState?.roomId
      });
      
      const handleAcquired = (data) => {
        if (data.key === key) {
          clearTimeout(timeoutHandle);
          
          if (data.success) {
            console.log(`✅ Mutex acquired: ${key}`);
            try {
              const result = callback();
              Promise.resolve(result).then(resolve).catch(reject).finally(() => {
                console.log(`🔓 Mutex releasing: ${key}`);
                sendToNative({
                  action: 'mutex-release',
                  key,
                  roomId: roomState?.roomId
                });
              });
            } catch (error) {
              console.log(`🔓 Mutex releasing (error): ${key}`);
              sendToNative({
                action: 'mutex-release',
                key,
                roomId: roomState?.roomId
              });
              reject(error);
            }
          } else {
            reject(new Error(`Failed to acquire mutex: ${key}`));
          }
        }
      };
      
      on('mutex-acquired', handleAcquired);
    });
  }
};

/* Browser fallback simulation for testing */
function simulateBrowserResponse(payload) {
  setTimeout(() => {
    let response;
    
    switch (payload.action) {
      case 'quick-play':
      case 'host-room':
        // Simulate proper room state from React Native
        const isFirstClient = !window.beemiTestRoomExists;
        window.beemiTestRoomExists = true;
        
        response = {
          type: 'room-joined',
          messageId: payload.messageId,
          data: {
            roomId: 'test-room-123',
            joinCode: 'ABC123',
            gameId: payload.gameId || 'ping-demo',
            playerId: 'Player-' + Math.random().toString(36).substr(2, 4),
            isLeader: isFirstClient, // First client is leader, subsequent are peers
            playerCount: isFirstClient ? 1 : 2,
            maxPlayers: 4,
            leaderId: isFirstClient ? 'Player-leader' : 'Player-leader',
            players: isFirstClient ? ['Player-leader'] : ['Player-leader', 'Player-peer'],
            sharedState: {}
          }
        };
        break;
        
      case 'join-by-code':
        response = {
          type: 'room-joined',
          messageId: payload.messageId,
          data: {
            roomId: 'test-room-' + payload.code,
            joinCode: payload.code,
            gameId: payload.gameId || 'ping-demo',
            playerId: 'Player-' + Math.random().toString(36).substr(2, 4),
            isLeader: false, // Joining by code is never leader initially
            playerCount: 2,
            maxPlayers: 4,
            leaderId: 'Player-leader',
            players: ['Player-leader', 'Player-peer'],
            sharedState: {}
          }
        };
        break;
        
      case 'mutex-acquire':
        response = {
          type: 'mutex-acquired',
          messageId: payload.messageId,
          data: {
            key: payload.key,
            success: true
          }
        };
        break;
        
      case 'get-players':
        response = {
          type: 'players-list',
          messageId: payload.messageId,
          data: {
            players: roomState?.players || ['Player-1', 'Player-2']
          }
        };
        break;
    }
    
    if (response) {
      console.log('🔄 Simulated response:', response);
      handleNativeMessage(response);
    }
  }, 500 + Math.random() * 500); // Random delay to simulate network
}

/* Initialize SDK */
function initializeSDK() {
  if (isInitialized) return;
  
  console.log('🚀 Initializing Beemi SDK...');
  
  // Listen for messages from React Native
  if (window.ReactNativeWebView) {
    window.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type?.startsWith('beemi-') || 
            ['room-state', 'room-joined', 'room-created', 'player-joined', 'player-left', 
             'leader-changed', 'room-event', 'crdt-update', 'mutex-acquired', 'mutex-released', 
             'players-list', 'error'].includes(message.type)) {
          handleNativeMessage(message);
        }
      } catch (error) {
        console.error('Failed to parse RN message:', error);
      }
    });
    
    console.log('✅ React Native bridge connected');
  } else {
    console.log('🔄 Running in browser mode - using simulation');
  }
  
  // Process any pending messages that were queued before SDK initialization
  if (window.pendingMessages && Array.isArray(window.pendingMessages)) {
    console.log(`📥 Processing ${window.pendingMessages.length} queued messages...`);
    window.pendingMessages.forEach((message, index) => {
      console.log(`📥 Processing queued message ${index + 1}:`, message);
      handleNativeMessage(message);
    });
    // Clear the queue
    window.pendingMessages = [];
    console.log('✅ All queued messages processed');
  }
  
  // Request initial room state if we're in an active room
  sendToNative({
    action: 'get-room-state'
  });
  
  isInitialized = true;
  emit('sdk-initialized');
  
  // Notify React Native that SDK is ready
  if (window.ReactNativeWebView) {
    console.log('📤 [SDK] Sending ready message to React Native...');
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'beemi',
      action: 'ready',
      timestamp: Date.now()
    }));
  }
}

/* Legacy compatibility */
const leaderboard = { 
  update: data => emit('__leaderboard__', data) 
};

/* Global exposure for RN bridge and debugging */
if (typeof window !== 'undefined') {
  window.beemi = { 
    on, 
    emit, 
    rooms, 
    crdt, 
    mutex, 
    leaderboard,
    // Convenience shortcuts to rooms methods
    quickPlay: rooms.quickPlay.bind(rooms),
    host: rooms.host.bind(rooms),
    joinByCode: rooms.joinByCode.bind(rooms),
    // Internal methods for RN bridge and debugging
    _handleNativeMessage: handleNativeMessage,
    _getRoomState: () => roomState,
    _getCurrentRoom: () => currentRoom,
    _sendToNative: sendToNative
  };
  
  // Auto-initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSDK);
  } else {
    initializeSDK();
  }
} 