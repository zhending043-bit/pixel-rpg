class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.player = null;
    this.pendingChallenge = null;
    this.reconnectAttempts = 0;
  }

  init(player) {
    this.player = player;
    this.connect();
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.login(this.player);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.warn('Invalid message:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        // Exponential backoff: 3s, 6s, 12s, 24s... max 30s
        const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      };

      this.ws.onerror = () => {
        // Will trigger onclose
      };
    } catch (e) {
      setTimeout(() => this.connect(), 3000);
    }
  }

  login(player) {
    if (!this.connected || !this.ws) return;
    this.player = player;
    const data = player.serialize();
    this.ws.send(JSON.stringify({
      type: 'login',
      name: player.name,
      playerData: data,
    }));
  }

  challenge(targetName) {
    if (!this.connected) {
      addPvPLog('⚠ 未连接到服务器');
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'challenge',
      target: targetName,
      playerData: this.player.serialize(),
    }));
    addPvPLog(`⏳ 已向 ${targetName} 发起挑战，等待回应...`);
  }

  acceptChallenge(from) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'challenge_response',
      target: from,
      accept: true,
      playerData: this.player.serialize(),
    }));
  }

  declineChallenge(from) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'challenge_response',
      target: from,
      accept: false,
    }));
    addPvPLog(`❌ 已拒绝 ${from} 的挑战`);
  }

  sendPvPAttack(target, damage, critical, comboDamage = 0, comboCritical = false) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'pvp_attack',
      target,
      damage,
      critical,
      comboDamage,
      comboCritical,
    }));
  }

  sendPvPResult(target, winner, lootType, lootValue, lootItems) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'pvp_result',
      target,
      winner,
      lootType,
      lootValue,
      lootItems,
    }));
  }

  sendPvPBattleEnd() {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'pvp_battle_end' }));
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'login_ok':
        addPvPLog('✅ 已连接到服务器');
        break;

      case 'players':
        lastNetworkPlayers = msg.list || [];
        renderOnlinePlayers(lastNetworkPlayers);
        break;

      case 'challenged':
        showPvPChallenge(msg.from);
        break;

      case 'challenge_sent':
        addPvPLog(`📨 挑战已发送给 ${maskName(msg.target)}`);
        break;

      case 'challenge_declined':
        addPvPLog(`❌ ${maskName(msg.from)} 拒绝了你的挑战`);
        break;

      case 'battle_start': {
        const opponentData = msg.opponent;
        const attacker = msg.attacker || '';
        const isMyTurn = attacker === currentPlayer.name;

        openPvPOverlay(opponentData, isMyTurn);
        document.getElementById('battle-attack-btn').onclick = pvpBattleAttack;
        document.getElementById('battle-attack-btn').disabled = true;
        if (isMyTurn) autoPvPAttack();
        break;
      }

      case 'pvp_attacked': {
        // Opponent attacked us
        if (currentPvpCombat) {
          const lost = currentPvpCombat.opponentAttack(msg.damage, msg.critical, msg.comboDamage || 0);
          // Flash effect on player sprite
          flashSprite('battle-p-sprite', msg.critical);
          if (msg.critical) {
            soundCriticalHit();
          } else {
            soundMonsterAttack();
          }
          // Combo flash
          if (msg.comboDamage > 0) {
            setTimeout(() => {
              flashSprite('battle-p-sprite', msg.comboCritical);
            }, 200);
          }
          updatePvPBattleUI();
          addBattleLog(`受伤-${msg.damage}${msg.critical ? ' 💥暴击!' : ''}`);
          if (lost) {
            currentPlayer.pvpLosses++;
            document.getElementById('battle-attack-btn').disabled = true;
            const resultDiv = document.getElementById('battle-result');
            resultDiv.classList.remove('hidden');
            document.getElementById('battle-result-text').textContent = '💀 PvP 败北...';
            saveGame();
            refreshAll();
          } else {
            document.getElementById('battle-attack-btn').disabled = true;
            addBattleLog('⏳ 你的回合，自动攻击...');
            autoPvPAttack();
          }
        }
        break;
      }

      case 'pvp_opponent_disconnected':
        addPvPLog(`⚠ ${maskName(msg.from)} 断开了连接，PvP 战斗结束`);
        addBattleLog(`⚠ ${maskName(msg.from)} 断开了连接，你获胜了！`);
        if (currentPvpCombat) {
          currentPvpCombat.finished = true;
          currentPlayer.pvpWins++;
          document.getElementById('battle-attack-btn').disabled = true;
          const resultDiv = document.getElementById('battle-result');
          resultDiv.classList.remove('hidden');
          document.getElementById('battle-result-text').textContent = '🏆 对手断线，你获胜了！';
          saveGame();
          refreshAll();
        }
        break;

      case 'pvp_result': {
        addBattleLog(`🏆 PvP 结束！胜者: ${maskName(msg.winner)}`);
        addPvPLog(`🏆 PvP 结束！胜者: ${maskName(msg.winner)}`);
        // Apply loot loss to defeated player
        if (msg.lootType === 'flee') {
          currentPlayer.pvpWins++;
          addBattleLog(`🏃 ${maskName(msg.winner)} 逃跑了！你获得了胜利！`);
          addPvPLog(`🏃 ${maskName(msg.winner)} 逃跑了！你获得了胜利！`);
          document.getElementById('battle-overlay').classList.add('hidden');
          saveGame();
          refreshAll();
          return;
        } else if (msg.lootType === 'mercy') {
          const lostGold = Math.floor((currentPlayer.gold || 0) / 2);
          currentPlayer.gold -= lostGold;
          addBattleLog(`💰 ${maskName(msg.winner)} 放过了你，你失去了 ${lostGold} 金币`);
        } else if (msg.lootType === 'kill') {
          const itemCount = (currentPlayer.inventory || []).length +
            (currentPlayer.weapon ? 1 : 0) + (currentPlayer.armor ? 1 : 0) +
            (currentPlayer.accessory ? 1 : 0) + (currentPlayer.helmet ? 1 : 0) +
            (currentPlayer.boots ? 1 : 0);
          currentPlayer.gold = 0;
          currentPlayer.weapon = null;
          currentPlayer.armor = null;
          currentPlayer.accessory = null;
          currentPlayer.helmet = null;
          currentPlayer.boots = null;
          currentPlayer.inventory = [];
          currentPlayer.lives--;
          soundKill();
          if (currentPlayer.lives > 0) {
            currentPlayer.hp = currentPlayer.effectiveMaxHp;
            addBattleLog(`💀 ${maskName(msg.winner)} 杀了你，损失全部身家！剩余 ${currentPlayer.lives}/3 条命`);
          } else {
            currentPlayer.hp = 0;
            addBattleLog(`💀 ${maskName(msg.winner)} 杀了你，游戏结束！你已经没有命了...`);
          }
        }
        // Update defeat text if battle overlay is still showing
        const resultDiv = document.getElementById('battle-result');
        if (!resultDiv.classList.contains('hidden')) {
          const livesLeft = currentPlayer.lives;
          for (const child of resultDiv.children) {
            if (child.id === 'battle-close-btn' || child.id === 'pvp-mercy-kill-div') continue;
            if (child.tagName === 'P' || child.id === 'battle-result-text') {
              child.textContent = msg.lootType === 'kill'
                ? `💀 被 ${maskName(msg.winner)} 击杀！损失全部身家${livesLeft > 0 ? `，剩余 ${livesLeft}/3 条命` : '，游戏结束！'}`
                : `😅 ${maskName(msg.winner)} 放过了你，损失了一半金币`;
            }
          }
        }
        saveGame();
        refreshAll();
        break;
      }

      case 'error':
        addPvPLog(`⚠ ${msg.message}`);
        break;
    }
  }
}
