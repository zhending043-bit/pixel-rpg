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

  network = new Network();
  network.init(currentPlayer);
}

function startGame() {
  const nameInput = document.getElementById('player-name-input');
  const name = nameInput.value.trim();
  if (!name) return;

  // Check for save
  const saved = localStorage.getItem('pixel_rpg_save');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.name === name) {
        currentPlayer = Player.deserialize(data);
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        refreshAll();
        if (network) network.login(currentPlayer);
        return;
      }
    } catch (e) { /* corrupted save, start fresh */ }
  }

  currentPlayer = new Player(name);
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
    livesEl.textContent = '❤'.repeat(currentPlayer.lives) + '🖤'.repeat(3 - currentPlayer.lives);
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
    const slotIcons = { weapon: '⚔', armor: '🛡', accessory: '💍' };

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
        `💀 败北...剩余 ${currentPlayer.lives}/3 条命`;
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
      addBattleLog(`💔 损失一条命！剩余 ${currentPlayer.lives}/3`);
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
  // Heal to full after battle (unless game over)
  if (currentPlayer.lives > 0) {
    currentPlayer.hp = currentPlayer.effectiveMaxHp;
  }
  currentCombat = null;
  currentPvpCombat = null;
  currentBot = null;
  saveAndRefresh();
}

// ========= Inventory =========
function renderInventory() {
  const container = document.getElementById('inventory-list');
  container.innerHTML = '';
  if (currentPlayer.inventory.length === 0) {
    container.innerHTML = '<div class="empty-hint">背包空空如也，去打怪爆装备吧！</div>';
    return;
  }

  currentPlayer.inventory.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.borderColor = item.color;
    card.innerHTML = `
      <div class="item-name" style="color:${item.color}">${item.name}</div>
      <div class="item-type">${TYPE_NAMES[item.type]} Lv.${item.level}</div>
      <div class="item-stats">${getEquipmentStatsText(item)}</div>
      <button class="pixel-btn small equip-btn" style="border-color:${item.color}">装备</button>
    `;
    card.querySelector('.equip-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      currentPlayer.equip(item);
      saveAndRefresh();
    });
    // Click to equip
    card.addEventListener('click', () => {
      currentPlayer.equip(item);
      saveAndRefresh();
    });
    container.appendChild(card);
  });
}

function renderEquipped() {
  const slots = ['weapon', 'armor', 'accessory'];
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

  const types = ['weapon', 'armor', 'accessory'];
  const typeNames = { weapon: '武器', armor: '防具', accessory: '饰品' };

  types.forEach(type => {
    const item = createRedEquipment(30, type);
    const price = getEquipmentPrice(item);

    const card = document.createElement('div');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="item-name" style="color:#ff1744">${item.name}</div>
      <div class="item-type">${typeNames[type]} Lv.${item.level}</div>
      <div class="item-stats">${getEquipmentStatsText(item)}</div>
      <span class="shop-price">💰 ${price}G</span>
      <button class="pixel-btn small" style="border-color:#ff1744">购买</button>
    `;

    card.querySelector('button').addEventListener('click', () => {
      if (currentPlayer.gold < price) {
        addBattleLog(`💰 金币不够！需要 ${price}G`);
        return;
      }
      currentPlayer.gold -= price;
      currentPlayer.inventory.push(item);
      addBattleLog(`🛒 购买了 ${item.name}（${price}G）`);
      saveAndRefresh();
    });

    container.appendChild(card);
  });
}

// ========= Tabs =========
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
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
      addBattleLog(`💔 被 ${currentBot.name} 击败了！剩余 ${currentPlayer.lives}/3 条命`);
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

function showPvPChallenge(from) {
  if (confirm(`${from} 向你发起了 PvP 挑战！接受吗？`)) {
    if (network) network.acceptChallenge(from);
  } else {
    if (network) network.declineChallenge(from);
  }
}

function openPvPOverlay(opponentData, isMyTurn) {
  currentPvpCombat = new PvPCombat(currentPlayer, opponentData, addPvPLog);
  currentPvpCombat.myTurn = isMyTurn;

  const overlay = document.getElementById('battle-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('battle-e-name').textContent = opponentData.name;
  document.getElementById('battle-result').classList.add('hidden');
  document.getElementById('battle-actions').classList.remove('hidden');
  document.getElementById('battle-attack-btn').classList.remove('hidden');
  document.getElementById('battle-flee-btn').classList.add('hidden');
  document.getElementById('reward-overlay').classList.add('hidden');
  document.getElementById('battle-attack-btn').disabled = !isMyTurn;
  document.getElementById('battle-attack-btn').onclick = pvpBattleAttack;

  const pSprite = document.getElementById('battle-p-sprite');
  const eSprite = document.getElementById('battle-e-sprite');
  pSprite.src = 'sprites/hero.png';
  pSprite.onerror = () => { pSprite.style.display = 'none'; };
  eSprite.src = 'sprites/hero.png';
  eSprite.onerror = () => { eSprite.style.display = 'none'; };

  updatePvPBattleUI();
  addPvPLog(`⚔ PvP 对战开始！对手: ${opponentData.name} Lv.${opponentData.level}`);
  if (isMyTurn) {
    addPvPLog('⏳ 你的回合，请攻击！');
  } else {
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

function pvpBattleAttack() {
  if (!currentPvpCombat || currentPvpCombat.finished) return;

  const result = currentPvpCombat.myAttack();
  updatePvPBattleUI();

  if (result) {
    // Send attack to opponent
    network.sendPvPAttack(currentPvpCombat.opponent.name, result.damage, result.critical);

    if (result.won) {
      document.getElementById('battle-attack-btn').disabled = true;
      network.sendPvPResult(currentPvpCombat.opponent.name, currentPlayer.name);
      const resultDiv = document.getElementById('battle-result');
      resultDiv.classList.remove('hidden');
      document.getElementById('battle-result-text').textContent = '🏆 PvP 胜利！';
      closeBattleOverlay();
      return;
    }

    // Wait for opponent
    document.getElementById('battle-attack-btn').disabled = true;
  }
}
