// ========= UI State =========
let currentPlayer = null;
let currentCombat = null;
let currentPvpCombat = null;
let currentBot = null;
let battleLogEntries = [];
let saveCallback = null;
let network = null;
let lastNetworkPlayers = [];


// ========= Initialize UI =========
function initUI(player, onSave) {
  currentPlayer = player;
  saveCallback = onSave;
  battleLogEntries = [];

  // Initialize bots
  generateBots();

  // Login
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('player-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });
  document.getElementById('player-name-input').addEventListener('input', () => {
    document.getElementById('login-error').classList.add('hidden');
  });

  // Hidden WASD easter egg on login screen
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (!['w', 'a', 's', 'd'].includes(key)) return;
    const input = document.getElementById('player-name-input');
    if (document.activeElement === input) return;
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen.classList.contains('hidden')) return;

    const box = document.querySelector('.login-box');
    const dirs = { w: [0, -20], s: [0, 20], a: [-20, 0], d: [20, 0] };
    const [dx, dy] = dirs[key];
    box.style.transform = `translate(${dx}px, ${dy}px)`;
    setTimeout(() => { box.style.transform = ''; }, 150);
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Battle overlay
  document.getElementById('battle-close-btn').addEventListener('click', closeBattleOverlay);
  document.getElementById('battle-flee-btn').addEventListener('click', fleeBattle);

  // Inventory: unequip
  document.querySelectorAll('.equip-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const slotType = slot.dataset.slot;
      if (currentPlayer[slotType]) {
        currentPlayer.unequip(slotType);
        saveAndRefresh();
      }
    });
  });

  // Global button click sound
  document.querySelector('#app').addEventListener('click', (e) => {
    const btn = e.target.closest('button, .monster-card, .equip-slot, .item-card');
    if (btn) soundClick();
  });

  // Player avatar → stats modal
  document.getElementById('player-avatar').addEventListener('click', showStatsModal);
  document.getElementById('stats-modal-close').addEventListener('click', () => {
    document.getElementById('stats-modal').classList.add('hidden');
  });
  document.getElementById('stats-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('stats-modal').classList.add('hidden');
    }
  });

  // Help button
  document.getElementById('help-btn').addEventListener('click', showHelpModal);
  document.getElementById('help-modal-close').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
  });
  document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('help-modal').classList.add('hidden');
    }
  });

  // Debug button
  document.getElementById('debug-btn').addEventListener('click', debugCheat);

  network = new Network();
  network.init(currentPlayer);
}

function startGame() {
  const nameInput = document.getElementById('player-name-input');
  const name = nameInput.value.trim();
  if (!name) return;

  // Check duplicate name against online players
  if (network && network.connected && lastNetworkPlayers.some(p => p.name === name)) {
    const errEl = document.getElementById('login-error');
    errEl.textContent = `⚠ "${name}" 已存在，请换一个名字`;
    errEl.classList.remove('hidden');
    return;
  }

  // Check for save
  const saved = localStorage.getItem('pixel_rpg_save');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.name === name) {
        currentPlayer = Player.deserialize(data);
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        refreshAll();
        if (network) network.login(currentPlayer);
        return;
      }
    } catch (e) { /* corrupted save, start fresh */ }
  }

  currentPlayer = new Player(name);
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  refreshAll();
  saveGame();
  if (network) network.login(currentPlayer);
  startBGM();
}

function saveGame() {
  if (currentPlayer && saveCallback) {
    saveCallback(currentPlayer);
  }
}

function saveAndRefresh() {
  saveGame();
  refreshAll();
}

// ========= Refresh All =========
function refreshAll() {
  updateStats();
  renderZones();
  renderMonsters();
  renderInventory();
  renderEquipped();
  renderShop();
  renderPvPStats();
}

function renderPvPStats() {
  document.getElementById('pvp-wins').textContent = currentPlayer.pvpWins || 0;
  document.getElementById('pvp-losses').textContent = currentPlayer.pvpLosses || 0;
}

// ========= Stats Modal =========
function showStatsModal() {
  const p = currentPlayer;
  const s = p.getStats();
  const modal = document.getElementById('stats-modal');
  document.getElementById('stats-modal-name').textContent = p.name;
  document.getElementById('stats-modal-level').textContent = `Lv.${s.level} 勇者`;

  const body = document.getElementById('stats-modal-body');
  const expPct = s.maxExp > 0 ? (s.exp / s.maxExp * 100).toFixed(1) : '0.0';
  const eqCount = [p.weapon, p.armor, p.accessory, p.helmet, p.boots].filter(Boolean).length;

  body.innerHTML = `
    <div class="stat-row">
      <span class="stat-label">等级</span>
      <span class="stat-value">Lv.${s.level}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">经验</span>
      <span class="stat-value">${s.exp} / ${s.maxExp} (${expPct}%)</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">生命</span>
      <span class="stat-value hp">${s.hp} / ${s.maxHp}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">攻击</span>
      <span class="stat-value atk">${s.atk}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">防御</span>
      <span class="stat-value def">${s.def}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">金币</span>
      <span class="stat-value gold">${s.gold}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">生命数</span>
      <span class="stat-value">${'❤'.repeat(p.lives)}${'🖤'.repeat(Math.max(0, p.maxLives - p.lives))}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">装备</span>
      <span class="stat-value">${eqCount}/5 件</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">PvP 战绩</span>
      <span class="stat-value">${p.pvpWins}胜 ${p.pvpLosses}负</span>
    </div>
  `;

  modal.classList.remove('hidden');
}

// ========= Help Modal =========
function showHelpModal() {
  const body = document.getElementById('help-modal-body');
  body.innerHTML = `\
<h2>基础属性</h2>
<ul>
  <li><b>生命 (HP)</b>：初始 80，每升一级 +10</li>
  <li><b>攻击 (ATK)</b>：初始 6，每升一级 +2</li>
  <li><b>防御 (DEF)</b>：初始 3，每升一级 +2</li>
  <li><b>初始生命数</b>：5 条（商店可花 10000G 购买 +1 条，最多 10 条）</li>
</ul>
<h2>经验与等级</h2>
<ul>
  <li>每级经验需求 = level × 50 × (1 + level × 0.1)</li>
  <li>升级时回满血，全属性提升</li>
</ul>
<h2>伤害公式</h2>
<ul>
  <li>基础伤害 = 攻击力 × 100 / (100 + 防御力)</li>
  <li>伤害浮动：±10%</li>
  <li>暴击率 = 等级 × 1%（最高 100%），暴击伤害 ×1.8</li>
  <li>怪物不会暴击</li>
</ul>
<h2>装备系统</h2>
<h3>5 个装备位</h3>
<table><tr><th>部位</th><th>主属性</th><th>副属性</th></tr>
<tr><td>武器</td><td>ATK</td><td>DEF (30%)</td></tr>
<tr><td>防具</td><td>DEF</td><td>HP (30%)</td></tr>
<tr><td>头盔</td><td>DEF</td><td>HP (40%)</td></tr>
<tr><td>饰品</td><td>ATK</td><td>HP (固定)</td></tr>
<tr><td>靴子</td><td>DEF</td><td>ATK (30%)</td></tr></table>
<h3>品质与倍率</h3>
<table><tr><th>品质</th><th>倍率</th><th>颜色</th></tr>
<tr><td>普通</td><td>1.0×</td><td>灰</td></tr>
<tr><td>优秀</td><td>1.5×</td><td>绿</td></tr>
<tr><td>稀有</td><td>2.0×</td><td>蓝</td></tr>
<tr><td>史诗</td><td>3.0×</td><td>紫</td></tr>
<tr><td>传说</td><td>5.0×</td><td>橙</td></tr>
<tr><td>红装</td><td>8.0×</td><td>红</td></tr></table>
<p>传说品质额外填充未满属性，红装固定全属性。</p>
<h3>装备回收</h3>
<ul>
  <li>背包中每件装备可单独回收，也可一键回收全部</li>
  <li>回收价格 = (5 + 等级 × 2) × 品质系数</li>
  <li>品质系数：普通=1, 优秀=3, 稀有=8, 史诗=20, 传说=50, 红装=80</li>
</ul>
<h2>区域与怪物</h2>
<h3>6 个区域（按顺序解锁）</h3>
<ol>
  <li>🌿 新手草原（Lv.1+）— 掉落普通</li>
  <li>🌲 幽暗森林（Lv.4+）— 掉落优秀</li>
  <li>🏜 灼热沙漠（Lv.8+）— 掉落稀有</li>
  <li>🏰 亡灵城堡（Lv.14+）— 掉落史诗</li>
  <li>🔥 深渊（Lv.20+）— 掉落传说</li>
  <li>👑 魔王之巅（Lv.30）— 最终 Boss</li>
</ol>
<h3>区域解锁规则</h3>
<ul>
  <li>每个区域 5 只怪物，固定掉落顺序：武器→防具→头盔→饰品→靴子</li>
  <li>收集 3 件当前区域的特色品质装备即可解锁下一区域</li>
  <li>平衡规则：穿 N 件本图装备可打赢第 N 只怪</li>
</ul>
<h3>最终 Boss — 魔王</h3>
<ul>
  <li>HP: 11000 / ATK: 6500 / DEF: 750</li>
  <li>需要 5 件红装才能击败</li>
  <li>击败后约 8% 概率掉落随机部位红装</li>
</ul>
<h2>商店</h2>
<ul>
  <li>出售 5 部位红装（每件 9000/6000/4500G），每件限购 1 次</li>
  <li>出售生命上限 +1（10000G），限购 5 次</li>
</ul>
<h2>PvP 系统</h2>
<ul>
  <li>WebSocket 实时联机，在线玩家列表显示</li>
  <li>可互相挑战，轮流攻击</li>
  <li>击败对手可选择放走（一半金币）或杀掉（全部金币+装备）</li>
  <li>逃跑扣 25% 金币</li>
</ul>
<h2>Bot 人机</h2>
<ul>
  <li>5 个人机 AI，等级 5/10/15/20/25</li>
  <li>击败后可选择放走或击杀</li>
  <li>击杀全部 5 人机解锁成就</li>
</ul>
<h2>其他</h2>
<ul>
  <li>点击左上角头像查看详细属性面板</li>
  <li>存档保存在浏览器 localStorage</li>
</ul>`;
  document.getElementById('help-modal').classList.remove('hidden');
}

// ========= Debug =========
function debugCheat() {
  currentPlayer.gold += 10000;
  currentPlayer.zonesUnlocked = 5;
  addBattleLog('⚡ 调试模式：+10000 金币 & 全部区域已解锁！');
  saveAndRefresh();
}
// ========= Stats Bar =========
function updateStats() {
  const s = currentPlayer.getStats();
  document.getElementById('stat-name').textContent = currentPlayer.name;
  document.getElementById('stat-level').textContent = `Lv.${s.level}`;
  document.getElementById('stat-hp').textContent = `HP: ${s.hp}/${s.maxHp}`;
  document.getElementById('stat-atk').textContent = `⚔ ATK: ${s.atk}`;
  document.getElementById('stat-def').textContent = `🛡 DEF: ${s.def}`;
  document.getElementById('stat-gold').textContent = `💰 ${s.gold}`;
  const expPct = s.maxExp > 0 ? (s.exp / s.maxExp * 100) : 0;
  document.getElementById('exp-bar').style.width = `${Math.min(100, expPct)}%`;
  document.getElementById('stat-exp-text').textContent = `${s.exp}/${s.maxExp}`;

  // Lives display
  const livesEl = document.getElementById('stat-lives');
  if (currentPlayer.lives <= 0) {
    livesEl.textContent = '💀';
    livesEl.className = 'dead';
  } else {
    livesEl.textContent = '❤'.repeat(currentPlayer.lives) + '🖤'.repeat(Math.max(0, currentPlayer.maxLives - currentPlayer.lives));
    livesEl.className = '';
  }
}

// ========= Zones & Monsters =========
function renderZones() {
  const container = document.getElementById('zone-selector');
  container.innerHTML = '';
  const rarityNames = ['普通', '优秀', '稀有', '史诗', '传说'];
  ZONES.forEach((zone, idx) => {
    const unlocked = idx < currentPlayer.zonesUnlocked || idx === 5;
    const btn = document.createElement('button');
    btn.className = `zone-btn ${unlocked ? 'unlocked' : 'locked'}`;

    if (unlocked) {
      if (idx < 5) {
        const count = currentPlayer.lootedCounts[rarityNames[idx]] || 0;
        btn.textContent = `${zone.name} (${count}/3)`;
      } else {
        btn.textContent = zone.name;
      }
      btn.addEventListener('click', () => selectZone(idx));
    } else {
      btn.textContent = `🔒 ${zone.name}`;
      const neededRarity = rarityNames[idx - 1] || '???';
      btn.title = idx === currentPlayer.zonesUnlocked
        ? `收集 ${neededRarity} 品质装备 3/3 解锁`
        : '先解锁前面的区域';
    }
    container.appendChild(btn);
  });
}

let selectedZoneIdx = 0;

function selectZone(idx) {
  selectedZoneIdx = idx;
  renderMonsters();
}

function renderMonsters() {
  const container = document.getElementById('monster-list');
  container.innerHTML = '';

  // Game over check
  if (currentPlayer.lives <= 0) {
    container.innerHTML = '<div class="empty-hint" style="color:#ef5350;font-size:10px;padding:30px">💀 游戏结束！你已经没有命了...</div>';
    return;
  }

  const zone = ZONES[selectedZoneIdx];
  if (!zone) return;

  zone.monsters.forEach((m, midx) => {
    const defeated = currentPlayer.defeatedMonsters.includes(m.name);
    const isBoss = selectedZoneIdx === 5;
    const card = document.createElement('div');
    card.className = `monster-card ${defeated ? 'defeated' : ''} ${isBoss ? 'boss' : ''}`;
    const slotIcons = { weapon: '⚔', armor: '🛡', accessory: '💍', helmet: '⛑', boots: '👢' };

    if (isBoss) {
      card.innerHTML = `
        <div class="monster-name">${defeated ? '✅ ' : '👑 '}${m.name}</div>
        <div class="monster-info">Lv.${m.level} | HP:${m.hp} ATK:${m.atk} DEF:${m.def}</div>
        <div class="monster-reward">✨${m.expReward}EXP 💰${m.goldReward}G</div>
      `;
    } else {
      card.innerHTML = `
        <div class="monster-name">${defeated ? '✅ ' : ''}${m.name}</div>
        <div class="monster-info">Lv.${m.level} | HP:${m.hp} ATK:${m.atk} DEF:${m.def}</div>
        <div class="monster-reward">✨${m.expReward}EXP 💰${m.goldReward}G</div>
        <div class="monster-drop">掉落: ${slotIcons[m.dropSlot] || '🎁'} ${TYPE_NAMES[m.dropSlot] || '随机'}</div>
      `;
    }

    card.addEventListener('click', () => startPvECombat(m));
    container.appendChild(card);
  });
}

// ========= PvE Combat =========
function startPvECombat(monsterData) {
  if (currentPlayer.hp <= 0 || currentPlayer.lives <= 0) {
    addBattleLog('💀 你已经没有命了！游戏结束...');
    return;
  }
  if (currentPvpCombat && !currentPvpCombat.finished) {
    addBattleLog('⚠ 你正在进行 PvP 战斗！');
    return;
  }

  currentCombat = new PvECombat(currentPlayer, monsterData, addBattleLog, onPvEEnd, selectedZoneIdx);
  openBattleOverlay(monsterData.name);
  updateBattleUI();
  runAutoCombat();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAutoCombat() {
  const btn = document.getElementById('battle-attack-btn');
  btn.disabled = true;
  btn.textContent = '⏩ 战斗中...';

  while (currentCombat && !currentCombat.finished) {
    // Player attacks
    const result = currentCombat.playerAttack();
    if (currentCombat.lastHit.critical) {
      soundCriticalHit();
    } else {
      soundPlayerAttack();
    }
    flashSprite('battle-p-sprite', currentCombat.lastHit.critical);
    updateBattleUI();
    updateCombatPanel();

    if (result) {
      showBattleResult(result);
      return;
    }

    await delay(350);

    if (!currentCombat || currentCombat.finished) break;

    // Monster attacks
    const mResult = currentCombat.monsterAttack();
    if (currentCombat.lastHit.critical) {
      soundCriticalHit();
    } else {
      soundMonsterAttack();
    }
    flashSprite('battle-e-sprite', currentCombat.lastHit.critical);
    updateBattleUI();
    updateCombatPanel();

    if (mResult) {
      showBattleResult(mResult);
      return;
    }

    await delay(350);
  }
}

function showBattleResult(result) {
  // Bot victories handled by mercy/kill UI; defeats show normally
  if (currentBot && result.won) return;

  const btn = document.getElementById('battle-attack-btn');
  btn.disabled = true;
  btn.textContent = '⚔ 攻击';
  // Hide flee button when battle ends
  document.getElementById('battle-flee-btn').classList.add('hidden');
  const resultDiv = document.getElementById('battle-result');
  resultDiv.classList.remove('hidden');
  if (result.won) {
    soundVictory();

    // Boss victory
    const isBoss = currentCombat && currentCombat.zoneIndex === 5;
    document.getElementById('battle-result-text').textContent =
      isBoss ? '👑 恭喜通关！魔王被击败了！' : '🎉 胜利！获得了 EXP 和金币！';

    // Show reward overlay in battle scene
    const reward = document.getElementById('reward-overlay');
    reward.classList.remove('hidden');

    // Set equipment name if looted
    const equipEl = document.getElementById('reward-equip');
    if (result.loot) {
      equipEl.textContent = `📦 ${result.loot.name}`;
      equipEl.style.color = result.loot.color;
    } else {
      equipEl.textContent = '📦 未掉落装备';
      equipEl.style.color = '#aaa';
    }

    document.getElementById('reward-exp').textContent =
      `✨ EXP +${result.exp || 0}`;
    document.getElementById('reward-gold').textContent =
      `💰 金币 +${result.gold || 0}`;
  } else {
    if (currentPlayer.lives <= 0) {
      soundGameOver();
      document.getElementById('battle-result-text').textContent =
        '💀 游戏结束！你已经没有命了...';
    } else {
      soundDefeat();
      document.getElementById('battle-result-text').textContent =
        `💀 败北...剩余 ${currentPlayer.lives}/${currentPlayer.maxLives} 条命`;
    }
  }
  saveAndRefresh();
}

function addBattleLog(msg) {
  battleLogEntries.push(msg);
  const logDiv = document.getElementById('combat-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
}

function openBattleOverlay(enemyName) {
  const overlay = document.getElementById('battle-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('battle-e-name').textContent = enemyName;
  document.getElementById('battle-result').classList.add('hidden');
  // Show flee button in PvE (auto-combat), hide attack
  document.getElementById('battle-actions').classList.remove('hidden');
  document.getElementById('battle-attack-btn').classList.add('hidden');
  document.getElementById('battle-flee-btn').classList.remove('hidden');

  // Set zone background
  document.getElementById('battle-scene').dataset.zone = selectedZoneIdx;
  // Hide reward overlay
  document.getElementById('reward-overlay').classList.add('hidden');

  // Set sprites
  const pSprite = document.getElementById('battle-p-sprite');
  const eSprite = document.getElementById('battle-e-sprite');
  pSprite.style.display = '';
  eSprite.style.display = '';
  pSprite.src = 'sprites/hero.png';
  pSprite.onerror = () => { pSprite.style.display = 'none'; };
  if (currentBot) {
    // Bot enemies use hero sprite too
    eSprite.src = 'sprites/hero.png';
  } else if (currentCombat && currentCombat.monster.sprite) {
    eSprite.src = `sprites/${currentCombat.monster.sprite}.png`;
  }
  eSprite.onerror = () => { eSprite.style.display = 'none'; };

  updateCombatPanel();
}

function updateCombatPanel() {
  if (!currentCombat) return;
  const s = currentCombat.stats;
  document.getElementById('combat-round').textContent = `⚔ 回合 ${s.round}`;
  document.getElementById('combat-total-dmg').textContent = `⚡ 伤害 ${s.playerTotalDmg}`;
  document.getElementById('combat-crits').textContent = `💥 暴击 ${s.playerCrits}`;

  const m = currentCombat.monster;
  document.getElementById('combat-p-info').textContent =
    `❤ ${currentPlayer.hp}/${currentPlayer.effectiveMaxHp}`;
  document.getElementById('combat-p-atk').textContent = `⚔ ${currentPlayer.atk}`;
  document.getElementById('combat-p-def').textContent = `🛡 ${currentPlayer.def}`;

  document.getElementById('combat-e-info').textContent =
    `❤ ${Math.max(0, m.hp)}/${m.maxHp}`;
  document.getElementById('combat-e-atk').textContent = `⚔ ${m.atk}`;
  document.getElementById('combat-e-def').textContent = `🛡 ${m.def}`;
}

// ========== Battle Effects ==========
function flashSprite(spriteId, critical) {
  const el = document.getElementById(spriteId);
  if (!el) return;
  el.className = 'battle-sprite'; // reset
  void el.offsetWidth;
  el.className = `battle-sprite ${critical ? 'sprite-flash-crit' : 'sprite-flash-attack'}`;
  setTimeout(() => {
    el.className = 'battle-sprite';
  }, critical ? 500 : 300);
}

function updateBattleUI() {
  if (!currentCombat) return;
  document.getElementById('battle-p-name').textContent =
    `${currentPlayer.name} Lv.${currentPlayer.level}`;
  const pHpPct = currentPlayer.hp / currentPlayer.effectiveMaxHp * 100;
  document.getElementById('battle-p-hp').style.width = `${Math.max(0, pHpPct)}%`;

  document.getElementById('battle-e-name').textContent =
    `${currentCombat.monster.name} Lv.${currentCombat.monster.level}`;
  const eHpPct = currentCombat.monster.hp / currentCombat.monster.maxHp * 100;
  document.getElementById('battle-e-hp').style.width = `${Math.max(0, eHpPct)}%`;
}

function onPvEEnd(result) {
  if (result.won) {
    // Track defeated monsters (for visual checkmarks)
    if (currentCombat) {
      const monsterName = currentCombat.monster.name;
      if (!currentPlayer.defeatedMonsters.includes(monsterName)) {
        currentPlayer.defeatedMonsters.push(monsterName);
      }
    }

    // Track looted equipment for zone unlock
    if (result.loot) {
      const rarity = result.loot.rarity;
      currentPlayer.lootedCounts[rarity] = (currentPlayer.lootedCounts[rarity] || 0) + 1;
      addBattleLog(`📦 ${rarity}装备收集: ${currentPlayer.lootedCounts[rarity]}/3`);

      // Check if current zone's signature rarity threshold is met
      const rarityNames = ['普通', '优秀', '稀有', '史诗', '传说'];
      const neededRarity = rarityNames[selectedZoneIdx];
      if (rarity === neededRarity && currentPlayer.lootedCounts[rarity] >= 3) {
        const unlocked = currentPlayer.checkZoneUnlock(selectedZoneIdx);
        if (unlocked) {
          addBattleLog(`🎉 解锁新区域: ${ZONES[selectedZoneIdx + 1]?.name || '无'}`);
        }
      }
    }

    // Heal after victory
    currentPlayer.hp = currentPlayer.effectiveMaxHp;
  } else {
    // Defeat: lose a life
    currentPlayer.lives--;
    if (currentPlayer.lives > 0) {
      // Respawn with full HP
      currentPlayer.hp = currentPlayer.effectiveMaxHp;
      addBattleLog(`💔 损失一条命！剩余 ${currentPlayer.lives}/${currentPlayer.maxLives}`);
    } else {
      // Game over
      currentPlayer.hp = 0;
      addBattleLog('💀 游戏结束！你已经没有命了...');
    }
  }

  saveGame();
  refreshAll();
}

function fleeBattle() {
  if (!currentCombat || currentCombat.finished) return;
  soundFlee();

  // End combat
  currentCombat.finished = true;

  // Lose some gold as penalty
  const lostGold = Math.floor(currentPlayer.gold * 0.05);
  currentPlayer.gold = Math.max(0, currentPlayer.gold - lostGold);

  addBattleLog(`🏃 逃跑了！损失了 ${lostGold} 金币`);

  // Heal to full
  currentPlayer.hp = currentPlayer.effectiveMaxHp;
  saveAndRefresh();
  closeBattleOverlay();
}

function closeBattleOverlay() {
  document.getElementById('battle-overlay').classList.add('hidden');
  // Restore close button visibility (bot combat hides it)
  document.getElementById('battle-close-btn').style.display = '';
  // Hide mercy/kill buttons
  const mercyDiv = document.getElementById('mercy-kill-div');
  if (mercyDiv) mercyDiv.style.display = 'none';
  const pvpMercyDiv = document.getElementById('pvp-mercy-kill-div');
  if (pvpMercyDiv) pvpMercyDiv.style.display = 'none';
  // Heal to full after battle (unless game over)
  if (currentPlayer.lives > 0) {
    currentPlayer.hp = currentPlayer.effectiveMaxHp;
  }
  // Notify server PvP battle ended (so disconnect tracking is cleaned up)
  if (currentPvpCombat && network) {
    network.sendPvPBattleEnd();
  }
  currentCombat = null;
  currentPvpCombat = null;
  currentBot = null;
  saveAndRefresh();
}

// ========= Inventory =========

/** Check if any item has legendary or red rarity */
function hasHighRarityItems(items) {
  return items.some(item => item.rarity === '传说' || item.rarity === '红装');
}

const SELL_CONFIRM_KEY = 'pixel_rpg_sell_confirm_skip';

/** Show a confirmation dialog when selling high-rarity items */
function showSellConfirm(items, onConfirm) {
  if (localStorage.getItem(SELL_CONFIRM_KEY) === '1') {
    onConfirm();
    return;
  }
  if (!hasHighRarityItems(items)) {
    onConfirm();
    return;
  }

  const overlay = document.getElementById('sell-confirm-overlay');
  const yesBtn = document.getElementById('sell-confirm-yes');
  const noBtn = document.getElementById('sell-confirm-no');
  const checkbox = document.getElementById('sell-confirm-checkbox');

  overlay.classList.remove('hidden');

  function cleanup() {
    overlay.classList.add('hidden');
    yesBtn.onclick = null;
    noBtn.onclick = null;
  }

  yesBtn.onclick = () => {
    if (checkbox.checked) localStorage.setItem(SELL_CONFIRM_KEY, '1');
    cleanup();
    onConfirm();
  };

  noBtn.onclick = () => {
    if (checkbox.checked) localStorage.setItem(SELL_CONFIRM_KEY, '1');
    cleanup();
  };
}

function recycleAll() {
  const inv = currentPlayer.inventory;
  if (inv.length === 0) return;

  showSellConfirm(inv, () => {
    let total = 0;
    const names = inv.map(item => {
      const price = calcSellPrice(item);
      total += price;
      return item.name;
    });
    currentPlayer.gold += total;
    currentPlayer.inventory = [];
    addBattleLog(`♻ 一键回收了 ${names.length} 件装备，获得 💰${total}G`);
    saveAndRefresh();
  });
}

function renderInventory() {
  const container = document.getElementById('inventory-list');
  container.innerHTML = '';
  if (currentPlayer.inventory.length === 0) {
    container.innerHTML = '<div class="empty-hint">背包空空如也，去打怪爆装备吧！</div>';
    return;
  }

  // Recycle all button
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:6px';
  const recycleBtn = document.createElement('button');
  recycleBtn.className = 'pixel-btn small';
  recycleBtn.style.cssText = 'border-color:#ffd54f;color:#ffd54f';
  recycleBtn.textContent = `♻ 一键回收 (${currentPlayer.inventory.length}件)`;
  recycleBtn.addEventListener('click', recycleAll);
  topBar.appendChild(recycleBtn);
  container.appendChild(topBar);

  currentPlayer.inventory.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.borderColor = item.color;
    const sellPrice = calcSellPrice(item);
    card.innerHTML = `
      <div class="item-name" style="color:${item.color}">${item.name}</div>
      <div class="item-type">${TYPE_NAMES[item.type]} Lv.${item.level}</div>
      <div class="item-stats">${getEquipmentStatsText(item)}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="pixel-btn small equip-btn" style="border-color:${item.color}">装备</button>
        <button class="pixel-btn small recycle-btn" style="border-color:#ffd54f;color:#ffd54f">回收💰${sellPrice}</button>
      </div>
    `;
    card.querySelector('.equip-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      currentPlayer.equip(item);
      saveAndRefresh();
    });
    card.querySelector('.recycle-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      recycleItem(item);
    });
    // Click to equip
    card.addEventListener('click', () => {
      currentPlayer.equip(item);
      saveAndRefresh();
    });
    container.appendChild(card);
  });
}

function calcSellPrice(item) {
  const rarityMultipliers = { '普通': 1, '优秀': 3, '稀有': 8, '史诗': 20, '传说': 50, '红装': 80 };
  const mult = rarityMultipliers[item.rarity] || 1;
  return Math.max(1, Math.floor((5 + item.level * 2) * mult));
}

function recycleItem(item) {
  showSellConfirm([item], () => {
    const price = calcSellPrice(item);
    const idx = currentPlayer.inventory.indexOf(item);
    if (idx === -1) return;
    currentPlayer.inventory.splice(idx, 1);
    currentPlayer.gold += price;
    addBattleLog(`♻ 回收了 ${item.name}，获得 💰${price}G`);
    saveAndRefresh();
  });
}

function renderEquipped() {
  const slots = ['weapon', 'armor', 'accessory', 'helmet', 'boots'];
  slots.forEach(slot => {
    const el = document.getElementById(`equipped-${slot}`);
    const item = currentPlayer[slot];
    if (item) {
      el.innerHTML = `
        <div style="color:${item.color}">${item.name}</div>
        <div class="item-stats">${getEquipmentStatsText(item)}</div>
        <div class="click-hint">点击卸下</div>
      `;
      el.style.borderColor = item.color;
    } else {
      el.innerHTML = `${TYPE_NAMES[slot]} - 空<div class="click-hint"></div>`;
      el.style.borderColor = '#555';
    }
  });
}

// ========= Shop =========
function renderShop() {
  const container = document.getElementById('shop-list');
  container.innerHTML = '';

  const types = ['weapon', 'armor', 'accessory', 'helmet', 'boots'];
  const typeNames = { weapon: '武器', armor: '防具', accessory: '饰品', helmet: '头盔', boots: '靴子' };

  // Init shop tracking
  if (!currentPlayer.shopBought) currentPlayer.shopBought = [];

  types.forEach(type => {
    const item = createRedEquipment(30, type);
    const price = getEquipmentPrice(item);
    const bought = currentPlayer.shopBought.includes(type);

    const card = document.createElement('div');
    card.className = 'shop-card';
    if (bought) {
      card.innerHTML = `
        <div class="item-name" style="color:#555">${item.name}</div>
        <div class="item-type">${typeNames[type]} Lv.${item.level}</div>
        <div class="item-stats" style="color:#555">${getEquipmentStatsText(item)}</div>
        <span style="color:#888;font-size:7px">已售罄</span>
        <button class="pixel-btn small" style="border-color:#555;color:#555" disabled>已购买</button>
      `;
    } else {
      card.innerHTML = `
        <div class="item-name" style="color:#ff1744">${item.name}</div>
        <div class="item-type">${typeNames[type]} Lv.${item.level}</div>
        <div class="item-stats">${getEquipmentStatsText(item)}</div>
        <span class="shop-price">💰 ${price}G</span>
        <button class="pixel-btn small" style="border-color:#ff1744">购买</button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        if (currentPlayer.gold < price) {
          const goldEl = document.getElementById('stat-gold');
          goldEl.classList.remove('gold-flash');
          void goldEl.offsetWidth;
          goldEl.classList.add('gold-flash');
          addBattleLog(`💰 金币不够！还需要 ${price - currentPlayer.gold}G`);
          return;
        }
        currentPlayer.gold -= price;
        currentPlayer.inventory.push(item);
        currentPlayer.shopBought.push(type);
        addBattleLog(`🛒 购买了 ${item.name}（${price}G）`);
        saveAndRefresh();
      });
    }

    container.appendChild(card);
  });

  // Life upgrade card (buy 1 life at a time, max 5 purchases)
  const lifeBought = currentPlayer.shopBought.filter(s => s.startsWith('life_')).length;
  const canBuy = lifeBought < 5 && currentPlayer.maxLives < 10;
  const lifeCard = document.createElement('div');
  lifeCard.className = 'shop-card';
  if (!canBuy) {
    lifeCard.innerHTML = `
      <div class="item-name" style="color:#555">❤ 生命上限提升</div>
      <div class="item-type">${currentPlayer.maxLives} / 10 条命</div>
      <span style="color:#888;font-size:7px">已达上限</span>
      <button class="pixel-btn small" style="border-color:#555;color:#555" disabled>已满</button>
    `;
  } else {
    lifeCard.innerHTML = `
      <div class="item-name" style="color:#4caf50">❤ 生命 +1</div>
      <div class="item-type">剩余 ${5 - lifeBought} 次</div>
      <span class="shop-price">💰 10000G</span>
      <button class="pixel-btn small" style="border-color:#4caf50;color:#4caf50">购买</button>
    `;
    lifeCard.querySelector('button').addEventListener('click', () => {
      if (currentPlayer.gold < 10000) {
        const goldEl = document.getElementById('stat-gold');
        goldEl.classList.remove('gold-flash');
        void goldEl.offsetWidth;
        goldEl.classList.add('gold-flash');
        addBattleLog(`💰 金币不够！还需要 ${10000 - currentPlayer.gold}G`);
        return;
      }
      currentPlayer.gold -= 10000;
      currentPlayer.maxLives++;
      currentPlayer.lives++;
      currentPlayer.shopBought.push('life_' + lifeBought);
      addBattleLog(`🛒 生命上限 +1！当前 ${currentPlayer.maxLives}/10`);
      saveAndRefresh();
    });
  }
  container.appendChild(lifeCard);
}

// ========= Tabs =========
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById('zone-selector').style.display = tab === 'combat' ? '' : 'none';
}

let botAchievementShown = false;

function reRenderPvPList() {
  renderOnlinePlayers(lastNetworkPlayers);
}

function checkBotAchievement() {
  if (botAchievementShown) return;
  if (areAllBotsDead()) {
    botAchievementShown = true;
    addBattleLog('🏆 成就解锁：【口人魔】—— 你杀光了所有人机！');
    addPvPLog('🏆 成就解锁：【口人魔】—— 你杀光了所有人机！');
  }
}

// ========= Bot Combat =========
function startBotCombat(bot) {
  if (currentPlayer.hp <= 0 || currentPlayer.lives <= 0) {
    addBattleLog('💀 你已经没有命了！');
    return;
  }

  currentBot = bot;
  const monsterData = {
    name: bot.fullName,
    level: bot.level,
    hp: bot.maxHp,
    maxHp: bot.maxHp,
    atk: bot.atk,
    def: bot.def,
    dropSlot: null,
    sprite: null,
    expReward: 0,
    goldReward: 0,
  };

  currentCombat = new PvECombat(currentPlayer, monsterData, addBattleLog, onBotEnd, -1);
  openBattleOverlay(bot.fullName);
  updateBattleUI();
  runAutoCombat();
}

function onBotEnd(result) {
  if (result.won) {
    addBattleLog(`🤖 ${currentBot.name} 跪地求饶！`);
    currentPlayer.hp = currentPlayer.effectiveMaxHp;
    showMercyKillChoice();
  } else {
    // Normal defeat
    currentPlayer.lives--;
    if (currentPlayer.lives > 0) {
      currentPlayer.hp = currentPlayer.effectiveMaxHp;
      addBattleLog(`💔 被 ${currentBot.name} 击败了！剩余 ${currentPlayer.lives}/${currentPlayer.maxLives} 条命`);
    } else {
      currentPlayer.hp = 0;
      addBattleLog('💀 游戏结束！');
    }
  }
}

function showMercyKillChoice() {
  document.getElementById('battle-flee-btn').classList.add('hidden');
  const resultDiv = document.getElementById('battle-result');
  const textEl = document.getElementById('battle-result-text');
  resultDiv.classList.remove('hidden');

  const halfGold = Math.floor(currentBot.gold / 2);
  textEl.innerHTML = `🤖 ${currentBot.name}：<br>"饶命！我的金币和装备都给你！"`;

  // Replace close button with mercy/kill buttons
  const closeBtn = document.getElementById('battle-close-btn');
  closeBtn.style.display = 'none';

  let mercyDiv = document.getElementById('mercy-kill-div');
  if (!mercyDiv) {
    mercyDiv = document.createElement('div');
    mercyDiv.id = 'mercy-kill-div';
    mercyDiv.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:10px';
    mercyDiv.innerHTML = `
      <button id="mercy-btn" class="pixel-btn" style="border-color:#4caf50;color:#4caf50">😇 放了他 (+${halfGold}G)</button>
      <button id="kill-btn" class="pixel-btn" style="border-color:#ff1744;color:#ff1744">💀 杀掉他 (全部)</button>
    `;
    resultDiv.appendChild(mercyDiv);
  } else {
    mercyDiv.style.display = 'flex';
    document.getElementById('mercy-btn').textContent = `😇 放了他 (+${halfGold}G)`;
  }

  document.getElementById('mercy-btn').onclick = () => {
    const gained = halfGold;
    currentPlayer.gold += gained;
    currentBot.gold -= gained;
    addBattleLog(`💰 放过了 ${currentBot.name}，获得了 ${gained} 金币`);
    if (currentBot.gold < 1) {
      currentBot.alive = false;
      addBattleLog(`🚶 ${currentBot.name} 身无分文，离开了...`);
      checkBotAchievement();
      reRenderPvPList();
    }
    currentBot = null;
    document.getElementById('mercy-kill-div').style.display = 'none';
    closeBtn.style.display = '';
    resultDiv.classList.add('hidden');
    saveAndRefresh();
    closeBattleOverlay();
  };

  document.getElementById('kill-btn').onclick = () => {
    // Get all gold + equipment
    const goldGained = currentBot.gold;
    currentPlayer.gold += goldGained;
    const items = [];
    if (currentBot.weapon) items.push(currentBot.weapon);
    if (currentBot.armor) items.push(currentBot.armor);
    if (currentBot.accessory) items.push(currentBot.accessory);
    currentBot.inventory.forEach(item => items.push(item));
    items.forEach(item => currentPlayer.inventory.push(item));
    currentBot.alive = false;

    addBattleLog(`💀 干掉了 ${currentBot.name}，抢了 ${goldGained}G 和 ${items.length} 件装备！`);
    checkBotAchievement();
    reRenderPvPList();
    currentBot = null;
    document.getElementById('mercy-kill-div').style.display = 'none';
    closeBtn.style.display = '';
    resultDiv.classList.add('hidden');
    saveAndRefresh();
    closeBattleOverlay();
  };
}

// ========= PvP UI =========
function renderOnlinePlayers(players) {
  const container = document.getElementById('player-list');
  container.innerHTML = '';

  // Real online players
  if (players && players.length > 0) {
    players.forEach(p => {
      if (p.name === currentPlayer.name) return;
      const card = document.createElement('div');
      card.className = 'player-card';
      card.innerHTML = `
        <span>${p.name} <span class="monster-info">Lv.${p.level}</span></span>
        <button class="pixel-btn small challenge-btn">⚔ 挑战</button>
      `;
      card.querySelector('.challenge-btn').addEventListener('click', () => {
        if (network) network.challenge(p.name);
      });
      container.appendChild(card);
    });
  }

  // Bot players
  const aliveBots = getAliveBots();
  aliveBots.forEach(bot => {
    const card = document.createElement('div');
    card.className = 'player-card';
    const style = bot.alive ? '' : 'opacity:0.4;text-decoration:line-through';
    card.style.cssText = style;
    card.innerHTML = `
      <span>🤖 ${bot.name} <span class="monster-info">Lv.${bot.level}</span>
        <span style="font-size:6px;color:#8b4513;margin-left:4px">[人机]</span>
      </span>
      <button class="pixel-btn small challenge-btn" style="border-color:#8b4513">⚔ 挑战</button>
    `;
    card.querySelector('.challenge-btn').addEventListener('click', () => {
      startBotCombat(bot);
    });
    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.innerHTML = '<div class="empty-hint">没有其他玩家或人机</div>';
  }
}

function addPvPLog(msg) {
  const logDiv = document.getElementById('pvp-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
}

let challengeTimer = null;

function showPvPChallenge(from) {
  // Clear any existing challenge
  if (challengeTimer) {
    clearInterval(challengeTimer);
    challengeTimer = null;
  }

  const overlay = document.getElementById('challenge-overlay');
  const msgEl = document.getElementById('challenge-msg');
  const countEl = document.getElementById('challenge-countdown');
  const acceptBtn = document.getElementById('challenge-accept-btn');
  const declineBtn = document.getElementById('challenge-decline-btn');

  msgEl.textContent = `${from}\n向你发起了 PvP 挑战！`;
  countEl.textContent = '10';
  countEl.classList.remove('urgent');
  overlay.classList.remove('hidden');

  let remaining = 10;

  function cleanup() {
    if (challengeTimer) {
      clearInterval(challengeTimer);
      challengeTimer = null;
    }
    overlay.classList.add('hidden');
  }

  acceptBtn.onclick = () => {
    cleanup();
    if (network) network.acceptChallenge(from);
  };

  declineBtn.onclick = () => {
    cleanup();
    if (network) network.declineChallenge(from);
  };

  challengeTimer = setInterval(() => {
    remaining--;
    countEl.textContent = remaining;
    if (remaining <= 3) {
      countEl.classList.add('urgent');
    }
    if (remaining <= 0) {
      cleanup();
      addPvPLog(`⏰ 挑战超时，已自动拒绝 ${from} 的挑战`);
    }
  }, 1000);
}

function openPvPOverlay(opponentData, isMyTurn) {
  // Heal both players to full for fair PvP
  currentPlayer.hp = currentPlayer.effectiveMaxHp;
  const oppMaxHp = opponentData.effectiveMaxHp || opponentData.maxHp || opponentData.hp;
  opponentData.hp = oppMaxHp;
  opponentData.maxHp = oppMaxHp;

  currentPvpCombat = new PvPCombat(currentPlayer, opponentData, addPvPLog);
  currentPvpCombat.myTurn = isMyTurn;

  // Clear battle log for PvP
  battleLogEntries = [];
  document.getElementById('combat-log').innerHTML = '';

  const overlay = document.getElementById('battle-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('battle-e-name').textContent = opponentData.name;
  document.getElementById('battle-result').classList.add('hidden');
  document.getElementById('reward-overlay').classList.add('hidden');
  document.getElementById('battle-actions').classList.remove('hidden');
  document.getElementById('battle-attack-btn').classList.remove('hidden');
  document.getElementById('battle-attack-btn').textContent = '⚔ 攻击';
  document.getElementById('battle-attack-btn').disabled = !isMyTurn;
  document.getElementById('battle-attack-btn').onclick = pvpBattleAttack;
  document.getElementById('battle-flee-btn').classList.remove('hidden');
  document.getElementById('battle-flee-btn').onclick = pvpFleeBattle;

  // Set PvP zone background to a neutral one
  document.getElementById('battle-scene').dataset.zone = 0;

  const pSprite = document.getElementById('battle-p-sprite');
  const eSprite = document.getElementById('battle-e-sprite');
  pSprite.src = 'sprites/hero.png';
  pSprite.onerror = () => { pSprite.style.display = 'none'; };
  eSprite.src = 'sprites/hero.png';
  eSprite.onerror = () => { eSprite.style.display = 'none'; };

  updatePvPBattleUI();
  addBattleLog(`⚔ PvP 对战开始！对手: ${opponentData.name} Lv.${opponentData.level}`);
  addPvPLog(`⚔ PvP 对战开始！对手: ${opponentData.name} Lv.${opponentData.level}`);
  if (isMyTurn) {
    addBattleLog('⏳ 自动攻击中...');
    addPvPLog('⏳ 自动攻击中...');
  } else {
    addBattleLog('⏳ 等待对手攻击...');
    addPvPLog('⏳ 等待对手攻击...');
  }
}

function updatePvPBattleUI() {
  if (!currentPvpCombat) return;
  document.getElementById('battle-p-name').textContent =
    `${currentPlayer.name} Lv.${currentPlayer.level}`;
  const pHpPct = currentPlayer.hp / currentPlayer.effectiveMaxHp * 100;
  document.getElementById('battle-p-hp').style.width = `${Math.max(0, pHpPct)}%`;

  document.getElementById('battle-e-name').textContent =
    `${currentPvpCombat.opponent.name} Lv.${currentPvpCombat.opponent.level}`;
  const eHpPct = currentPvpCombat.opponent.hp / currentPvpCombat.opponent.maxHp * 100;
  document.getElementById('battle-e-hp').style.width = `${Math.max(0, eHpPct)}%`;
}

function autoPvPAttack() {
  if (!currentPvpCombat || currentPvpCombat.finished || !currentPvpCombat.myTurn) return;
  document.getElementById('battle-attack-btn').disabled = true;
  setTimeout(() => {
    pvpBattleAttack();
  }, 600);
}

function pvpBattleAttack() {
  if (!currentPvpCombat || currentPvpCombat.finished) return;

  const result = currentPvpCombat.myAttack();
  updatePvPBattleUI();

  if (result) {
    // Flash effect on opponent sprite
    flashSprite('battle-e-sprite', result.critical);
    if (result.critical) {
      soundCriticalHit();
    } else {
      soundPlayerAttack();
    }
    // Show attack result in battle log
    const critText = result.critical ? ' 💥暴击！' : '';
    addBattleLog(`你对 ${currentPvpCombat.opponent.name} 造成了 ${result.damage} 点伤害${critText}`);

    // Send attack to opponent
    network.sendPvPAttack(currentPvpCombat.opponent.name, result.damage, result.critical);

    if (result.won) {
      currentPlayer.pvpWins++;
      document.getElementById('battle-attack-btn').disabled = true;
      document.getElementById('battle-close-btn').style.display = 'none';
      document.getElementById('battle-flee-btn').classList.add('hidden');
      const resultDiv = document.getElementById('battle-result');
      resultDiv.classList.remove('hidden');

      const opp = currentPvpCombat.opponentData;
      const halfGold = Math.floor((opp.gold || 0) / 2);

      document.getElementById('battle-result-text').textContent =
        `🏆 你击败了 ${opp.name}！怎么处置？`;

      let mercyDiv = document.getElementById('pvp-mercy-kill-div');
      if (!mercyDiv) {
        mercyDiv = document.createElement('div');
        mercyDiv.id = 'pvp-mercy-kill-div';
        mercyDiv.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:10px';
        resultDiv.appendChild(mercyDiv);
      } else {
        mercyDiv.style.display = 'flex';
      }
      mercyDiv.innerHTML = `
        <button id="pvp-mercy-btn" class="pixel-btn" style="border-color:#4caf50;color:#4caf50">😇 放了他 (+${halfGold}G)</button>
        <button id="pvp-kill-btn" class="pixel-btn" style="border-color:#ff1744;color:#ff1744">💀 杀掉他 (全部)</button>
      `;

      document.getElementById('pvp-mercy-btn').onclick = () => {
        currentPlayer.gold += halfGold;
        network.sendPvPResult(opp.name, currentPlayer.name, 'mercy', halfGold);
        addBattleLog(`💰 放过了 ${opp.name}，获得了 ${halfGold} 金币`);
        finishPvP();
      };

      document.getElementById('pvp-kill-btn').onclick = () => {
        const goldGained = opp.gold || 0;
        let itemCount = 0;
        currentPlayer.gold += goldGained;
        [opp.weapon, opp.armor, opp.accessory, opp.helmet, opp.boots].forEach(item => {
          if (item) { currentPlayer.inventory.push(item); itemCount++; }
        });
        (opp.inventory || []).forEach(item => { currentPlayer.inventory.push(item); itemCount++; });
        network.sendPvPResult(opp.name, currentPlayer.name, 'kill', goldGained);
        addBattleLog(`💀 干掉了 ${opp.name}，抢了 ${goldGained}G 和 ${itemCount} 件装备！`);
        finishPvP();
      };

      saveGame();
      refreshAll();
      return;
    }

    // Wait for opponent
    addBattleLog('⏳ 等待对手攻击...');
    document.getElementById('battle-attack-btn').disabled = true;
  }
}

function pvpFleeBattle() {
  if (!currentPvpCombat || currentPvpCombat.finished) return;
  currentPvpCombat.finished = true;
  const lostGold = Math.floor(currentPlayer.gold * 0.25);
  currentPlayer.gold = Math.max(0, currentPlayer.gold - lostGold);
  addBattleLog(`🏃 从 PvP 逃跑了！损失了 ${lostGold} 金币（25%）`);
  addPvPLog(`🏃 你从 PvP 逃跑了！损失了 ${lostGold} 金币`);
  network.sendPvPResult(currentPvpCombat.opponent.name, currentPlayer.name, 'flee', lostGold);
  finishPvP();
}

function finishPvP() {
  document.getElementById('pvp-mercy-kill-div').style.display = 'none';
  document.getElementById('battle-close-btn').style.display = '';
  document.getElementById('battle-result').classList.add('hidden');
  document.getElementById('battle-overlay').classList.add('hidden');
  if (currentPvpCombat && network) {
    network.sendPvPBattleEnd();
  }
  currentPvpCombat = null;
  saveGame();
  refreshAll();
}
