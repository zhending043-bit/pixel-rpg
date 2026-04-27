class Player {
  constructor(name) {
    this.name = name;
    this.level = 1;
    this.hp = 80;
    this.maxHp = 80;
    this.baseAtk = 6;
    this.baseDef = 3;
    this.exp = 0;
    this.gold = 0;
    this.weapon = null;
    this.armor = null;
    this.accessory = null;
    this.helmet = null;
    this.boots = null;
    this.inventory = [];
    this.zonesUnlocked = 1;
    this.defeatedMonsters = []; // Track monster names defeated for zone progression
    this.lootedCounts = { '普通': 0, '优秀': 0, '稀有': 0, '史诗': 0, '传说': 0 };
    this.shopBought = [];
    this.lives = 5;
    this.maxLives = 5; // base, can be increased to 10 via shop
    this.pvpWins = 0;
    this.pvpLosses = 0;
    this.passiveLifesteal = true;
    this.passiveCombo = true;
    this.lifestealCd = 0;
    this.comboCd = 0;
    this.lifestealCdMax = 3;
    this.comboCdMax = 4;
    this.luck = 1;
  }

  get maxExp() {
    return Math.floor(this.level * 50 * (1 + this.level * 0.1));
  }

  get atk() {
    let bonus = 0;
    if (this.weapon) bonus += this.weapon.atk;
    if (this.armor && this.armor.atk) bonus += this.armor.atk;
    if (this.accessory) bonus += this.accessory.atk || 0;
    if (this.helmet && this.helmet.atk) bonus += this.helmet.atk;
    if (this.boots && this.boots.atk) bonus += this.boots.atk;
    return this.baseAtk + bonus;
  }

  get def() {
    let bonus = 0;
    if (this.weapon && this.weapon.def) bonus += this.weapon.def;
    if (this.armor) bonus += this.armor.def;
    if (this.accessory) bonus += this.accessory.def || 0;
    if (this.helmet) bonus += this.helmet.def;
    if (this.boots) bonus += this.boots.def;
    return this.baseDef + bonus;
  }

  get hpBonus() {
    let bonus = 0;
    if (this.weapon && this.weapon.hp) bonus += this.weapon.hp;
    if (this.armor && this.armor.hp) bonus += this.armor.hp;
    if (this.accessory && this.accessory.hp) bonus += this.accessory.hp;
    if (this.helmet && this.helmet.hp) bonus += this.helmet.hp;
    if (this.boots && this.boots.hp) bonus += this.boots.hp;
    return bonus;
  }

  get effectiveMaxHp() {
    return this.maxHp + this.hpBonus;
  }

  addExp(amount) {
    this.exp += amount;
    while (this.exp >= this.maxExp) {
      this.exp -= this.maxExp;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.baseAtk += 2;
    this.baseDef += 2;
    this.maxHp += 10;
    this.hp = this.effectiveMaxHp; // Full heal on level up
  }

  equip(item) {
    const slot = item.type;
    const old = this[slot];
    this[slot] = item;
    // Remove from inventory
    const idx = this.inventory.indexOf(item);
    if (idx !== -1) this.inventory.splice(idx, 1);
    // Add old to inventory
    if (old) this.inventory.push(old);
    return old;
  }

  unequip(slot) {
    const item = this[slot];
    if (item) {
      this[slot] = null;
      this.inventory.push(item);
    }
    return item;
  }

  /** Get total stats for display */
  getStats() {
    return {
      level: this.level,
      hp: this.hp,
      maxHp: this.effectiveMaxHp,
      atk: this.atk,
      def: this.def,
      exp: this.exp,
      maxExp: this.maxExp,
      gold: this.gold,
    };
  }

  /** Check if zone should unlock based on looted equipment count */
  checkZoneUnlock(zoneIdx) {
    // Zone i needs 3 of its signature rarity to unlock zone i+1
    const rarityNames = ['普通', '优秀', '稀有', '史诗', '传说'];
    const neededRarity = rarityNames[zoneIdx];
    if (!neededRarity) return false;
    if ((this.lootedCounts[neededRarity] || 0) >= 3) {
      if (this.zonesUnlocked === zoneIdx + 1) {
        this.zonesUnlocked = zoneIdx + 2; // Next zone (1-indexed)
        return true;
      }
    }
    return false;
  }

  /** Serialize for save */
  serialize() {
    return {
      name: this.name,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      baseAtk: this.baseAtk,
      baseDef: this.baseDef,
      exp: this.exp,
      gold: this.gold,
      weapon: this.weapon,
      armor: this.armor,
      accessory: this.accessory,
      helmet: this.helmet,
      boots: this.boots,
      inventory: this.inventory,
      zonesUnlocked: this.zonesUnlocked,
      defeatedMonsters: this.defeatedMonsters,
      lootedCounts: this.lootedCounts,
      shopBought: this.shopBought,
      lives: this.lives,
      maxLives: this.maxLives,
      pvpWins: this.pvpWins,
      pvpLosses: this.pvpLosses,
      passiveLifesteal: this.passiveLifesteal,
      passiveCombo: this.passiveCombo,
      lifestealCd: this.lifestealCd,
      comboCd: this.comboCd,
      lifestealCdMax: this.lifestealCdMax,
      comboCdMax: this.comboCdMax,
      luck: this.luck,
    };
  }

  /** Deserialize from save */
  static deserialize(data) {
    const p = new Player(data.name);
    p.level = data.level;
    p.hp = data.hp;
    p.maxHp = data.maxHp;
    p.baseAtk = data.baseAtk;
    p.baseDef = data.baseDef;
    p.exp = data.exp;
    p.gold = data.gold;
    p.weapon = data.weapon;
    p.armor = data.armor;
    p.accessory = data.accessory;
    p.helmet = data.helmet || null;
    p.boots = data.boots || null;
    p.inventory = data.inventory || [];
    p.zonesUnlocked = data.zonesUnlocked || 1;
    p.defeatedMonsters = data.defeatedMonsters || [];
    p.lootedCounts = data.lootedCounts || { '普通': 0, '优秀': 0, '稀有': 0, '史诗': 0, '传说': 0 };
    p.shopBought = data.shopBought || [];
    p.lives = data.lives !== undefined ? data.lives : 5;
    p.maxLives = data.maxLives !== undefined ? data.maxLives : 5;
    p.pvpWins = data.pvpWins || 0;
    p.pvpLosses = data.pvpLosses || 0;
    p.passiveLifesteal = data.passiveLifesteal !== undefined ? data.passiveLifesteal : true;
    p.passiveCombo = data.passiveCombo !== undefined ? data.passiveCombo : true;
    p.lifestealCd = data.lifestealCd || 0;
    p.comboCd = data.comboCd || 0;
    p.lifestealCdMax = data.lifestealCdMax || 3;
    p.comboCdMax = data.comboCdMax || 4;
    p.luck = data.luck !== undefined ? data.luck : 1;
    return p;
  }
}
