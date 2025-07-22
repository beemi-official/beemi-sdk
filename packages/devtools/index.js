/**
 * Beemi DevTools SDK Module v2.0
 * Development utilities: debug tools, mock data generators, network monitoring
 * Requires core module to be loaded first
 */

export function createDevToolsModule(config = {}) {
  const enableInProduction = config.enableInProduction || false;
  
  const devToolsModule = {
    version: '2.0.0',
    enableInProduction,
    debug: config.debug || false,
    
    // Check if devtools should be enabled
    get shouldEnable() {
      const isDevelopment = this.debug || window.location.href.includes('localhost');
      return isDevelopment || this.enableInProduction;
    },
    
    // Debug utilities
    debugTools: {
      currentLogLevel: 'normal',
      
      setLogLevel(level) {
        const validLevels = ['verbose', 'normal', 'quiet'];
        if (validLevels.includes(level)) {
          this.currentLogLevel = level;
          
          switch (level) {
            case 'verbose':
              devToolsModule.core.setLogLevel('debug');
              break;
            case 'normal':
              devToolsModule.core.setLogLevel('info');
              break;
            case 'quiet':
              devToolsModule.core.setLogLevel('error');
              break;
          }
          
          devToolsModule.core.log('info', `Log level set to: ${level}`);
        } else {
          throw new Error(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`);
        }
      },
      
      inspectEvents() {
        const eventHistory = [];
        const maxHistory = 100;
        
        const originalEmit = devToolsModule.core.emit;
        devToolsModule.core.emit = function(type, data) {
          const event = {
            timestamp: Date.now(),
            type,
            data,
            source: 'sdk'
          };
          
          eventHistory.push(event);
          if (eventHistory.length > maxHistory) {
            eventHistory.shift();
          }
          
          return originalEmit.call(this, type, data);
        };
        
        return {
          getHistory() {
            return [...eventHistory];
          },
          filter(type) {
            return eventHistory.filter(event => event.type === type);
          },
          clear() {
            eventHistory.length = 0;
          },
          getStats() {
            const stats = {};
            eventHistory.forEach(event => {
              stats[event.type] = (stats[event.type] || 0) + 1;
            });
            return stats;
          }
        };
      },
      
      getSDKState() {
        const state = {
          core: {
            version: devToolsModule.core?.version,
            ready: devToolsModule.core?.isReady(),
            bridgeInfo: devToolsModule.core?.getBridgeInfo()
          },
          modules: [],
          config: window.BeemiConfig || {}
        };
        
        if (window.BeemiModules) {
          state.modules = Object.keys(window.BeemiModules);
        }
        
        return state;
      }
    },
    
    // Mock data generators
    mock: {
      streamEvents: {
        simulateChat(username, message) {
          const chatData = {
            user: {
              id: 'mock_' + Date.now(),
              username: username || 'MockUser',
              displayName: username || 'Mock User',
              imageUrl: 'https://via.placeholder.com/50',
              isFollower: Math.random() > 0.5,
              isModerator: Math.random() > 0.8,
              badges: Math.random() > 0.7 ? ['verified'] : []
            },
            message: message || 'This is a mock chat message!',
            messageId: 'mock_chat_' + Date.now()
          };
          
          devToolsModule.core.emit('stream-chat', chatData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock chat event simulated:', chatData);
          }
        },
        
        simulateGift(username, gift) {
          const giftData = {
            user: {
              id: 'mock_' + Date.now(),
              username: username || 'MockGifter',
              displayName: username || 'Mock Gifter',
              imageUrl: 'https://via.placeholder.com/50'
            },
            gift: gift || {
              id: 'rose',
              name: 'Rose',
              emoji: '🌹',
              value: 10,
              count: Math.floor(Math.random() * 5) + 1
            }
          };
          
          devToolsModule.core.emit('stream-gift', giftData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock gift event simulated:', giftData);
          }
        },
        
        simulateLike(username, count) {
          const likeData = {
            user: {
              id: 'mock_' + Date.now(),
              username: username || 'MockLiker',
              displayName: username || 'Mock Liker',
              imageUrl: 'https://via.placeholder.com/50'
            },
            count: count || Math.floor(Math.random() * 20) + 1
          };
          
          devToolsModule.core.emit('stream-like', likeData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock like event simulated:', likeData);
          }
        },
        
        simulateFollow(username) {
          const followData = {
            user: {
              id: 'mock_' + Date.now(),
              username: username || 'MockFollower',
              displayName: username || 'Mock Follower',
              imageUrl: 'https://via.placeholder.com/50'
            }
          };
          
          devToolsModule.core.emit('stream-follow', followData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock follow event simulated:', followData);
          }
        }
      },
      
      multiplayerEvents: {
        simulatePlayerJoin(playerId) {
          const playerData = {
            player: {
              id: playerId || 'mock_player_' + Date.now(),
              name: `MockPlayer${Math.floor(Math.random() * 1000)}`,
              role: null,
              isAlive: true,
              isHost: false
            },
            playerCount: Math.floor(Math.random() * 6) + 2,
            players: []
          };
          
          devToolsModule.core.emit('player-joined', playerData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock player join simulated:', playerData);
          }
        },
        
        simulatePlayerLeave(playerId) {
          const playerData = {
            playerId: playerId || 'mock_player_leave_' + Date.now(),
            playerCount: Math.floor(Math.random() * 4) + 1,
            players: []
          };
          
          devToolsModule.core.emit('player-left', playerData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock player leave simulated:', playerData);
          }
        },
        
        simulateLeaderChange(newLeaderId) {
          const leaderData = {
            newLeaderId: newLeaderId || 'mock_leader_' + Date.now(),
            previousLeaderId: 'previous_leader',
            reason: ['disconnected', 'timeout', 'transfer'][Math.floor(Math.random() * 3)]
          };
          
          devToolsModule.core.emit('leader-changed', leaderData);
          if (devToolsModule.debug) {
            console.log('[Beemi DevTools] Mock leader change simulated:', leaderData);
          }
        }
      }
    },
    
    // Network monitoring
    network: {
      isMonitoring: false,
      requestStats: {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        avgResponseTime: 0
      },
      requestHistory: [],
      maxHistory: 50,
      originalFetch: null,
      
      start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        if (window.fetch && !this.originalFetch) {
          this.originalFetch = window.fetch;
          const self = this;
          
          window.fetch = function(...args) {
            const startTime = Date.now();
            const url = args[0];
            const options = args[1] || {};
            
            self.requestStats.total++;
            self.requestStats.pending++;
            
            return self.originalFetch.apply(this, args)
              .then(response => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                self.requestStats.pending--;
                if (response.ok) {
                  self.requestStats.success++;
                } else {
                  self.requestStats.failed++;
                }
                
                self.requestStats.avgResponseTime = 
                  (self.requestStats.avgResponseTime * (self.requestStats.success + self.requestStats.failed - 1) + duration) / 
                  (self.requestStats.success + self.requestStats.failed);
                
                const requestInfo = {
                  url: typeof url === 'string' ? url : url.toString(),
                  method: options.method || 'GET',
                  status: response.status,
                  duration,
                  timestamp: endTime,
                  success: response.ok
                };
                
                self.requestHistory.push(requestInfo);
                if (self.requestHistory.length > self.maxHistory) {
                  self.requestHistory.shift();
                }
                
                if (devToolsModule.debug) {
                  console.log(`[Beemi DevTools] Network request: ${requestInfo.method} ${requestInfo.url} - ${requestInfo.status} (${duration}ms)`);
                }
                
                return response;
              })
              .catch(error => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                self.requestStats.pending--;
                self.requestStats.failed++;
                
                const requestInfo = {
                  url: typeof url === 'string' ? url : url.toString(),
                  method: options.method || 'GET',
                  status: 0,
                  duration,
                  timestamp: endTime,
                  success: false,
                  error: error.message
                };
                
                self.requestHistory.push(requestInfo);
                if (self.requestHistory.length > self.maxHistory) {
                  self.requestHistory.shift();
                }
                
                if (devToolsModule.debug) {
                  console.log(`[Beemi DevTools] Network request failed: ${requestInfo.method} ${requestInfo.url} - ${error.message}`);
                }
                
                throw error;
              });
          };
        }
        
        devToolsModule.core.log('info', 'Network monitoring started');
      },
      
      stop() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.originalFetch) {
          window.fetch = this.originalFetch;
        }
        
        devToolsModule.core.log('info', 'Network monitoring stopped');
      },
      
      getStats() {
        return {
          ...this.requestStats,
          history: [...this.requestHistory],
          isMonitoring: this.isMonitoring
        };
      },
      
      reset() {
        this.requestStats = {
          total: 0,
          success: 0,
          failed: 0,
          pending: 0,
          avgResponseTime: 0
        };
        this.requestHistory = [];
      }
    },
    
    // Testing utilities
    test: {
      simulateUser(username) {
        const user = {
          id: 'test_user_' + Date.now(),
          username: username || 'TestUser',
          
          simulate() {
            setTimeout(() => {
              if (devToolsModule.mock.streamEvents) {
                devToolsModule.mock.streamEvents.simulateChat(this.username, 'Hello from test user!');
              }
            }, Math.random() * 2000);
            
            setTimeout(() => {
              if (devToolsModule.mock.streamEvents && Math.random() > 0.5) {
                devToolsModule.mock.streamEvents.simulateLike(this.username, Math.floor(Math.random() * 10) + 1);
              }
            }, Math.random() * 3000 + 1000);
          }
        };
        
        if (devToolsModule.debug) {
          console.log('[Beemi DevTools] Test user created:', user);
        }
        return user;
      },
      
      simulateRoom(playerCount) {
        const room = {
          id: 'test_room_' + Date.now(),
          playerCount: playerCount || Math.floor(Math.random() * 6) + 2,
          
          simulate() {
            for (let i = 0; i < this.playerCount; i++) {
              setTimeout(() => {
                if (devToolsModule.mock.multiplayerEvents) {
                  devToolsModule.mock.multiplayerEvents.simulatePlayerJoin(`test_player_${i}`);
                }
              }, i * 500);
            }
            
            setTimeout(() => {
              if (devToolsModule.mock.multiplayerEvents && Math.random() > 0.5) {
                devToolsModule.mock.multiplayerEvents.simulatePlayerLeave('test_player_0');
              }
            }, 5000);
          }
        };
        
        if (devToolsModule.debug) {
          console.log('[Beemi DevTools] Test room created:', room);
        }
        return room;
      },
      
      simulateStream(platform) {
        const stream = {
          platform: platform || 'tiktok',
          
          simulate() {
            const events = [
              () => devToolsModule.mock.streamEvents.simulateChat(`${this.platform}User1`, 'Great game!'),
              () => devToolsModule.mock.streamEvents.simulateChat(`${this.platform}User2`, 'How do I play?'),
              () => devToolsModule.mock.streamEvents.simulateGift(`${this.platform}Gifter`),
              () => devToolsModule.mock.streamEvents.simulateLike(`${this.platform}Liker`),
              () => devToolsModule.mock.streamEvents.simulateFollow(`${this.platform}Follower`)
            ];
            
            events.forEach((event, index) => {
              setTimeout(event, index * 1000 + Math.random() * 500);
            });
          }
        };
        
        if (devToolsModule.debug) {
          console.log('[Beemi DevTools] Test stream created:', stream);
        }
        return stream;
      }
    },
    
    // Initialization
    init(coreModule) {
      this.core = coreModule;
      
      if (!this.shouldEnable) {
        this.core.log('info', 'DevTools disabled in production');
        return;
      }
      
      // Auto-start network monitoring in development
      if (this.debug) {
        this.network.start();
      }
      
      this.core.log('info', 'Beemi DevTools SDK initialized', {
        version: this.version,
        enabled: this.shouldEnable
      });
    },
    
    // Public API methods (return noop functions if disabled)
    debug: {
      setLogLevel(level) {
        if (devToolsModule.shouldEnable) {
          return devToolsModule.debugTools.setLogLevel(level);
        }
      },
      inspectEvents() {
        if (devToolsModule.shouldEnable) {
          return devToolsModule.debugTools.inspectEvents();
        }
        return { getHistory: () => [], filter: () => [], clear: () => {}, getStats: () => ({}) };
      },
      getSDKState() {
        if (devToolsModule.shouldEnable) {
          return devToolsModule.debugTools.getSDKState();
        }
        return {};
      }
    }
  };
  
  return devToolsModule;
} 