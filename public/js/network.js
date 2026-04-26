class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.player = null;
    this.pendingChallenge = null;
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
        // Auto reconnect after 3s
        setTimeout(() => this.connect(), 3000);
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
    this.ws.send(JSON.stringify({ type: 'challenge', target: targetName }));
    addPvPLog(`⏳ 已向 ${targetName} 发起挑战，等待回应...`);
  }

  acceptChallenge(from) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'challenge_response',
      target: from,
      accept: true,
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

  sendPvPAttack(target, damage, critical) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'pvp_attack',
      target,
      damage,
      critical,
    }));
  }

  sendPvPResult(target, winner) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'pvp_result',
      target,
      winner,
    }));
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
        addPvPLog(`📨 挑战已发送给 ${msg.target}`);
        break;

      case 'challenge_declined':
        addPvPLog(`❌ ${msg.from} 拒绝了你的挑战`);
        break;

      case 'battle_start': {
        const opponentData = msg.opponent;
        const attacker = msg.attacker || '';
        const isMyTurn = attacker === currentPlayer.name;

        openPvPOverlay(opponentData, isMyTurn);
        addPvPLog(`⚔ PvP 对战开始！对手: ${opponentData.name} Lv.${opponentData.level}`);

        // Rebind attack button for PvP
        document.getElementById('battle-attack-btn').onclick = pvpBattleAttack;
        document.getElementById('battle-attack-btn').disabled = !isMyTurn;
        break;
      }

      case 'pvp_attacked': {
        // Opponent attacked us
        if (currentPvpCombat) {
          const lost = currentPvpCombat.opponentAttack(msg.damage, msg.critical);
          updatePvPBattleUI();
          if (lost) {
            document.getElementById('battle-attack-btn').disabled = true;
            const resultDiv = document.getElementById('battle-result');
            resultDiv.classList.remove('hidden');
            document.getElementById('battle-result-text').textContent = '💀 PvP 败北...';
          } else {
            // Our turn
            document.getElementById('battle-attack-btn').disabled = false;
          }
        }
        break;
      }

      case 'pvp_result':
        addPvPLog(`🏆 PvP 结束！胜者: ${msg.winner}`);
        break;

      case 'error':
        addPvPLog(`⚠ ${msg.message}`);
        break;
    }
  }
}
