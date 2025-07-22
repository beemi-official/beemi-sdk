/**
 * Beemi Core SDK Module v2.0
 * Foundation module providing event system, React Native bridge, and logging
 * This module is always required and loaded first
 */

export function createCoreModule(config = {}) {
  
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
        
        if (typeListeners.length === 0) {
          this.listeners.delete(type);
        }
        
        if (this.debug) {
          console.log('[Beemi Core] Event listener removed:', type);
        }
      }
    },
    
    emit(type, data) {
      if (!this.listeners.has(type)) return;
      
      const typeListeners = this.listeners.get(type);
      const timestamp = Date.now();
      
      // Create event object
      const event = {
        type,
        data,
        timestamp,
        source: 'sdk'
      };
      
      // Call all listeners for this event type
      typeListeners.forEach(callback => {
        try {
          callback(data, event);
        } catch (error) {
          console.error('[Beemi Core] Error in event listener:', error);
        }
      });
      
      if (this.debug) {
        console.log('[Beemi Core] Event emitted:', type, data);
      }
    },
    
    getListeners() {
      const result = {};
      this.listeners.forEach((callbacks, type) => {
        result[type] = callbacks.length;
      });
      return result;
    },
    
    // React Native Bridge
    bridge: {
      isNativeEnvironment: false,
      bridgeReady: false,
      messageQueue: [],
      
      detectEnvironment() {
        this.isNativeEnvironment = !!(
          window.ReactNativeWebView ||
          window.webkit?.messageHandlers ||
          window.Android
        );
        
        return {
          isNative: this.isNativeEnvironment,
          platform: this.getPlatform(),
          version: '2.0.0'
        };
      },
      
      getPlatform() {
        if (window.ReactNativeWebView) {
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes('android')) return 'android';
          if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
          return 'unknown';
        }
        return 'web';
      },
      
      send(message) {
        const payload = {
          type: 'beemi-sdk',
          timestamp: Date.now(),
          version: '2.0.0',
          ...message
        };
        
        if (this.isNativeEnvironment && window.ReactNativeWebView) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            
            if (coreModule.debug) {
              console.log('[Beemi Core] Message sent to native:', payload);
            }
            
            return true;
          } catch (error) {
            console.error('[Beemi Core] Failed to send message to native:', error);
            return false;
          }
        } else {
          this.messageQueue.push(payload);
          
          if (coreModule.debug) {
            console.log('[Beemi Core] Message queued (no native bridge):', payload);
          }
          
          return false;
        }
      },
      
      onMessage(callback) {
        if (typeof callback !== 'function') {
          throw new Error('Message handler must be a function');
        }
        
        if (this.isNativeEnvironment) {
          window.addEventListener('message', (event) => {
            try {
              const message = JSON.parse(event.data);
              callback(message);
            } catch (error) {
              console.error('[Beemi Core] Failed to parse native message:', error);
            }
          });
        }
      },
      
      isReady() {
        return this.bridgeReady && this.isNativeEnvironment;
      },
      
      getBridgeInfo() {
        return this.detectEnvironment();
      },
      
      init() {
        const envInfo = this.detectEnvironment();
        this.bridgeReady = true;
        
        if (this.isNativeEnvironment) {
          this.send({
            action: 'core-ready',
            modules: ['core'],
            info: envInfo
          });
        }
        
        if (this.messageQueue.length > 0 && this.isNativeEnvironment) {
          this.messageQueue.forEach(message => {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify(message));
            } catch (error) {
              console.error('[Beemi Core] Failed to send queued message:', error);
            }
          });
          this.messageQueue = [];
        }
        
        if (coreModule.debug) {
          console.log('[Beemi Core] Bridge initialized:', envInfo);
        }
      }
    },
    
    // Logging system
    logger: {
      levels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
      },
      currentLevel: 1, // info
      logHistory: [],
      maxHistorySize: 100,
      
      setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
          this.currentLevel = this.levels[level];
        }
      },
      
      log(level, message, ...args) {
        if (this.levels[level] < this.currentLevel) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = {
          timestamp,
          level,
          message,
          args,
          module: 'core'
        };
        
        this.logHistory.push(logEntry);
        if (this.logHistory.length > this.maxHistorySize) {
          this.logHistory.shift();
        }
        
        const prefix = '[Beemi Core]';
        const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : message;
        
        switch (level) {
          case 'debug':
            console.debug(prefix, formattedMessage, ...args);
            break;
          case 'info':
            console.info(prefix, formattedMessage, ...args);
            break;
          case 'warn':
            console.warn(prefix, formattedMessage, ...args);
            break;
          case 'error':
            console.error(prefix, formattedMessage, ...args);
            break;
        }
        
        if (coreModule.bridge.isReady()) {
          coreModule.bridge.send({
            action: 'log',
            level,
            message: formattedMessage,
            timestamp
          });
        }
      },
      
      getHistory() {
        return [...this.logHistory];
      },
      
      clearHistory() {
        this.logHistory = [];
      }
    },
    
    // Initialization
    init() {
      this.bridge.init();
      
      window.addEventListener('error', (event) => {
        this.logger.log('error', 'Uncaught error:', event.error || event.message);
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        this.logger.log('error', 'Unhandled promise rejection:', event.reason);
      });
      
      this.logger.log('info', 'Beemi Core SDK initialized', {
        version: this.version,
        environment: this.bridge.getBridgeInfo()
      });
    },
    
    // Public API methods
    isReady() {
      return this.bridge.isReady();
    },
    
    getBridgeInfo() {
      return this.bridge.getBridgeInfo();
    },
    
    log(level, message, ...args) {
      return this.logger.log(level, message, ...args);
    },
    
    setLogLevel(level) {
      return this.logger.setLevel(level);
    }
  };
  
  return coreModule;
} 