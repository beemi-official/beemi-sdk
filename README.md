# Beemi SDK v2.0 - Modular Architecture

The Beemi SDK has been completely rewritten with a modular architecture that loads only the functionality your game needs, resulting in significant performance improvements and better type safety.

## 🚀 Key Benefits

- **80% Smaller Bundles**: Simple games load only 3KB instead of 15KB
- **Type Safety**: Full TypeScript support with conditional types
- **Automatic Loading**: Manifest-driven injection with zero configuration
- **Backward Compatible**: Legacy SDK fallback for existing games
- **Developer Tools**: Built-in debugging, mocking, and testing utilities

## 📦 Architecture Overview

### Modular Design
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Core Module   │────▶│ Multiplayer P2P  │────▶│   DevTools      │
│                 │     │ Module           │     │ Module          │
│ • Event System  │     │ • Rooms          │     │ • Debug Tools   │
│ • React Native  │     │ • CRDT           │     │ • Mock Data     │
│   Bridge        │     │ • Mutex          │     │ • Network Mon   │
│ • Logging       │     │ • Leadership     │     │ • Testing Utils │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │                        │
         │               ┌─────────────────┐               │
         └──────────────▶│  Streams Module │◀──────────────┘
                         │                 │
                         │ • TikTok Live   │
                         │ • YouTube Live  │
                         │ • Twitch        │
                         │ • Event Types   │
                         └─────────────────┘
```

### Bundle Size Comparison
| Configuration | Legacy SDK | Modular SDK | Savings |
|---------------|------------|-------------|---------|
| Core Only | 15KB | 3KB | 80% |
| Core + Streams | 15KB | 7KB | 53% |
| Core + Multiplayer | 15KB | 10KB | 33% |
| Full Featured | 15KB | 16KB | -6%* |

*Full featured includes DevTools which aren't in legacy

## 🎯 Quick Start

### 1. Create New Project
```bash
npx beemi-cli create my-game
# ✨ Interactive module selection:
# ☐ Multiplayer (P2P) - rooms, shared state, leadership
# ☑ Live Streaming - TikTok, YouTube, Twitch integration
```

### 2. Manage Modules
```bash
# In existing project directory
npx beemi-cli modules
# ✨ Add/remove modules or upgrade legacy projects
# 🔄 Automatically detects project type and current modules
```

### 3. Manifest Configuration
Your `manifest.json` automatically includes:
```json
{
  "name": "my-game",
  "beemi": {
    "sdkVersion": "2.0.0",
    "core": {
      "required": true
    },
    "streams": {
      "required": true
    }
  }
}
```

### 3. Use in Your Game
```javascript
// SDK is automatically injected based on manifest
console.log('Available modules:', beemi.getLoadedModules());

// Streaming functionality (if enabled)
if (beemi.streams) {
  beemi.streams.onChat((data) => {
    console.log(`${data.user.username}: ${data.message}`);
  });
}

// Multiplayer (if enabled)
if (beemi.multiplayer) {
  const room = await beemi.multiplayer.room.host('my-game');
  console.log('Room created:', room.joinCode);
}

// Streaming (if enabled)
if (beemi.tiktok) {
  await beemi.tiktok.connect('username');
  beemi.onChat((data) => {
    // Handle TikTok chat
  });
}
```

## 📋 Module Reference

### Core Module
**Always Required** - Foundation for all other modules

```typescript
// Event System (Internal APIs - use module-specific handlers)
// beemi.on/off/emit are for internal use only

// Public utilities

// React Native Bridge
beemi.isReady(): boolean
beemi.getBridgeInfo(): BridgeInfo

// Logging
beemi.log(level: 'info' | 'error' | 'debug', message: string): void
beemi.setLogLevel(level: string): void
```

### Multiplayer (P2P) Module
**Optional** - P2P multiplayer functionality

```typescript
// Room Management
const room = await beemi.room.host('gameId', options?);
const room = await beemi.room.join('joinCode');
const room = await beemi.room.quickPlay('gameId');
await beemi.room.leave();

// Shared State (CRDT)
beemi.crdt.set('key', value);
const value = beemi.crdt.get('key');
beemi.crdt.watch('key', callback);

// Distributed Locking
await beemi.mutex.exec('lockKey', 5000, () => {
  // Critical section
});

// Leadership
beemi.ifLeader(() => {
  // Run only when current player is leader
});
```

### Streams Module
**Optional** - Live streaming platform integration

```typescript
// Platform Connections
await beemi.tiktok.connect('username');
await beemi.youtube.connect('channelId');
await beemi.twitch.connect('channelName');

// Event Handlers
beemi.onChat((data) => {
  console.log(`${data.user.username}: ${data.message}`);
});

beemi.onGift((data) => {
  console.log(`${data.user.username} sent ${data.gift.name}`);
});

beemi.onLike((data) => {
  console.log(`${data.user.username} liked ${data.count} times`);
});

// Utilities
const viewerCount = await beemi.getViewerCount();
const streamInfo = await beemi.getStreamInfo();
```

### DevTools Module
**Development Only** - Debug and testing utilities

```typescript
// Debug Tools
beemi.debug.setLogLevel('verbose');
const inspector = beemi.debug.inspectEvents();
const sdkState = beemi.debug.getSDKState();

// Mock Data
beemi.mock.streamEvents.simulateChat('testuser', 'Hello!');
beemi.mock.multiplayerEvents.simulatePlayerJoin('player123');

// Network Monitoring
beemi.network.start();
const stats = beemi.network.getStats();

// Testing Utilities
const testUser = beemi.test.simulateUser('TestPlayer');
testUser.simulate(); // Generates random events
```

## ⚙️ Configuration Options

### Manifest Configuration
```json
{
  "beemi": {
    "sdkVersion": "2.0.0",
    "core": {
      "required": true,
      "features": ["events", "bridge", "logging"]
    },
    "multiplayer-p2p": {
      "required": false,
      "features": ["rooms", "crdt", "mutex", "leadership"],
      "config": {
        "maxPlayers": 6,
        "visibility": "public",
        "persistState": true
      }
    },
    "streams": {
      "required": false
    },
    "devtools": {
      "required": true,
      "enableInProduction": false
    }
  }
}
```

### Runtime Configuration
```javascript
// Check what's loaded
console.log('Loaded modules:', beemi.getLoadedModules());

// Get module info
const multiplayer = beemi.getModuleInfo('multiplayer');
console.log('Multiplayer version:', multiplayer?.version);

// Debug access
console.log('Internal state:', beemi._modules);
```

## 🔄 Migration from v1.x

### Automatic Migration
The system automatically falls back to legacy SDK for existing games:

1. **New games**: Use modular SDK based on manifest
2. **Existing games**: Automatically use legacy SDK fallback
3. **No changes required**: Existing games continue working

### Manual Migration Steps
To migrate an existing game to modular SDK:

1. **Add manifest configuration**:
```json
{
  "beemi": {
    "sdkVersion": "2.0.0",
    "core": { "required": true },
    "streams": { "required": true }
  }
}
```

2. **Update TypeScript types** (optional):
```typescript
import type { BeemiSDK } from 'beemi-sdk/types';

declare global {
  interface Window {
    beemi: BeemiSDK<{
      core: { required: true };
      streams: { required: true };
    }>;
  }
}
```

3. **Test thoroughly**: Verify all features work as expected

## 🐛 Debugging

### Debug Mode
```javascript
// Enable verbose logging
beemi.debug.setLogLevel('verbose');

// Inspect events
const inspector = beemi.debug.inspectEvents();
console.log('Event history:', inspector.getHistory());
console.log('Event stats:', inspector.getStats());

// Get SDK state
const state = beemi.debug.getSDKState();
console.log('Current state:', state);
```

### Network Monitoring
```javascript
// Start monitoring
beemi.network.start();

// Check stats
const stats = beemi.network.getStats();
console.log(`Requests: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}`);
console.log(`Average response time: ${stats.avgResponseTime}ms`);
```

### Mock Testing
```javascript
// Simulate streaming events
beemi.mock.streamEvents.simulateChat('testuser', 'Test message');
beemi.mock.streamEvents.simulateGift('giftgiver', { name: 'Rose', value: 10 });

// Simulate multiplayer events  
beemi.mock.multiplayerEvents.simulatePlayerJoin('newplayer');
beemi.mock.multiplayerEvents.simulateLeaderChange('player123');
```

## 📊 Performance Monitoring

### Bundle Analysis
Check what's loaded and bundle sizes:
```javascript
beemi.getLoadedModules().forEach(module => {
  const info = beemi.getModuleInfo(module);
  console.log(`${module}: v${info.version}, features: ${info.features.join(', ')}`);
});
```

### Network Stats
```javascript
const stats = beemi.network.getStats();
console.log('Network Performance:', {
  totalRequests: stats.total,
  successRate: `${((stats.success / stats.total) * 100).toFixed(1)}%`,
  avgResponseTime: `${stats.avgResponseTime}ms`,
  isMonitoring: stats.isMonitoring
});
```

## 🔧 Advanced Usage

### Conditional Features
```javascript
// Only use multiplayer if available
if (beemi.room) {
  const room = await beemi.room.quickPlay('game-id');
  console.log('Multiplayer ready');
} else {
  console.log('Single-player mode');
}

// Check specific platforms
if (beemi.tiktok) {
  await beemi.tiktok.connect('username');
}
```

### Error Handling
```javascript
// Module-specific error handling
if (beemi.streams) {
  // Use module-specific error handlers when available
  // For streams: handle errors via module callbacks
}

if (beemi.multiplayer) {
  // For multiplayer: handle errors via module callbacks  
}

// Note: beemi.on() error handlers are internal APIs
```

### Custom Event Types
```typescript
// Define custom types for better IDE support
interface GameEvents {
  'player-scored': { playerId: string; points: number };
  'game-ended': { winner: string; duration: number };
}

// Custom game events should use module-specific patterns
// For multiplayer events:
if (beemi.multiplayer) {
  // Use CRDT for shared game state instead of events
  beemi.multiplayer.crdt.set('player-scores', { 
    playerId: 'player123', 
    points: 100 
  });
}
```

## 📚 API Reference

See the [full API documentation](./types/index.ts) for complete TypeScript definitions and detailed method signatures.

## 🤝 Contributing

1. **Module Development**: Each module in `packages/` is self-contained
2. **Type Safety**: All modules must include TypeScript definitions
3. **Testing**: Include unit tests for new functionality
4. **Performance**: Monitor bundle sizes and loading times

## 📄 License

MIT License - see LICENSE file for details. 