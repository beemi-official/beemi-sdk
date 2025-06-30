/* 
 * Beemi SDK v0.1 - Multiplayer Game SDK
 * 
 * Provides multiplayer functionality through React Native bridge:
 * - Real-time event broadcasting
 * - Passive room state receiving
 * - Shared state (CRDT) management
 * - Distributed mutex/locking
 */

/* Event bus for internal communication */
const listeners = {};
let roomState = null;
let isInitialized = false;

/* Core event system */
function on(type, cb) { 
  (listeners[type] ||= []).push(cb); 
}

function emit(type, data) { 
  (listeners[type] || []).forEach(f => f(data)); 
}

/* React Native Bridge Communication */
function sendToNative(message) {
  const payload = {
    type: 'beemi-multiplayer',
    timestamp: Date.now(),
    ...message
  };
  
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  
  return payload;
}

function handleNativeMessage(message) {
  switch (message.type) {
    case 'room-state':
      updateRoomState(message.data);
      break;
    case 'room-joined':
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
        
        emit('leader-changed', {
          ...message.data,
          isLeader: roomState.isLeader,
          wasLeader
        });
      }
      break;
    case 'room-event':
      emit('room-event', message.data);
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
    case 'error':
      console.error('❌ RN Error:', message.error);
      emit('error', message);
      break;
  }
}

function updateRoomState(newState) {
  const oldState = roomState;
  roomState = { ...newState };
  
  emit('room-state-updated', roomState);
}

/* CRDT (Shared State) Management */
const crdt = {
  get(key) {
    const value = roomState?.sharedState?.[key];
    return value;
  },
  
  set(key, value) {
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
            try {
              const result = callback();
              Promise.resolve(result).then(resolve).catch(reject).finally(() => {
                sendToNative({
                  action: 'mutex-release',
                  key,
                  roomId: roomState?.roomId
                });
              });
            } catch (error) {
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

/* Initialize SDK */
function initializeSDK() {
  if (isInitialized) return;
  
  // Listen for messages from React Native
  if (window.ReactNativeWebView) {
    window.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type?.startsWith('beemi-') || 
            ['room-state', 'room-joined', 'player-joined', 'player-left', 
             'leader-changed', 'room-event', 'crdt-update', 'mutex-acquired', 'mutex-released', 
             'error'].includes(message.type)) {
          handleNativeMessage(message);
        }
      } catch (error) {
        console.error('Failed to parse RN message:', error);
      }
    });
  }
  
  isInitialized = true;
  emit('sdk-initialized');
  
  // Notify React Native that SDK is ready
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'beemi',
      action: 'ready',
      timestamp: Date.now()
    }));
  }
}

/* Global exposure for RN bridge and debugging */
if (typeof window !== 'undefined') {
  window.beemi = { 
    on, 
    emit, 
    crdt, 
    mutex, 
    // Internal methods for RN bridge and debugging
    _handleNativeMessage: handleNativeMessage,
    _getRoomState: () => roomState,
    _sendToNative: sendToNative
  };
  
  // Auto-initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSDK);
  } else {
    initializeSDK();
  }
} 