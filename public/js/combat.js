const CRIT_MULTIPLIER = 1.8;
const LUCK_MULTIPLIER = 10;
const DAMAGE_VARIANCE = 0.1; // ±10%

function calcDamage(atk, def) {
  const base = atk * (100 / (100 + def));
  const variance = 1 + (Math.random() * 2 - 1) * DAMAGE_VARIANCE;
  return Math.max(1, Math.floor(base * variance));
}

function isCritical(level) {
  return Math.random() < Math.min(1, level * 0.01);
}

function isLuckyCrit(luck) {
  return Math.random() < (luck || 1) * 0.001;
}

/**
 * Shared player attack calculation used by both PvE and PvP combat.
 * Handles: cooldown decrement, crit/lucky, burst, lifesteal, combo.
 * Does NOT handle death/victory/loot — caller's responsibility.
 */
function calcPlayerAttack(player, targetDef, onLog) {
  // Decrement cooldowns
  player.lifestealCd = Math.max(0, player.lifestealCd - 1);
  player.comboCd = Math.max(0, player.comboCd - 1);
  player.burstCd = Math.max(0, player.burstCd - 1);

  // Class passives
  const critRate = player.level * 0.01 + (player.passivePrecision ? 0.10 : 0);
  const critMult = player.passivePrecision ? 2.5 : CRIT_MULTIPLIER;
  let crit = Math.random() < Math.min(1, critRate);
  const lucky = isLuckyCrit(player.luck);
  let damage = calcDamage(player.atk, targetDef);

  if (lucky) {
    damage = Math.floor(damage * LUCK_MULTIPLIER);
    crit = true;
  } else if (crit) {
    damage = Math.floor(damage * critMult);
  }

  // 魔女魔力爆发
  const burstBonus = (player.passiveBurst && player.burstCd === 0) ? 3.0 : 1.0;
  let burstText = '';
  if (burstBonus > 1.0) {
    damage = Math.floor(damage * burstBonus);
    player.burstCd = player.burstCdMax;
    soundManaBurst();
    burstText = '🔮 魔力爆发！';
  }

  const critText = lucky ? '🍀 幸运暴击! ' : (crit ? '💥 暴击! ' : '');
  onLog(`${burstText}${critText}造成伤害${damage}`);

  // Lifesteal
  let lifestealHeal = 0;
  if (player.passiveLifesteal && player.lifestealCd === 0 && damage > 0) {
    lifestealHeal = Math.max(1, Math.floor(damage * 0.15));
    player.hp = Math.min(player.effectiveMaxHp, player.hp + lifestealHeal);
    player.lifestealCd = player.lifestealCdMax;
    onLog(`🩸 吸血恢复了 ${lifestealHeal} 点生命`);
  }

  // Combo (base damage — caller can override with custom calc)
  let comboDamage = 0;
  if (player.passiveCombo && player.comboCd === 0) {
    comboDamage = Math.floor(damage * 0.6);
    player.comboCd = player.comboCdMax;
  }

  return { damage, critical: crit, lucky, lifesteal: lifestealHeal > 0, comboDamage };
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

    const result = calcPlayerAttack(this.player, this.monster.def, this.onLog);
    const { damage, critical: crit, lucky, lifesteal, comboDamage } = result;

    this.monster.hp -= damage;
    this.stats.round++;
    this.stats.playerTotalDmg += damage;
    if (crit) this.stats.playerCrits++;
    this.lastHit = { damage, critical: crit, lucky, isPlayer: true, lifesteal, combo: comboDamage > 0 };

    // Combo on monster
    if (comboDamage > 0) {
      if (this.monster.hp > 0) {
        this.monster.hp -= comboDamage;
        this.stats.playerTotalDmg += comboDamage;
        this.onLog(`💫 连击！额外造成了 ${comboDamage} 点伤害`);
      }
    }

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

      // Boss (zone 6) drops red equipment at low chance
      if (this.zoneIndex === 5) {
        if (Math.random() < 0.08) {
          const slotTypes = ['weapon', 'armor', 'accessory', 'helmet', 'boots'];
          const dropSlot = slotTypes[Math.floor(Math.random() * slotTypes.length)];
          loot = createRedEquipment(30, dropSlot);
          this.player.inventory.push(loot);
        }
      } else {
        const lootChance = this.zoneIndex >= 0 ? 0.4 + (this.monsterLevel * 0.02) : 0;
        if (Math.random() < lootChance) {
          const dropSlot = this.monster.dropSlot || null;
          // Equipment drops at zone's max level for consistent balance
          const zone = ZONES[this.zoneIndex];
          const equipLevel = zone ? zone.monsters[zone.monsters.length - 1].level : this.monsterLevel;
          loot = generateEquipment(equipLevel, this.zoneIndex, dropSlot);
          this.player.inventory.push(loot);
        }
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

    let damage = calcDamage(this.monster.atk, this.player.def);

    this.player.hp -= damage;
    this.stats.monsterTotalDmg += damage;
    this.lastHit = { damage, critical: false, isPlayer: false };
    this.onLog(`受伤-${damage}`);

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

    const result = calcPlayerAttack(this.player, this.opponent.def, this.onLog);
    let { damage, critical: crit, lucky, comboDamage } = result;

    this.opponent.hp -= damage;

    // PvP combo is special: recalculates with target def and can crit
    let comboCritical = false;
    if (comboDamage > 0 && this.opponent.hp > 0) {
      comboDamage = calcDamage(Math.floor(this.player.atk * 0.6), this.opponent.def);
      comboCritical = isCritical(this.player.level);
      if (comboCritical) comboDamage = Math.floor(comboDamage * CRIT_MULTIPLIER);
      this.opponent.hp -= comboDamage;
      const comboCritText = comboCritical ? '💥' : '';
      this.onLog(`💫 连击！${comboCritText}额外造成了 ${comboDamage} 点伤害`);
    }

    if (this.opponent.hp <= 0) {
      this.opponent.hp = 0;
      this.finished = true;
      this.onLog(`🏆 你击败了 ${this.opponent.name}！`);
      return { won: true, damage, critical: crit, lucky, comboDamage, comboCritical };
    }

    this.myTurn = false;
    return { won: null, damage, critical: crit, lucky, comboDamage, comboCritical };
  }

  opponentAttack(damage, critical, comboDamage = 0) {
    this.player.hp -= damage;
    const critText = critical ? '💥 暴击! ' : '';
    this.onLog(`受伤-${damage}${critText}`);

    if (comboDamage > 0) {
      this.player.hp -= comboDamage;
      this.onLog(`💫 连击！额外造成了 ${comboDamage} 点伤害`);
    }

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
