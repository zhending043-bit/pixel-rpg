const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Online players: { ws -> { name, playerData } }
const onlinePlayers = new Map();

function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client !== excludeWs) {
      client.send(data);
    }
  });
}

function getPlayerList() {
  return Array.from(onlinePlayers.values()).map(p => ({
    name: p.name,
    level: p.playerData.level,
  }));
}

wss.on('connection', (ws) => {
  console.log('New connection');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'login': {
        const name = (msg.name || '').trim().slice(0, 12);
        if (!name) return;

        // Check duplicate name
        for (const [, p] of onlinePlayers) {
          if (p.name === name) {
            ws.send(JSON.stringify({ type: 'error', message: '名字已被使用' }));
            return;
          }
        }

        ws.playerName = name;
        onlinePlayers.set(ws, { name, playerData: msg.playerData || {} });
        ws.send(JSON.stringify({ type: 'login_ok', name }));
        // Notify all
        broadcast({ type: 'players', list: getPlayerList() });
        break;
      }

      case 'logout': {
        if (ws.playerName) {
          onlinePlayers.delete(ws);
          broadcast({ type: 'players', list: getPlayerList() });
        }
        break;
      }

      case 'challenge': {
        // Find target by name
        const targetName = msg.target;
        for (const [targetWs, info] of onlinePlayers) {
          if (info.name === targetName && targetWs !== ws) {
            targetWs.send(JSON.stringify({
              type: 'challenged',
              from: ws.playerName,
            }));
            ws.send(JSON.stringify({ type: 'challenge_sent', target: targetName }));
            return;
          }
        }
        ws.send(JSON.stringify({ type: 'error', message: '找不到该玩家' }));
        break;
      }

      case 'challenge_response': {
        const challengerName = msg.target;
        for (const [challengerWs, info] of onlinePlayers) {
          if (info.name === challengerName && challengerWs !== ws) {
            if (msg.accept) {
              // Start battle - exchange player data
              // challengerWs = initiator, ws = responder
              const defenderData = onlinePlayers.get(ws).playerData;
              const challengerData = info.playerData;

              challengerWs.send(JSON.stringify({
                type: 'battle_start',
                opponent: defenderData,
                attacker: challengerName,
              }));

              ws.send(JSON.stringify({
                type: 'battle_start',
                opponent: challengerData,
                attacker: challengerName,
              }));
            } else {
              targetWs.send(JSON.stringify({
                type: 'challenge_declined',
                from: ws.playerName,
              }));
            }
            return;
          }
        }
        break;
      }

      case 'pvp_attack': {
        // Forward attack to opponent
        const opponentName = msg.target;
        for (const [targetWs] of onlinePlayers) {
          const info = onlinePlayers.get(targetWs);
          if (info && info.name === opponentName && targetWs !== ws) {
            targetWs.send(JSON.stringify({
              type: 'pvp_attacked',
              from: ws.playerName,
              damage: msg.damage,
              critical: msg.critical,
            }));
            return;
          }
        }
        break;
      }

      case 'pvp_result': {
        const opponentName = msg.target;
        for (const [targetWs] of onlinePlayers) {
          const info = onlinePlayers.get(targetWs);
          if (info && info.name === opponentName && targetWs !== ws) {
            targetWs.send(JSON.stringify({
              type: 'pvp_result',
              winner: msg.winner,
              from: ws.playerName,
            }));
            return;
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.playerName) {
      onlinePlayers.delete(ws);
      broadcast({ type: 'players', list: getPlayerList() });
      console.log(`${ws.playerName} disconnected`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎮 Pixel RPG Server running at http://localhost:${PORT}`);
});
