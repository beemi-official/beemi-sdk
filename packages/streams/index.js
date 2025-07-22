/**
 * Beemi Streams SDK Module v2.0
 * Live streaming functionality: TikTok, YouTube, Twitch integration
 * Requires core module to be loaded first
 */

export function createStreamsModule(config = {}) {
  const platforms = config.platforms || ['tiktok', 'youtube', 'twitch'];
  
  const streamsModule = {
    version: '2.0.0',
    platforms,
    debug: config.debug || false,
    connections: new Map(),
    
    // TikTok Integration
    tiktok: {
      isConnected: false,
      currentUsername: null,
      
      async connect(username) {
        if (!username || typeof username !== 'string') {
          throw new Error('TikTok username is required');
        }
        
        if (streamsModule.debug) {
          console.log('[Beemi Streams] Connecting to TikTok Live...', { username });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'tiktok_connect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              streamsModule.core.off('stream-connected', handleResponse);
              streamsModule.core.off('stream-error', handleResponse);
              
              if (data.type === 'stream-connected' && data.platform === 'tiktok') {
                this.isConnected = true;
                this.currentUsername = username;
                streamsModule.connections.set('tiktok', { username, connected: true });
                streamsModule.core.log('info', 'TikTok Live connected successfully');
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to connect to TikTok Live'));
              }
            }
          };
          
          streamsModule.core.on('stream-connected', handleResponse);
          streamsModule.core.on('stream-error', handleResponse);
          
          streamsModule.core.bridge.send({
            action: 'stream-connect',
            platform: 'tiktok',
            identifier: username,
            messageId
          });
          
          setTimeout(() => {
            streamsModule.core.off('stream-connected', handleResponse);
            streamsModule.core.off('stream-error', handleResponse);
            reject(new Error('TikTok connection timeout'));
          }, 15000);
        });
      },
      
      async disconnect() {
        if (!this.isConnected) return;
        
        if (streamsModule.debug) {
          console.log('[Beemi Streams] Disconnecting from TikTok Live...');
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'tiktok_disconnect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              streamsModule.core.off('stream-disconnected', handleResponse);
              streamsModule.core.off('stream-error', handleResponse);
              
              if (data.type === 'stream-disconnected' && data.platform === 'tiktok') {
                this.isConnected = false;
                this.currentUsername = null;
                streamsModule.connections.delete('tiktok');
                streamsModule.core.log('info', 'TikTok Live disconnected successfully');
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to disconnect from TikTok Live'));
              }
            }
          };
          
          streamsModule.core.on('stream-disconnected', handleResponse);
          streamsModule.core.on('stream-error', handleResponse);
          
          streamsModule.core.bridge.send({
            action: 'stream-disconnect',
            platform: 'tiktok',
            messageId
          });
          
          setTimeout(() => {
            streamsModule.core.off('stream-disconnected', handleResponse);
            streamsModule.core.off('stream-error', handleResponse);
            reject(new Error('TikTok disconnection timeout'));
          }, 5000);
        });
      },
      
      isConnected() {
        return this.isConnected;
      },
      
      getIdentifier() {
        return this.currentUsername;
      }
    },
    
    // YouTube Integration
    youtube: {
      isConnected: false,
      currentChannelId: null,
      
      async connect(channelId) {
        if (!channelId || typeof channelId !== 'string') {
          throw new Error('YouTube channel ID is required');
        }
        
        if (streamsModule.debug) {
          console.log('[Beemi Streams] Connecting to YouTube Live...', { channelId });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'youtube_connect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              streamsModule.core.off('stream-connected', handleResponse);
              streamsModule.core.off('stream-error', handleResponse);
              
              if (data.type === 'stream-connected' && data.platform === 'youtube') {
                this.isConnected = true;
                this.currentChannelId = channelId;
                streamsModule.connections.set('youtube', { channelId, connected: true });
                streamsModule.core.log('info', 'YouTube Live connected successfully');
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to connect to YouTube Live'));
              }
            }
          };
          
          streamsModule.core.on('stream-connected', handleResponse);
          streamsModule.core.on('stream-error', handleResponse);
          
          streamsModule.core.bridge.send({
            action: 'stream-connect',
            platform: 'youtube',
            identifier: channelId,
            messageId
          });
          
          setTimeout(() => {
            streamsModule.core.off('stream-connected', handleResponse);
            streamsModule.core.off('stream-error', handleResponse);
            reject(new Error('YouTube connection timeout'));
          }, 15000);
        });
      },
      
      async disconnect() {
        if (!this.isConnected) return;
        
        return new Promise((resolve, reject) => {
          const messageId = 'youtube_disconnect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              streamsModule.core.off('stream-disconnected', handleResponse);
              streamsModule.core.off('stream-error', handleResponse);
              
              if (data.type === 'stream-disconnected' && data.platform === 'youtube') {
                this.isConnected = false;
                this.currentChannelId = null;
                streamsModule.connections.delete('youtube');
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to disconnect from YouTube Live'));
              }
            }
          };
          
          streamsModule.core.on('stream-disconnected', handleResponse);
          streamsModule.core.on('stream-error', handleResponse);
          
          streamsModule.core.bridge.send({
            action: 'stream-disconnect',
            platform: 'youtube',
            messageId
          });
          
          setTimeout(() => {
            streamsModule.core.off('stream-disconnected', handleResponse);
            streamsModule.core.off('stream-error', handleResponse);
            reject(new Error('YouTube disconnection timeout'));
          }, 5000);
        });
      },
      
      isConnected() {
        return this.isConnected;
      },
      
      getIdentifier() {
        return this.currentChannelId;
      }
    },
    
    // Twitch Integration
    twitch: {
      isConnected: false,
      currentChannel: null,
      
      async connect(channel) {
        if (!channel || typeof channel !== 'string') {
          throw new Error('Twitch channel name is required');
        }
        
        if (streamsModule.debug) {
          console.log('[Beemi Streams] Connecting to Twitch...', { channel });
        }
        
        return new Promise((resolve, reject) => {
          const messageId = 'twitch_connect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              streamsModule.core.off('stream-connected', handleResponse);
              streamsModule.core.off('stream-error', handleResponse);
              
              if (data.type === 'stream-connected' && data.platform === 'twitch') {
                this.isConnected = true;
                this.currentChannel = channel;
                streamsModule.connections.set('twitch', { channel, connected: true });
                streamsModule.core.log('info', 'Twitch connected successfully');
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to connect to Twitch'));
              }
            }
          };
          
          streamsModule.core.on('stream-connected', handleResponse);
          streamsModule.core.on('stream-error', handleResponse);
          
          streamsModule.core.bridge.send({
            action: 'stream-connect',
            platform: 'twitch',
            identifier: channel,
            messageId
          });
          
          setTimeout(() => {
            streamsModule.core.off('stream-connected', handleResponse);
            streamsModule.core.off('stream-error', handleResponse);
            reject(new Error('Twitch connection timeout'));
          }, 15000);
        });
      },
      
      async disconnect() {
        if (!this.isConnected) return;
        
        return new Promise((resolve, reject) => {
          const messageId = 'twitch_disconnect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          const handleResponse = (data) => {
            if (data.messageId === messageId) {
              streamsModule.core.off('stream-disconnected', handleResponse);
              streamsModule.core.off('stream-error', handleResponse);
              
              if (data.type === 'stream-disconnected' && data.platform === 'twitch') {
                this.isConnected = false;
                this.currentChannel = null;
                streamsModule.connections.delete('twitch');
                resolve();
              } else {
                reject(new Error(data.error || 'Failed to disconnect from Twitch'));
              }
            }
          };
          
          streamsModule.core.on('stream-disconnected', handleResponse);
          streamsModule.core.on('stream-error', handleResponse);
          
          streamsModule.core.bridge.send({
            action: 'stream-disconnect',
            platform: 'twitch',
            messageId
          });
          
          setTimeout(() => {
            streamsModule.core.off('stream-disconnected', handleResponse);
            streamsModule.core.off('stream-error', handleResponse);
            reject(new Error('Twitch disconnection timeout'));
          }, 5000);
        });
      },
      
      isConnected() {
        return this.isConnected;
      },
      
      getIdentifier() {
        return this.currentChannel;
      }
    },
    
    // Event handling shortcuts
    onChat(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Chat callback must be a function');
      }
      this.core.on('stream-chat', callback);
    },
    
    onGift(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Gift callback must be a function');
      }
      this.core.on('stream-gift', callback);
    },
    
    onLike(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Like callback must be a function');
      }
      this.core.on('stream-like', callback);
    },
    
    onFollow(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Follow callback must be a function');
      }
      this.core.on('stream-follow', callback);
    },
    
    onViewerJoin(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Viewer join callback must be a function');
      }
      this.core.on('stream-viewer-join', callback);
    },
    
    onViewerLeave(callback) {
      if (typeof callback !== 'function') {
        throw new Error('Viewer leave callback must be a function');
      }
      this.core.on('stream-viewer-leave', callback);
    },
    
    // Utilities
    async getViewerCount() {
      return new Promise((resolve, reject) => {
        const messageId = 'viewer_count_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const handleResponse = (data) => {
          if (data.messageId === messageId) {
            this.core.off('stream-viewer-count', handleResponse);
            this.core.off('stream-error', handleResponse);
            
            if (data.type === 'stream-viewer-count') {
              resolve(data.count || 0);
            } else {
              reject(new Error(data.error || 'Failed to get viewer count'));
            }
          }
        };
        
        this.core.on('stream-viewer-count', handleResponse);
        this.core.on('stream-error', handleResponse);
        
        this.core.bridge.send({
          action: 'stream-get-viewer-count',
          messageId
        });
        
        setTimeout(() => {
          this.core.off('stream-viewer-count', handleResponse);
          this.core.off('stream-error', handleResponse);
          reject(new Error('Viewer count request timeout'));
        }, 5000);
      });
    },
    
    async getStreamInfo() {
      return new Promise((resolve, reject) => {
        const messageId = 'stream_info_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const handleResponse = (data) => {
          if (data.messageId === messageId) {
            this.core.off('stream-info', handleResponse);
            this.core.off('stream-error', handleResponse);
            
            if (data.type === 'stream-info') {
              resolve(data.info || {});
            } else {
              reject(new Error(data.error || 'Failed to get stream info'));
            }
          }
        };
        
        this.core.on('stream-info', handleResponse);
        this.core.on('stream-error', handleResponse);
        
        this.core.bridge.send({
          action: 'stream-get-info',
          messageId
        });
        
        setTimeout(() => {
          this.core.off('stream-info', handleResponse);
          this.core.off('stream-error', handleResponse);
          reject(new Error('Stream info request timeout'));
        }, 5000);
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
      return Object.fromEntries(this.connections);
    }
  };
  
  return streamsModule;
} 