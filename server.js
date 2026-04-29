const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { MongoClient, ServerApiVersion } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========= MongoDB (persistent) / File fallback =========
let dbReady = false;
let db;

async function initDb() {
  if (MONGODB_URI) {
    try {
      const client = new MongoClient(MONGODB_URI, {
        serverApi: ServerApiVersion.v1,
      });
      await client.connect();
      db = client.db('pixel_rpg');
      // Create index on name for fast lookup
      await db.collection('saves').createIndex({ name: 1 }, { unique: true });
      dbReady = true;
      console.log('✅ MongoDB connected');
    } catch (e) {
      console.warn('❌ MongoDB connection failed, falling back to file storage:', e.message);
    }
  } else {
    console.log('📁 MONGODB_URI not set, using file storage (data/ directory)');
  }
}

// ========= Save/Load API =========
app.post('/api/save', async (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) return res.json({ ok: false, error: 'missing name or data' });

  if (dbReady) {
    try {
      await db.collection('saves').updateOne(
        { name },
        { $set: { name, data, updatedAt: new Date() } },
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  } else {
    // File fallback
    const DATA_DIR = path.join(__dirname, 'data');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    const safeName = name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');
    try {
      fs.writeFileSync(path.join(DATA_DIR, `${safeName}.json`), JSON.stringify(data));
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  }
});

app.get('/api/load', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.json({ ok: false, error: 'missing name' });

  if (dbReady) {
    try {
      const doc = await db.collection('saves').findOne({ name });
      if (doc) {
        res.json({ ok: true, exists: true, data: doc.data });
      } else {
        res.json({ ok: true, exists: false });
      }
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  } else {
    // File fallback
    const DATA_DIR = path.join(__dirname, 'data');
    const safeName = name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeName}.json`);
    if (!fs.existsSync(filePath)) return res.json({ ok: false, exists: false });
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json({ ok: true, exists: true, data });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  }
});

// ========== Leaderboard API ==========
app.post('/api/leaderboard', async (req, res) => {
  const { name, wins, losses, level } = req.body;
  if (!name) return res.json({ ok: false });

  if (dbReady) {
    try {
      await db.collection('leaderboard').updateOne(
        { name },
        { $set: { name, wins: wins || 0, losses: losses || 0, level: level || 1, updatedAt: new Date() } },
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false });
    }
  } else {
    const DATA_DIR = path.join(__dirname, 'data');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    const lbPath = path.join(DATA_DIR, 'leaderboard.json');
    let lb = [];
    try { lb = JSON.parse(fs.readFileSync(lbPath, 'utf8')); } catch (e) { /* new file */ }
    const idx = lb.findIndex(e => e.name === name);
    const entry = { name, wins: wins || 0, losses: losses || 0, level: level || 1 };
    if (idx >= 0) lb[idx] = entry;
    else lb.push(entry);
    try { fs.writeFileSync(lbPath, JSON.stringify(lb)); } catch (e) { /* write fail */ }
    res.json({ ok: true });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  if (dbReady) {
    try {
      const docs = await db.collection('leaderboard')
        .find({})
        .sort({ wins: -1, level: -1 })
        .limit(10)
        .toArray();
      const list = docs.map(d => ({ name: d.name, wins: d.wins, losses: d.losses, level: d.level }));
      res.json({ ok: true, list });
    } catch (e) {
      res.json({ ok: false, list: [] });
    }
  } else {
    const DATA_DIR = path.join(__dirname, 'data');
    const lbPath = path.join(DATA_DIR, 'leaderboard.json');
    try {
      const lb = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
      lb.sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.level || 0) - (a.level || 0));
      res.json({ ok: true, list: lb.slice(0, 10) });
    } catch (e) {
      res.json({ ok: true, list: [] });
    }
  }
});

// Online players: { ws -> { name, playerData } }
const onlinePlayers = new Map();
// Active PvP battles: { ws -> opponentWs }
const activePvPBattles = new Map();

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
            // Store challenger's current data for battle start
            if (msg.playerData) info.pendingChallengeData = msg.playerData;
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
              // Start battle - exchange player data (use fresh data from messages)
              const defenderData = msg.playerData || onlinePlayers.get(ws).playerData;
              const challengerData = info.pendingChallengeData || info.playerData;

              // Track active PvP battle for disconnect handling
              activePvPBattles.set(challengerWs, ws);
              activePvPBattles.set(ws, challengerWs);

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

              delete info.pendingChallengeData;
            } else {
              ws.send(JSON.stringify({
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
              lootType: msg.lootType,
              lootValue: msg.lootValue,
              lootItems: msg.lootItems,
            }));
            return;
          }
        }
        break;
      }

      case 'pvp_battle_end': {
        // Clean up active PvP battle tracking
        const opponent = activePvPBattles.get(ws);
        if (opponent) {
          activePvPBattles.delete(opponent);
          activePvPBattles.delete(ws);
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
    // Notify PvP opponent if in active battle
    const opponent = activePvPBattles.get(ws);
    if (opponent) {
      opponent.send(JSON.stringify({
        type: 'pvp_opponent_disconnected',
        from: ws.playerName || '对手',
      }));
      activePvPBattles.delete(opponent);
      activePvPBattles.delete(ws);
    }
  });
});

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`🎮 Pixel RPG Server running at http://localhost:${PORT}`);
  });
});
