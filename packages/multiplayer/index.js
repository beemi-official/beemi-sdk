/**
 * Beemi Multiplayer SDK Module v2.0
 * P2P multiplayer functionality: rooms, CRDT, mutex, leadership
 * Requires core module to be loaded first
 */

export function createMultiplayerModule(config = {}) {
  const roomConfig = config.config || {};
  
  const multiplayerModule = {
    version: '2.0.0',
    debug: config.debug || false,
    roomConfig,
    currentRoomState: null,
    
    // Room management
    room: {
      async host(gameId, options = {}) {
        const mergedOptions = {
          max: roomConfig.maxPlayers || options.max || 4,
          visibility: roomConfig.visibility || options.visibility || 'public',
          ...options
        };
        
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] Creating new room...', { gameId, options: mergedOptions });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'host_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              multiplayerModule.core.off('room-joined', handleResponse);
              multiplayerModule.core.off('room-error', handleResponse);
              
              if (data.type === 'room-joined') {
                multiplayerModule.currentRoomState = data.data;
                resolve(data.data);
              } else {
                reject(new Error(data.error || 'Failed to create room'));
              }
            }
          };
          
          multiplayerModule.core.on('room-joined', handleResponse);
          multiplayerModule.core.on('room-error', handleResponse);
          
          multiplayerModule.core.bridge.send({
            action: 'multiplayer-host',
            messageId,
            gameId,
            options: mergedOptions
          });
          
          setTimeout(() => {
            multiplayerModule.core.off('room-joined', handleResponse);
            multiplayerModule.core.off('room-error', handleResponse);
            reject(new Error('Room creation timeout'));
          }, 10000);
        });
      },
      
      async join(joinCode) {
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] Joining room by code...', { joinCode });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'join_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              multiplayerModule.core.off('room-joined', handleResponse);
              multiplayerModule.core.off('room-error', handleResponse);
              
              if (data.type === 'room-joined') {
                multiplayerModule.currentRoomState = data.data;
                resolve(data.data);
              } else {
                reject(new Error(data.error || 'Failed to join room'));
              }
            }
          };
          
          multiplayerModule.core.on('room-joined', handleResponse);
          multiplayerModule.core.on('room-error', handleResponse);
          
          multiplayerModule.core.bridge.send({
            action: 'multiplayer-join',
            messageId,
            joinCode
          });
          
          setTimeout(() => {
            multiplayerModule.core.off('room-joined', handleResponse);
            multiplayerModule.core.off('room-error', handleResponse);
            reject(new Error('Room join timeout'));
          }, 10000);
        });
      },
      
      async quickPlay(gameId) {
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] Starting quick play...', { gameId });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'quickplay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              multiplayerModule.core.off('room-joined', handleResponse);
              multiplayerModule.core.off('room-error', handleResponse);
              
              if (data.type === 'room-joined') {
                multiplayerModule.currentRoomState = data.data;
                resolve(data.data);
              } else {
                reject(new Error(data.error || 'Quick play failed'));
              }
            }
          };
          
          multiplayerModule.core.on('room-joined', handleResponse);
          multiplayerModule.core.on('room-error', handleResponse);
          
          multiplayerModule.core.bridge.send({
            action: 'multiplayer-quickplay',
            messageId,
            gameId
          });
          
          setTimeout(() => {
            multiplayerModule.core.off('room-joined', handleResponse);
            multiplayerModule.core.off('room-error', handleResponse);
            reject(new Error('Quick play timeout'));
          }, 10000);
        });
      },
      
      async leave() {
        if (!multiplayerModule.currentRoomState) {
          throw new Error('Not in a room');
        }
        
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] Leaving room...', { roomId: multiplayerModule.currentRoomState.roomId });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'leave_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              multiplayerModule.core.off('room-left', handleResponse);
              multiplayerModule.core.off('room-error', handleResponse);
              
              if (data.type === 'room-left') {
                multiplayerModule.currentRoomState = null;
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to leave room'));
              }
            }
          };
          
          multiplayerModule.core.on('room-left', handleResponse);
          multiplayerModule.core.on('room-error', handleResponse);
          
          multiplayerModule.core.bridge.send({
            action: 'multiplayer-leave',
            messageId,
            roomId: multiplayerModule.currentRoomState.roomId
          });
          
          setTimeout(() => {
            multiplayerModule.core.off('room-left', handleResponse);
            multiplayerModule.core.off('room-error', handleResponse);
            reject(new Error('Leave room timeout'));
          }, 5000);
        });
      },
      
      getState() {
        return multiplayerModule.currentRoomState ? { ...multiplayerModule.currentRoomState } : null;
      }
    },
    
    // CRDT (Shared State)
    crdt: {
      watchers: new Map(),
      
      get(key) {
        if (!multiplayerModule.currentRoomState?.sharedState) {
          return undefined;
        }
        return multiplayerModule.currentRoomState.sharedState[key];
      },
      
      set(key, value) {
        if (!multiplayerModule.currentRoomState) {
          throw new Error('Not in a room');
        }
        
        if (!multiplayerModule.currentRoomState.sharedState) {
          multiplayerModule.currentRoomState.sharedState = {};
        }
        multiplayerModule.currentRoomState.sharedState[key] = value;
        
        multiplayerModule.core.bridge.send({
          action: 'crdt-set',
          roomId: multiplayerModule.currentRoomState.roomId,
          key,
          value,
          version: Date.now()
        });
        
        if (this.watchers.has(key)) {
          this.watchers.get(key).forEach(callback => {
            try {
              callback(value, key);
            } catch (error) {
              multiplayerModule.core.log('error', 'Error in CRDT watcher:', error);
            }
          });
        }
        
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] CRDT set:', { key, value });
        }
      },
      
      watch(key, callback) {
        if (typeof callback !== 'function') {
          throw new Error('CRDT watcher callback must be a function');
        }
        
        if (!this.watchers.has(key)) {
          this.watchers.set(key, []);
        }
        
        this.watchers.get(key).push(callback);
        
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] CRDT watcher added:', { key });
        }
      },
      
      unwatch(key, callback) {
        if (!this.watchers.has(key)) return;
        
        const keyWatchers = this.watchers.get(key);
        const index = keyWatchers.indexOf(callback);
        
        if (index > -1) {
          keyWatchers.splice(index, 1);
          
          if (keyWatchers.length === 0) {
            this.watchers.delete(key);
          }
          
          if (multiplayerModule.debug) {
            console.log('[Beemi Multiplayer] CRDT watcher removed:', { key });
          }
        }
      },
      
      handleUpdate(data) {
        if (!multiplayerModule.currentRoomState?.sharedState) return;
        
        multiplayerModule.currentRoomState.sharedState[data.key] = data.value;
        
        if (this.watchers.has(data.key)) {
          this.watchers.get(data.key).forEach(callback => {
            try {
              callback(data.value, data.key);
            } catch (error) {
              multiplayerModule.core.log('error', 'Error in CRDT watcher:', error);
            }
          });
        }
        
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] CRDT update received:', data);
        }
      }
    },
    
    // Mutex (Distributed Locking)
    mutex: {
      activeLocks: new Map(),
      
      async exec(key, ttl, callback) {
        if (!multiplayerModule.currentRoomState) {
          throw new Error('Not in a room');
        }
        
        return new Promise((resolve, reject) => {
          const lockId = 'mutex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const timeoutHandle = setTimeout(() => {
            multiplayerModule.core.off('mutex-acquired', handleAcquired);
            reject(new Error(`Mutex timeout: ${key}`));
          }, ttl + 1000);
          
          const handleAcquired = (data) => {
            if (data.key === key && data.lockId === lockId) {
              clearTimeout(timeoutHandle);
              multiplayerModule.core.off('mutex-acquired', handleAcquired);
              
              if (data.success) {
                this.activeLocks.set(key, lockId);
                
                try {
                  const result = callback();
                  Promise.resolve(result).then(resolve).catch(reject).finally(() => {
                    this.release(key);
                  });
                } catch (error) {
                  this.release(key);
                  reject(error);
                }
              } else {
                reject(new Error(`Failed to acquire mutex: ${key}`));
              }
            }
          };
          
          multiplayerModule.core.on('mutex-acquired', handleAcquired);
          
          multiplayerModule.core.bridge.send({
            action: 'mutex-acquire',
            roomId: multiplayerModule.currentRoomState.roomId,
            key,
            ttl,
            lockId
          });
        });
      },
      
      async acquire(key, ttl) {
        if (!multiplayerModule.currentRoomState) {
          throw new Error('Not in a room');
        }
        
        return new Promise((resolve, reject) => {
          const lockId = 'mutex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const timeoutHandle = setTimeout(() => {
            multiplayerModule.core.off('mutex-acquired', handleAcquired);
            reject(new Error(`Mutex acquire timeout: ${key}`));
          }, ttl + 1000);
          
          const handleAcquired = (data) => {
            if (data.key === key && data.lockId === lockId) {
              clearTimeout(timeoutHandle);
              multiplayerModule.core.off('mutex-acquired', handleAcquired);
              
              if (data.success) {
                this.activeLocks.set(key, lockId);
              }
              
              resolve(data.success);
            }
          };
          
          multiplayerModule.core.on('mutex-acquired', handleAcquired);
          
          multiplayerModule.core.bridge.send({
            action: 'mutex-acquire',
            roomId: multiplayerModule.currentRoomState.roomId,
            key,
            ttl,
            lockId
          });
        });
      },
      
      async release(key) {
        if (!multiplayerModule.currentRoomState) {
          throw new Error('Not in a room');
        }
        
        const lockId = this.activeLocks.get(key);
        if (!lockId) {
          throw new Error(`No active lock for key: ${key}`);
        }
        
        return new Promise((resolve, reject) => {
          const timeoutHandle = setTimeout(() => {
            multiplayerModule.core.off('mutex-released', handleReleased);
            reject(new Error(`Mutex release timeout: ${key}`));
          }, 5000);
          
          const handleReleased = (data) => {
            if (data.key === key && data.lockId === lockId) {
              clearTimeout(timeoutHandle);
              multiplayerModule.core.off('mutex-released', handleReleased);
              
              this.activeLocks.delete(key);
              resolve();
            }
          };
          
          multiplayerModule.core.on('mutex-released', handleReleased);
          
          multiplayerModule.core.bridge.send({
            action: 'mutex-release',
            roomId: multiplayerModule.currentRoomState.roomId,
            key,
            lockId
          });
        });
      }
    },
    
    // Leadership helpers
    leadership: {
      leaderCallbacks: [],
      
      ifLeader(callback) {
        if (typeof callback !== 'function') {
          throw new Error('Leader callback must be a function');
        }
        
        if (multiplayerModule.currentRoomState?.isLeader) {
          try {
            callback();
          } catch (error) {
            multiplayerModule.core.log('error', 'Error in leader callback:', error);
          }
        }
        
        this.leaderCallbacks.push(callback);
      },
      
      isLeader() {
        return multiplayerModule.currentRoomState?.isLeader || false;
      },
      
      onLeaderChange(callback) {
        if (typeof callback !== 'function') {
          throw new Error('Leader change callback must be a function');
        }
        
        multiplayerModule.core.on('leader-changed', callback);
      },
      
      handleLeaderChange(data) {
        if (!multiplayerModule.currentRoomState) return;
        
        const wasLeader = multiplayerModule.currentRoomState.isLeader;
        multiplayerModule.currentRoomState.isLeader = data.newLeaderId === multiplayerModule.currentRoomState.playerId;
        multiplayerModule.currentRoomState.leaderId = data.newLeaderId;
        
        if (!wasLeader && multiplayerModule.currentRoomState.isLeader) {
          this.leaderCallbacks.forEach(callback => {
            try {
              callback();
            } catch (error) {
              multiplayerModule.core.log('error', 'Error in leader callback:', error);
            }
          });
        }
        
        if (multiplayerModule.debug) {
          console.log('[Beemi Multiplayer] Leadership changed:', {
            wasLeader,
            isLeader: multiplayerModule.currentRoomState.isLeader,
            newLeaderId: data.newLeaderId
          });
        }
      }
    },
    
    // Initialization
    init(coreModule) {
      this.core = coreModule;
      
      // Set up event handlers
      this.core.on('room-state-updated', (data) => {
        if (data) {
          this.currentRoomState = { ...this.currentRoomState, ...data };
        }
      });
      
      this.core.on('player-joined', (data) => {
        if (this.currentRoomState && data.playerCount) {
          this.currentRoomState.playerCount = data.playerCount;
          this.currentRoomState.players = data.players || this.currentRoomState.players;
        }
      });
      
      this.core.on('player-left', (data) => {
        if (this.currentRoomState && data.playerCount) {
          this.currentRoomState.playerCount = data.playerCount;
          this.currentRoomState.players = data.players || this.currentRoomState.players;
        }
      });
      
      this.core.on('crdt-update', this.crdt.handleUpdate.bind(this.crdt));
      this.core.on('leader-changed', this.leadership.handleLeaderChange.bind(this.leadership));
      
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