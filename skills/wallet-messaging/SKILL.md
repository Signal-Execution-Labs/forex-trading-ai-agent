# Wallet Messaging

Wallet-to-wallet encrypted messaging for trading and community.

## Features

- **Direct Messaging** - Send encrypted messages to any wallet address
- **Trade Proposals** - Send OTC trade offers with escrow support
- **Group Chats** - Token-gated community channels
- **NFT Chat** - Message other holders in a collection
- **Transaction Notes** - Attach messages to on-chain transactions
- **Read Receipts** - Know when messages are read
- **Push Notifications** - Real-time alerts via XMTP or Push Protocol

## Use Cases

- Negotiate OTC deals directly
- Coordinate with trading partners
- Join alpha groups for specific tokens
- Community governance discussions
- Private signal sharing

## Commands

```
kit message send <wallet> "text"   # Send message
kit message inbox                  # View inbox
kit message chat <wallet>          # Open chat with wallet
kit message groups                 # List joined groups
kit message join <token>           # Join token-gated group
kit message propose <trade>        # Send trade proposal
```

## API Endpoints

- `POST /api/messages/send` - Send message
- `GET /api/messages/inbox` - Get inbox
- `GET /api/messages/chat/:wallet` - Chat history
- `GET /api/messages/groups` - User's groups
- `POST /api/messages/groups/join` - Join group
- `POST /api/messages/propose` - Trade proposal

## Protocols Supported

- XMTP (primary)
- Push Protocol
- Lens Protocol messaging
- Farcaster DMs

## Configuration

```yaml
messaging:
  protocol: xmtp
  encryption: end-to-end
  notifications: true
  token_gating: true
  otc_escrow: true
```

## Security

- End-to-end encryption
- Messages signed with wallet
- No centralized storage
- Self-custody of chat history
