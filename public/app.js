// State management
const state = {
  ws: null,
  sessionId: null,
  userId: null,
  username: null,
  balance: 0,
  markets: [],
  userBets: [],
  chatMessages: [],
  currentMarketForBet: null,
  currentBetSide: null
};

// DOM Elements
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const authError = document.getElementById('authError');
const logoutButton = document.getElementById('logoutButton');
const usernameDisplay = document.getElementById('usernameDisplay');
const balanceDisplay = document.getElementById('balanceDisplay');
const marketsList = document.getElementById('marketsList');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatButton = document.getElementById('sendChatButton');
const createMarketButton = document.getElementById('createMarketButton');
const createMarketModal = document.getElementById('createMarketModal');
const betModal = document.getElementById('betModal');

// Initialize WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  state.ws = new WebSocket(wsUrl);
  
  state.ws.onopen = () => {
    console.log('WebSocket connected');
    if (state.sessionId) {
      send({ type: 'getState', sessionId: state.sessionId });
    }
  };
  
  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };
  
  state.ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  state.ws.onclose = () => {
    console.log('WebSocket closed');
    setTimeout(connectWebSocket, 3000);
  };
}

// Send message to server
function send(data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

// Handle incoming messages
function handleMessage(data) {
  switch (data.type) {
    case 'registered':
    case 'loggedIn':
      state.sessionId = data.sessionId;
      state.userId = data.userId;
      state.username = data.username;
      state.balance = data.balance;
      saveSession();
      showApp();
      send({ type: 'getState', sessionId: state.sessionId });
      break;
      
    case 'error':
      showError(data.message);
      break;
      
    case 'state':
      state.balance = data.user.balance;
      state.markets = data.markets;
      state.userBets = data.userBets;
      state.chatMessages = data.chatMessages;
      updateUI();
      break;
      
    case 'marketCreated':
      state.markets.push(data.market);
      renderMarkets();
      break;
      
    case 'betPlaced':
      updateMarket(data.market);
      if (data.userId === state.userId) {
        state.balance = data.newBalance;
        state.userBets.push(data.bet);
        updateBalance();
      }
      renderMarkets();
      break;
      
    case 'marketResolved':
      updateMarket(data.market);
      send({ type: 'getState', sessionId: state.sessionId });
      renderMarkets();
      break;
      
    case 'chatMessage':
      state.chatMessages.push(data.chatMessage);
      if (state.chatMessages.length > 100) {
        state.chatMessages = state.chatMessages.slice(-100);
      }
      renderChat();
      break;
      
    case 'userJoined':
    case 'userLeft':
      // Could show notifications
      break;
  }
}

// Update market in state
function updateMarket(updatedMarket) {
  const index = state.markets.findIndex(m => m.id === updatedMarket.id);
  if (index !== -1) {
    state.markets[index] = updatedMarket;
  }
}

// Show error message
function showError(message) {
  authError.textContent = message;
  setTimeout(() => {
    authError.textContent = '';
  }, 5000);
}

// Save session to localStorage
function saveSession() {
  localStorage.setItem('sessionId', state.sessionId);
  localStorage.setItem('userId', state.userId);
  localStorage.setItem('username', state.username);
}

// Load session from localStorage
function loadSession() {
  const sessionId = localStorage.getItem('sessionId');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (sessionId && userId && username) {
    state.sessionId = sessionId;
    state.userId = userId;
    state.username = username;
    return true;
  }
  return false;
}

// Clear session
function clearSession() {
  localStorage.removeItem('sessionId');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  state.sessionId = null;
  state.userId = null;
  state.username = null;
  state.balance = 0;
}

// Show app screen
function showApp() {
  authScreen.style.display = 'none';
  appScreen.style.display = 'block';
  usernameDisplay.textContent = state.username;
  updateBalance();
}

// Show auth screen
function showAuth() {
  authScreen.style.display = 'block';
  appScreen.style.display = 'none';
}

// Update UI
function updateUI() {
  updateBalance();
  renderMarkets();
  renderChat();
}

// Update balance display
function updateBalance() {
  balanceDisplay.textContent = state.balance.toFixed(0);
}

// Render markets
function renderMarkets() {
  if (state.markets.length === 0) {
    marketsList.innerHTML = `
      <div class="empty-state">
        <h3>No markets yet</h3>
        <p>Be the first to create a prediction market!</p>
      </div>
    `;
    return;
  }
  
  const sortedMarkets = [...state.markets].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
  
  marketsList.innerHTML = sortedMarkets.map(market => {
    const totalPool = market.yesPool + market.noPool;
    const yesPercent = totalPool > 0 ? (market.yesPool / totalPool * 100).toFixed(0) : 50;
    const noPercent = totalPool > 0 ? (market.noPool / totalPool * 100).toFixed(0) : 50;
    
    const isCreator = market.creatorId === state.userId;
    const closeDate = new Date(market.closeDate).toLocaleDateString();
    
    return `
      <div class="market-card">
        <div class="market-header">
          <div class="market-question">${escapeHtml(market.question)}</div>
          <span class="market-status ${market.resolved ? 'resolved' : 'open'}">
            ${market.resolved ? `Resolved: ${market.outcome.toUpperCase()}` : 'Open'}
          </span>
        </div>
        
        <div class="market-info">
          Created by ${escapeHtml(market.creatorName)} | Closes: ${closeDate}
        </div>
        
        <div class="market-pools">
          <div class="pool">
            <div class="pool-label">YES ${yesPercent}%</div>
            <div class="pool-bar">
              <div class="pool-bar-fill yes" style="width: ${yesPercent}%"></div>
            </div>
            <div class="pool-value">${market.yesPool} tokens</div>
          </div>
          
          <div class="pool">
            <div class="pool-label">NO ${noPercent}%</div>
            <div class="pool-bar">
              <div class="pool-bar-fill no" style="width: ${noPercent}%"></div>
            </div>
            <div class="pool-value">${market.noPool} tokens</div>
          </div>
        </div>
        
        ${!market.resolved ? `
          <div class="market-actions">
            <button class="btn-bet btn-yes" onclick="openBetModal('${market.id}', 'yes')">
              Bet YES
            </button>
            <button class="btn-bet btn-no" onclick="openBetModal('${market.id}', 'no')">
              Bet NO
            </button>
            ${isCreator ? `
              <button class="btn-resolve" onclick="resolveMarket('${market.id}', 'yes')">
                Resolve YES
              </button>
              <button class="btn-resolve" onclick="resolveMarket('${market.id}', 'no')">
                Resolve NO
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Render chat
function renderChat() {
  chatMessages.innerHTML = state.chatMessages.map(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    return `
      <div class="chat-message">
        <div class="chat-username">${escapeHtml(msg.username)}</div>
        <div class="chat-text">${escapeHtml(msg.message)}</div>
        <div class="chat-timestamp">${time}</div>
      </div>
    `;
  }).join('');
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open bet modal
function openBetModal(marketId, side) {
  const market = state.markets.find(m => m.id === marketId);
  if (!market) return;
  
  state.currentMarketForBet = marketId;
  state.currentBetSide = side;
  
  document.getElementById('betModalQuestion').textContent = market.question;
  document.getElementById('betAmount').value = '';
  document.getElementById('betError').textContent = '';
  
  // Update button selection
  const yesBtn = document.getElementById('betYesButton');
  const noBtn = document.getElementById('betNoButton');
  
  if (side === 'yes') {
    yesBtn.classList.add('selected');
    noBtn.classList.remove('selected');
  } else {
    noBtn.classList.add('selected');
    yesBtn.classList.remove('selected');
  }
  
  betModal.classList.add('active');
}

// Close modals
function closeModals() {
  createMarketModal.classList.remove('active');
  betModal.classList.remove('active');
}

// Resolve market
function resolveMarket(marketId, outcome) {
  if (confirm(`Are you sure you want to resolve this market as ${outcome.toUpperCase()}?`)) {
    send({
      type: 'resolveMarket',
      sessionId: state.sessionId,
      marketId,
      outcome
    });
  }
}

// Event Listeners
loginTab.addEventListener('click', () => {
  loginTab.classList.add('active');
  registerTab.classList.remove('active');
  loginForm.style.display = 'flex';
  registerForm.style.display = 'none';
  authError.textContent = '';
});

registerTab.addEventListener('click', () => {
  registerTab.classList.add('active');
  loginTab.classList.remove('active');
  registerForm.style.display = 'flex';
  loginForm.style.display = 'none';
  authError.textContent = '';
});

loginButton.addEventListener('click', () => {
  const username = document.getElementById('loginUsername').value.trim();
  if (!username) {
    showError('Please enter a username');
    return;
  }
  
  send({ type: 'login', username });
});

registerButton.addEventListener('click', () => {
  const username = document.getElementById('registerUsername').value.trim();
  const inviteCode = document.getElementById('registerInviteCode').value.trim();
  
  if (!username || !inviteCode) {
    showError('Please enter both username and invite code');
    return;
  }
  
  send({ type: 'register', username, inviteCode });
});

logoutButton.addEventListener('click', () => {
  clearSession();
  showAuth();
  state.markets = [];
  state.chatMessages = [];
});

createMarketButton.addEventListener('click', () => {
  createMarketModal.classList.add('active');
  document.getElementById('marketQuestion').value = '';
  
  // Set default close date to 7 days from now
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  document.getElementById('marketCloseDate').value = defaultDate.toISOString().slice(0, 16);
});

document.getElementById('submitMarketButton').addEventListener('click', () => {
  const question = document.getElementById('marketQuestion').value.trim();
  const closeDate = document.getElementById('marketCloseDate').value;
  
  if (!question) {
    document.getElementById('createMarketError').textContent = 'Please enter a question';
    return;
  }
  
  const closeDateTimestamp = closeDate ? new Date(closeDate).getTime() : null;
  
  send({
    type: 'createMarket',
    sessionId: state.sessionId,
    question,
    closeDate: closeDateTimestamp
  });
  
  closeModals();
});

document.getElementById('cancelMarketButton').addEventListener('click', closeModals);

document.getElementById('betYesButton').addEventListener('click', () => {
  state.currentBetSide = 'yes';
  document.getElementById('betYesButton').classList.add('selected');
  document.getElementById('betNoButton').classList.remove('selected');
});

document.getElementById('betNoButton').addEventListener('click', () => {
  state.currentBetSide = 'no';
  document.getElementById('betNoButton').classList.add('selected');
  document.getElementById('betYesButton').classList.remove('selected');
});

document.getElementById('submitBetButton').addEventListener('click', () => {
  const amount = parseInt(document.getElementById('betAmount').value);
  
  if (!amount || amount <= 0) {
    document.getElementById('betError').textContent = 'Please enter a valid amount';
    return;
  }
  
  if (amount > state.balance) {
    document.getElementById('betError').textContent = 'Insufficient balance';
    return;
  }
  
  send({
    type: 'placeBet',
    sessionId: state.sessionId,
    marketId: state.currentMarketForBet,
    side: state.currentBetSide,
    amount
  });
  
  closeModals();
});

document.getElementById('cancelBetButton').addEventListener('click', closeModals);

sendChatButton.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (!message) return;
  
  send({
    type: 'sendMessage',
    sessionId: state.sessionId,
    message
  });
  
  chatInput.value = '';
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatButton.click();
  }
});

// Close modals on background click
[createMarketModal, betModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModals();
    }
  });
});

// Make functions globally available
window.openBetModal = openBetModal;
window.resolveMarket = resolveMarket;

// Initialize app
connectWebSocket();

if (loadSession()) {
  showApp();
} else {
  showAuth();
}
