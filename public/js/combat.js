const CRIT_CHANCE = 0.05;
const CRIT_MULTIPLIER = 1.8;
const DAMAGE_VARIANCE = 0.1; // ±10%

function calcDamage(atk, def) {
  const base = atk * (100 / (100 + def));
  const variance = 1 + (Math.random() * 2 - 1) * DAMAGE_VARIANCE;
  return Math.max(1, Math.floor(base * variance));
}

function isCritical() {
  return Math.random() < CRIT_CHANCE;
}

class PvECombat {
  constructor(player, monsterData, onLog, onEnd, zoneIndex = 0) {
    this.player = player;
    this.monster = {
      name: monsterData.name,
      level: monsterData.level,
      hp: monsterData.hp,
      maxHp: monsterData.hp,
      atk: monsterData.atk,
      def: monsterData.def,
      dropSlot: monsterData.dropSlot,
      sprite: monsterData.sprite,
    };
    this.expReward = monsterData.expReward;
    this.goldReward = monsterData.goldReward;
    this.monsterLevel = monsterData.level;
    this.zoneIndex = zoneIndex;
    this.onLog = onLog;
    this.onEnd = onEnd;
    this.finished = false;
    this.stats = { round: 0, playerTotalDmg: 0, playerCrits: 0, monsterTotalDmg: 0, monsterCrits: 0 };
    this.lastHit = { damage: 0, critical: false, isPlayer: true };
  }

  playerAttack() {
    if (this.finished) return;

    const crit = isCritical();
    let damage = calcDamage(this.player.atk, this.monster.def);
    if (crit) damage = Math.floor(damage * CRIT_MULTIPLIER);

    this.monster.hp -= damage;
    this.stats.round++;
    this.stats.playerTotalDmg += damage;
    if (crit) this.stats.playerCrits++;
    this.lastHit = { damage, critical: crit, isPlayer: true };
    const critText = crit ? '💥 暴击! ' : '';
    this.onLog(`${critText}你对 ${this.monster.name} 造成了 ${damage} 点伤害`);

    if (this.monster.hp <= 0) {
      this.monster.hp = 0;
      this.finished = true;
      // Victory
      const expGained = this.expReward;
      const goldGained = this.goldReward + Math.floor(Math.random() * 10);
      this.player.addExp(expGained);
      this.player.gold += goldGained;

      // Loot (skip for bot battles: zoneIndex < 0)
      let loot = null;
      const lootChance = this.zoneIndex >= 0 ? 0.4 + (this.monsterLevel * 0.02) : 0;
      if (Math.random() < lootChance) {
        const dropSlot = this.monster.dropSlot || null;
        // Equipment drops at zone's max level for consistent balance
        const zone = ZONES[this.zoneIndex];
        const equipLevel = zone ? zone.monsters[zone.monsters.length - 1].level : this.monsterLevel;
        loot = generateEquipment(equipLevel, this.zoneIndex, dropSlot);
        this.player.inventory.push(loot);
      }

      this.onLog(`🏆 击败了 ${this.monster.name}！`);
      this.onLog(`✨ +${expGained} EXP  💰 +${goldGained} 金币`);
      if (loot) {
        this.onLog(`🎁 获得装备: ${loot.name}`);
      }

      this.onEnd({ won: true, exp: expGained, gold: goldGained, loot });
      return { won: true, exp: expGained, gold: goldGained, loot };
    }

    return null; // Battle continues
  }

  monsterAttack() {
    if (this.finished) return;

    const crit = isCritical();
    let damage = calcDamage(this.monster.atk, this.player.def);
    if (crit) damage = Math.floor(damage * CRIT_MULTIPLIER);

    this.player.hp -= damage;
    this.stats.monsterTotalDmg += damage;
    if (crit) this.stats.monsterCrits++;
    this.lastHit = { damage, critical: crit, isPlayer: false };
    const critText = crit ? '💥 暴击! ' : '';
    this.onLog(`${critText}${this.monster.name} 对你造成了 ${damage} 点伤害`);

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.finished = true;
      // Defeat - lose some gold
      const lostGold = Math.floor(this.player.gold * 0.1);
      this.player.gold = Math.max(0, this.player.gold - lostGold);
      this.onLog(`💀 你被 ${this.monster.name} 击败了...`);
      this.onLog(`💰 损失了 ${lostGold} 金币`);
      this.onEnd({ won: false, lostGold });
      return { won: false };
    }

    return null;
  }
}

/** PvP combat state */
class PvPCombat {
  constructor(player, opponentData, onLog) {
    this.player = player;
    this.opponent = {
      name: opponentData.name,
      level: opponentData.level,
      hp: opponentData.hp,
      maxHp: opponentData.maxHp,
      atk: opponentData.atk,
      def: opponentData.def,
    };
    this.opponentData = opponentData; // full data for loot
    this.onLog = onLog;
    this.myTurn = true; // Challenger goes first
    this.finished = false;
  }

  myAttack() {
    if (this.finished || !this.myTurn) return null;

    const crit = isCritical();
    let damage = calcDamage(this.player.atk, this.opponent.def);
    if (crit) damage = Math.floor(damage * CRIT_MULTIPLIER);

    this.opponent.hp -= damage;
    const critText = crit ? '💥 暴击! ' : '';
    this.onLog(`${critText}你对 ${this.opponent.name} 造成了 ${damage} 点伤害`);

    if (this.opponent.hp <= 0) {
      this.opponent.hp = 0;
      this.finished = true;
      this.onLog(`🏆 你击败了 ${this.opponent.name}！`);
      return { won: true, damage, critical: crit };
    }

    this.myTurn = false;
    return { won: null, damage, critical: crit };
  }

  opponentAttack(damage, critical) {
    this.player.hp -= damage;
    const critText = critical ? '💥 暴击! ' : '';
    this.onLog(`${critText}${this.opponent.name} 对你造成了 ${damage} 点伤害`);

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.finished = true;
      this.onLog(`💀 你被 ${this.opponent.name} 击败了...`);
      return true; // lost
    }

    this.myTurn = true;
    return false; // still fighting
  }
}
