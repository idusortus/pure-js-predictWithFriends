# PredictWithFriends - Prediction Markets Platform

A Kalshi/Polymarket-style prediction markets platform for friends with invite-only access, built with pure vanilla JavaScript and in-memory session storage.

## Features

- 🎲 **Prediction Markets**: Create and bet on prediction markets with your friends
- 🔒 **Invite-Only Access**: Secure platform with invite codes
- 💬 **Global Chat Room**: Real-time chat with all online users
- 👥 **Multiple Concurrent Users**: Support for many users online simultaneously
- 💰 **Token-Based Betting**: Each user starts with 1000 tokens
- 📊 **Real-Time Updates**: WebSocket-powered live updates
- 🎨 **Clean UI**: Modern, responsive interface built with vanilla JavaScript

## Tech Stack

- **Frontend**: Pure Vanilla JavaScript (no frameworks)
- **Backend**: Node.js with WebSocket support
- **Storage**: In-memory (no database required)
- **Deployment**: Azure-ready configuration

## Getting Started

### Prerequisites

- Node.js 18.x or higher

### Installation

1. Clone the repository:
```bash
git clone https://github.com/idusortus/pure-js-predictWithFriends.git
cd pure-js-predictWithFriends
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:8080
```

### Default Invite Codes

The platform comes with three default invite codes:
- `ALPHA2026`
- `BETA2026`
- `GAMMA2026`

You can use any of these codes to register your first account.

## Usage

### Registering

1. Click the "Register" tab
2. Enter a username
3. Enter one of the valid invite codes
4. Click "Register"

### Creating a Market

1. Click the "Create Market" button
2. Enter your prediction question
3. Set a close date (optional, defaults to 7 days)
4. Click "Create"

### Placing Bets

1. Find a market you want to bet on
2. Click either "Bet YES" or "Bet NO"
3. Enter the amount of tokens you want to bet
4. Click "Place Bet"

### Resolving Markets

- Only the market creator can resolve their markets
- Click "Resolve YES" or "Resolve NO" to determine the outcome
- Winners are automatically paid out proportionally to their bets

### Using Chat

- Type your message in the chat input
- Click "Send" or press Enter
- All online users will see your message in real-time

## Deployment to Azure

### Option 1: Azure App Service (Recommended)

1. Install Azure CLI:
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

2. Login to Azure:
```bash
az login
```

3. Create a resource group:
```bash
az group create --name predictWithFriends-rg --location eastus
```

4. Create an App Service plan:
```bash
az appservice plan create --name predictWithFriends-plan --resource-group predictWithFriends-rg --sku B1 --is-linux
```

5. Create a web app:
```bash
az webapp create --name predictWithFriends --resource-group predictWithFriends-rg --plan predictWithFriends-plan --runtime "NODE:18-lts"
```

6. Enable WebSocket support:
```bash
az webapp config set --name predictWithFriends --resource-group predictWithFriends-rg --web-sockets-enabled true
```

7. Deploy from local Git:
```bash
az webapp deployment source config-local-git --name predictWithFriends --resource-group predictWithFriends-rg
```

8. Get the deployment URL and push:
```bash
# The command above will output a Git URL
git remote add azure <git-url-from-previous-command>
git push azure main
```

### Option 2: Azure Container Instances

1. Build the Docker image (optional, for containerized deployment):
```bash
docker build -t predictwithfriends .
```

2. Deploy to Azure Container Registry and Container Instances:
```bash
# Create container registry
az acr create --name predictwithfriendsacr --resource-group predictWithFriends-rg --sku Basic

# Login to registry
az acr login --name predictwithfriendsacr

# Tag and push image
docker tag predictwithfriends predictwithfriendsacr.azurecr.io/predictwithfriends:latest
docker push predictwithfriendsacr.azurecr.io/predictwithfriends:latest

# Deploy container
az container create --name predictwithfriends --resource-group predictWithFriends-rg --image predictwithfriendsacr.azurecr.io/predictwithfriends:latest --dns-name-label predictwithfriends --ports 8080
```

### Environment Variables

The application uses the following environment variables:

- `PORT`: Server port (default: 8080)

Set environment variables in Azure:
```bash
az webapp config appsettings set --name predictWithFriends --resource-group predictWithFriends-rg --settings PORT=8080
```

## Architecture

### Server (server.js)

- HTTP server for serving static files
- WebSocket server for real-time communication
- In-memory storage for users, sessions, markets, bets, and chat messages
- Session management with 24-hour expiration

### Client (public/app.js)

- WebSocket client for real-time updates
- State management for markets, bets, and chat
- Event handlers for user interactions
- LocalStorage for session persistence

### Storage Structure

```javascript
{
  users: Map,        // userId -> { username, inviteCode, balance }
  sessions: Map,     // sessionId -> { userId, expiresAt }
  inviteCodes: Set,  // Valid invite codes
  markets: Map,      // marketId -> market object
  bets: Map,         // betId -> bet object
  chatMessages: [],  // Array of chat messages
  connections: Map   // sessionId -> WebSocket connection
}
```

## Security Considerations

- Invite-only access with pre-defined codes
- Session-based authentication
- XSS prevention with HTML escaping
- Session expiration (24 hours)
- Input validation on server side

## Limitations

- **In-memory storage**: All data is lost when the server restarts
- **Single server instance**: Not designed for horizontal scaling
- **No persistence**: Markets and bets are not saved to disk
- **Simple betting model**: Fixed-share betting without automated market makers

## Future Enhancements

- Persistent storage (database)
- Advanced betting models (AMM, order books)
- User profiles and statistics
- Market categories and tags
- Email notifications
- Mobile app
- Admin dashboard
- Market comments and discussions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions, please open an issue on GitHub.