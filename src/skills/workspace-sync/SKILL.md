# Workspace Sync

> **Skill #70** - Cross-device workspace synchronization

## Overview

Inspired by TradingView's cross-tab synchronization. Keep your K.I.T. workspace, watchlists, alerts, and settings synchronized across all devices and sessions.

## Features

- **Real-Time Sync:** Changes propagate instantly
- **Watchlist Sync:** Keep watchlists aligned everywhere
- **Alert Sync:** Alerts trigger on all connected devices
- **Settings Sync:** Preferences follow you
- **Chart Sync:** Drawings, intervals, templates
- **Conflict Resolution:** Smart merge for concurrent edits

## Usage

```bash
# Enable sync
kit skill workspace-sync --enable

# Sync specific items
kit skill workspace-sync --items watchlists,alerts

# Force sync
kit skill workspace-sync --force

# Check sync status
kit skill workspace-sync --status
```

## Configuration

```yaml
workspace_sync:
  enabled: true
  server: "wss://sync.kit-trading.io"
  
  sync_items:
    watchlists: true
    alerts: true
    settings: true
    templates: true
    drawings: false      # Can be large
    positions: true
    journal: true
  
  conflict_resolution: "latest_wins"  # or "merge", "ask"
  
  devices:
    max_connected: 5
    notify_new_device: true
  
  offline_mode:
    queue_changes: true
    max_queue_size: 100
```

## Sync Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Desktop   │────▶│             │◀────│   Mobile    │
│   K.I.T.    │     │  Sync Hub   │     │   K.I.T.    │
└─────────────┘     │             │     └─────────────┘
       │            │  WebSocket  │            │
       │            │   Server    │            │
       ▼            │             │            ▼
┌─────────────┐     └──────┬──────┘     ┌─────────────┐
│   VPS Bot   │◀───────────┴────────────│   Browser   │
│   Instance  │                         │   Session   │
└─────────────┘                         └─────────────┘
```

## Synced Data Types

| Type | Sync Speed | Size Limit |
|------|-----------|------------|
| Watchlists | Instant | 1000 symbols |
| Alerts | Instant | 500 alerts |
| Settings | Instant | N/A |
| Templates | On-demand | 50 templates |
| Drawings | On-demand | 100 per chart |
| Positions | Real-time | All |
| Journal | Background | All |

## Security

- End-to-end encryption (AES-256)
- Device authentication via tokens
- Optional 2FA for new devices
- Audit log for sync events
- Self-hosted option available

## Events

```javascript
kit.on('sync:connected', () => console.log('Sync connected'));
kit.on('sync:update', (data) => console.log('Data synced:', data));
kit.on('sync:conflict', (conflict) => console.log('Conflict:', conflict));
kit.on('sync:offline', () => console.log('Working offline'));
```
