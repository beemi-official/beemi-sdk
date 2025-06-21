# 🎮 Beemi SDK

A comprehensive multiplayer game SDK that provides room management, real-time events, leader election, shared state, and distributed locks for HTML/JavaScript games.

## 🚀 Features

The Beemi SDK implements all the requirements from the multiplayer architecture specification:

### ✅ Transport Abstraction (2.1)
- **Native Bridge Detection**: Automatically detects React Native WebView environment
- **Direct WebSocket**: Falls back to direct WebSocket connection in browsers
- **Message Queuing**: Queues messages until connection is ready
- **Auto-reconnection**: Automatically reconnect with exponential backoff
- **Frame Resubmission**: Resends unacknowledged frames after reconnection

### ✅ Rooms API (2.2)
- **`host(gameId, options)`**: Create a new room and become the leader
- **`quickPlay(gameId, options)`**: Join an existing room or create a new one
- **`joinByCode(gameId, code)`**: Join a specific room using a join code
- Returns room object with `id`, `code`, `role`, `players()`, etc.

### ✅ Event Bus (2.3)
- **`room.emit(type, payload)`**: Send events to all room members
- **`room.on(type, callback)`**: Listen for specific event types
- **Implicit sequence numbers**: All messages automatically include sequence numbers
- **Cross-tab communication**: Events work between different browser tabs/windows

### ✅ Leader Helper (2.4)
- **`room.ifLeader(callback)`**: Execute callback only when you're the leader
- **Automatic re-election**: Callbacks re-execute when leadership changes
- **Single execution guarantee**: Leader-only code runs exactly once per leader term

### ✅ Shared State - CRDT (2.5)
- **`crdt.get(key)`**: Get shared value
- **`crdt.set(key, value)`**: Set shared value (last-write-wins)
- **`crdt.watch(key, callback)`**: Watch for value changes
- **Conflict resolution**: Automatic version-based conflict resolution

### ✅ Mutex Manager (2.5)
- **`mutex.exec(key, ttl, fn)`**: Execute function with distributed lock
- **Race condition prevention**: Ensures only one client executes critical sections
- **Timeout protection**: Locks automatically expire after TTL
- **Async support**: Works with both sync and async functions

### ✅ Share-link Helper (2.6)
- **`room.shareLink()`**: Generate deep-link for room sharing
- **Universal format**: `beemi://join/<game>/<code>` format
- **Cross-platform**: Works with native app deep-link handling

## 📦 Installation

```bash
npm install
```

## 🎯 Basic Usage

### Simple Game Example

```javascript
import { host, quickPlay, crdt, mutex } from './beemi-sdk-0.1.js';

// Join or create a game room
const room = await quickPlay('my-game', { max: 4 });

// Send events to other players
room.emit('playerMove', { x: 100, y: 200 });

// Listen for events from other players
room.on('playerMove', (data) => {
    console.log('Player moved to:', data.x, data.y);
});

// Leader-only initialization
room.ifLeader(() => {
    console.log('I am the leader! Setting up game...');
    crdt.set('gameState', 'initializing');
});

// Shared state management
crdt.watch('gameState', (state) => {
    console.log('Game state changed to:', state);
});

// Critical sections with distributed locks
async function processPlayerAction() {
    await mutex.exec('playerTurn', 5000, () => {
        // Only one player can process their turn at a time
        console.log('Processing my turn...');
        crdt.set('currentPlayer', room.id);
    });
}
```

### Complete Game Pattern

```javascript
import { host, quickPlay, crdt, mutex } from './beemi-sdk-0.1.js';

// Create or join room
const room = await quickPlay('wolf-game', { max: 8 });

// One-time leader setup
room.ifLeader(async () => {
    const players = await room.players();
    const wolf = Math.floor(Math.random() * players.length);
    
    const roles = players.reduce((acc, player, index) => {
        acc[player] = index === wolf ? 'wolf' : 'villager';
        return acc;
    }, {});
    
    crdt.set('roles', roles);
    crdt.set('gamePhase', 'day');
});

// React to shared state changes
crdt.watch('roles', (roles) => {
    const myRole = roles[room.id];
    updateUI(myRole);
});

// Handle game events
room.on('vote', (data) => {
    console.log(`Player voted for: ${data.target}`);
});

// Race-safe night kill (any wolf can attempt)
async function nightKill(target) {
    await mutex.exec('nightAction', 10000, () => {
        if (crdt.get('gamePhase') === 'night') {
            room.emit('kill', { target });
            crdt.set('gamePhase', 'day');
        }
    });
}

// Share room with friends
console.log('Share this link:', room.shareLink());
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

The test suite covers:
- Transport abstraction and connection handling
- Room creation, joining, and management
- Event bus functionality with sequence numbers
- Leader election and callback execution
- CRDT operations and watchers
- Mutex operations and concurrent access
- Share-link generation
- End-to-end integration scenarios

## 🎮 Demo & Examples

### Interactive Test Suite
Open `sdk-test/index.html` in a browser to try all SDK features interactively:
- Create and join rooms
- Send/receive events
- Test leader helpers
- Manage shared state
- Test distributed locks

### Ping Game Example
Open `example-game.html` for a complete multiplayer game example that demonstrates:
- Room hosting and joining
- Leader-coordinated game logic
- Real-time event communication
- Shared state synchronization
- Distributed lock usage
- Room sharing functionality

## 🏗️ Architecture

The SDK follows the Beemi multiplayer architecture:

```
┌──────────────┐       ┌────────────┐
│  Game Code   │──────▶│Beemi Server│
└──────────────┘       └────────────┘
        ▲                    
        │ SDK Interface      
        │                    
┌───────▼──────┐       
│ Transport    │ ◀─── Auto-detects: Bridge or WebSocket
│ Abstraction  │
└──────────────┘
```

### Message Flow
1. Game calls SDK API (`room.emit`, `crdt.set`, etc.)
2. SDK adds sequence numbers and queues messages
3. Transport layer sends via bridge (React Native) or WebSocket (browser)
4. Server validates and broadcasts to all room members
5. Incoming messages trigger callbacks in all connected clients

### Key Components
- **Transport**: Handles connection, queuing, reconnection
- **Room**: Manages room state, events, and member info
- **CRDT**: Last-write-wins shared state with conflict resolution
- **Mutex**: Distributed locking for critical sections
- **Event Bus**: Type-safe event emission and listening

## 🔧 Configuration

### Room Options
```javascript
const room = await host('game-id', {
    max: 6,           // Maximum players (default: 4)
    serverUrl: 'ws://custom-server:8080'  // Custom server URL
});
```

### Transport Options
The SDK automatically detects the environment:
- **React Native WebView**: Uses `window.ReactNativeWebView.postMessage`
- **Browser**: Uses direct WebSocket connection
- **Reconnection**: Automatic with exponential backoff (max 5 attempts)

## 📋 API Reference

### Room Management
- `host(gameId, options)` → Promise\<Room>
- `quickPlay(gameId, options)` → Promise\<Room>
- `joinByCode(gameId, code, options)` → Promise\<Room>

### Room Object
- `room.id` - Unique room identifier
- `room.code` - Human-readable join code
- `room.role` - 'leader' or 'peer'
- `room.emit(type, payload)` - Send event
- `room.on(type, callback)` - Listen for events
- `room.ifLeader(callback)` - Execute when leader
- `room.players()` - Get player list
- `room.shareLink()` - Get share URL

### Shared State (CRDT)
- `crdt.get(key)` - Get value
- `crdt.set(key, value)` - Set value
- `crdt.watch(key, callback)` - Watch changes

### Distributed Locks
- `mutex.exec(key, ttl, fn)` - Execute with lock

## 🤝 Contributing

1. Make changes to `beemi-sdk-0.1.js`
2. Add/update tests in `beemi-sdk.test.js`
3. Run tests: `npm test`
4. Test in browser with `sdk-test/index.html`
5. Test example game with `example-game.html`

## 📝 License

This SDK implements the Beemi multiplayer architecture specification for educational and development purposes.

---

**Ready to build multiplayer games?** 🎮 Start with the examples and test suite to see the SDK in action! 