const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// In-memory storage
const store = {
  users: new Map(), // userId -> { username, inviteCode, balance }
  sessions: new Map(), // sessionId -> { userId, expiresAt }
  inviteCodes: new Set(['ALPHA2026', 'BETA2026', 'GAMMA2026']), // Valid invite codes
  markets: new Map(), // marketId -> market object
  bets: new Map(), // betId -> bet object
  chatMessages: [],
  connections: new Map() // sessionId -> ws connection
};

let marketIdCounter = 1;
let betIdCounter = 1;
let userIdCounter = 1;

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Serve static files
  if (req.method === 'GET') {
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = path.join(__dirname, 'public', filePath);
    
    const extname = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    };
    
    const contentType = contentTypes[extname] || 'text/plain';
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('404 Not Found');
        } else {
          res.writeHead(500);
          res.end('500 Server Error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  } else {
    res.writeHead(405);
    res.end('Method Not Allowed');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Helper function to broadcast to all connected clients
function broadcast(data, excludeSessionId = null) {
  store.connections.forEach((ws, sessionId) => {
    if (sessionId !== excludeSessionId && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  });
}

// Helper function to generate session ID
function generateSessionId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// WebSocket message handlers
wss.on('connection', (ws) => {
  let currentSessionId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register':
          handleRegister(ws, data);
          break;
        case 'login':
          handleLogin(ws, data);
          break;
        case 'createMarket':
          handleCreateMarket(ws, data);
          break;
        case 'placeBet':
          handlePlaceBet(ws, data);
          break;
        case 'resolveMarket':
          handleResolveMarket(ws, data);
          break;
        case 'sendMessage':
          handleSendMessage(ws, data);
          break;
        case 'getState':
          handleGetState(ws, data);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    if (currentSessionId) {
      store.connections.delete(currentSessionId);
      broadcast({ type: 'userLeft', timestamp: Date.now() });
    }
  });

  function handleRegister(ws, data) {
    const { username, inviteCode } = data;
    
    if (!username || !inviteCode) {
      ws.send(JSON.stringify({ type: 'error', message: 'Username and invite code required' }));
      return;
    }
    
    if (!store.inviteCodes.has(inviteCode)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid invite code' }));
      return;
    }
    
    // Check if username already exists
    for (const user of store.users.values()) {
      if (user.username.toLowerCase() === username.toLowerCase()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Username already taken' }));
        return;
      }
    }
    
    const userId = `user${userIdCounter++}`;
    store.users.set(userId, {
      username,
      inviteCode,
      balance: 1000 // Starting balance
    });
    
    const sessionId = generateSessionId();
    store.sessions.set(sessionId, {
      userId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    
    currentSessionId = sessionId;
    store.connections.set(sessionId, ws);
    
    ws.send(JSON.stringify({
      type: 'registered',
      sessionId,
      userId,
      username,
      balance: 1000
    }));
    
    broadcast({ type: 'userJoined', username, timestamp: Date.now() }, sessionId);
  }

  function handleLogin(ws, data) {
    const { username } = data;
    
    if (!username) {
      ws.send(JSON.stringify({ type: 'error', message: 'Username required' }));
      return;
    }
    
    // Find user by username
    let foundUserId = null;
    let foundUser = null;
    for (const [userId, user] of store.users.entries()) {
      if (user.username.toLowerCase() === username.toLowerCase()) {
        foundUserId = userId;
        foundUser = user;
        break;
      }
    }
    
    if (!foundUserId) {
      ws.send(JSON.stringify({ type: 'error', message: 'User not found. Please register first.' }));
      return;
    }
    
    const sessionId = generateSessionId();
    store.sessions.set(sessionId, {
      userId: foundUserId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });
    
    currentSessionId = sessionId;
    store.connections.set(sessionId, ws);
    
    ws.send(JSON.stringify({
      type: 'loggedIn',
      sessionId,
      userId: foundUserId,
      username: foundUser.username,
      balance: foundUser.balance
    }));
    
    broadcast({ type: 'userJoined', username: foundUser.username, timestamp: Date.now() }, sessionId);
  }

  function handleCreateMarket(ws, data) {
    const { sessionId, question, closeDate } = data;
    
    const session = store.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
      return;
    }
    
    const user = store.users.get(session.userId);
    
    const marketId = `market${marketIdCounter++}`;
    const market = {
      id: marketId,
      question,
      creatorId: session.userId,
      creatorName: user.username,
      closeDate: closeDate || Date.now() + 7 * 24 * 60 * 60 * 1000, // Default 7 days
      createdAt: Date.now(),
      resolved: false,
      outcome: null,
      yesPool: 0,
      noPool: 0,
      yesShares: 0,
      noShares: 0
    };
    
    store.markets.set(marketId, market);
    
    broadcast({ type: 'marketCreated', market });
  }

  function handlePlaceBet(ws, data) {
    const { sessionId, marketId, side, amount } = data;
    
    const session = store.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
      return;
    }
    
    const user = store.users.get(session.userId);
    const market = store.markets.get(marketId);
    
    if (!market) {
      ws.send(JSON.stringify({ type: 'error', message: 'Market not found' }));
      return;
    }
    
    if (market.resolved) {
      ws.send(JSON.stringify({ type: 'error', message: 'Market already resolved' }));
      return;
    }
    
    if (user.balance < amount) {
      ws.send(JSON.stringify({ type: 'error', message: 'Insufficient balance' }));
      return;
    }
    
    // Simple betting: 1 token = 1 share at current implied probability
    user.balance -= amount;
    
    const betId = `bet${betIdCounter++}`;
    const bet = {
      id: betId,
      marketId,
      userId: session.userId,
      username: user.username,
      side,
      amount,
      shares: amount,
      timestamp: Date.now()
    };
    
    store.bets.set(betId, bet);
    
    if (side === 'yes') {
      market.yesPool += amount;
      market.yesShares += amount;
    } else {
      market.noPool += amount;
      market.noShares += amount;
    }
    
    broadcast({ type: 'betPlaced', bet, market, userId: session.userId, newBalance: user.balance });
  }

  function handleResolveMarket(ws, data) {
    const { sessionId, marketId, outcome } = data;
    
    const session = store.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
      return;
    }
    
    const market = store.markets.get(marketId);
    
    if (!market) {
      ws.send(JSON.stringify({ type: 'error', message: 'Market not found' }));
      return;
    }
    
    if (market.creatorId !== session.userId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Only market creator can resolve' }));
      return;
    }
    
    if (market.resolved) {
      ws.send(JSON.stringify({ type: 'error', message: 'Market already resolved' }));
      return;
    }
    
    market.resolved = true;
    market.outcome = outcome;
    market.resolvedAt = Date.now();
    
    // Pay out winners
    const totalPool = market.yesPool + market.noPool;
    for (const bet of store.bets.values()) {
      if (bet.marketId === marketId && bet.side === outcome) {
        const user = store.users.get(bet.userId);
        if (user) {
          const payout = (bet.amount / (outcome === 'yes' ? market.yesPool : market.noPool)) * totalPool;
          user.balance += payout;
        }
      }
    }
    
    broadcast({ type: 'marketResolved', market });
  }

  function handleSendMessage(ws, data) {
    const { sessionId, message } = data;
    
    const session = store.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
      return;
    }
    
    const user = store.users.get(session.userId);
    
    const chatMessage = {
      username: user.username,
      message,
      timestamp: Date.now()
    };
    
    store.chatMessages.push(chatMessage);
    
    // Keep only last 100 messages
    if (store.chatMessages.length > 100) {
      store.chatMessages = store.chatMessages.slice(-100);
    }
    
    broadcast({ type: 'chatMessage', chatMessage });
  }

  function handleGetState(ws, data) {
    const { sessionId } = data;
    
    const session = store.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
      return;
    }
    
    const user = store.users.get(session.userId);
    
    const markets = Array.from(store.markets.values());
    const userBets = Array.from(store.bets.values()).filter(bet => bet.userId === session.userId);
    
    ws.send(JSON.stringify({
      type: 'state',
      user: {
        userId: session.userId,
        username: user.username,
        balance: user.balance
      },
      markets,
      userBets,
      chatMessages: store.chatMessages.slice(-50)
    }));
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available invite codes: ${Array.from(store.inviteCodes).join(', ')}`);
});
