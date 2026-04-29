// ========= Game Entry =========

const SAVE_KEY = 'pixel_rpg_save';

function saveGame(player) {
  try {
    const data = player.serialize();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    // Also save to server (async, fire-and-forget)
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: player.name, data }),
    }).catch(e => console.warn('Server save failed:', e));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

// Auto-save every 30 seconds when game is active
let autosaveTimer = null;
function startAutosave() {
  stopAutosave();
  autosaveTimer = setInterval(() => {
    if (typeof currentPlayer !== 'undefined' && currentPlayer) {
      saveGame(currentPlayer);
    }
  }, 30000);
}
function stopAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

// Save on page close/refresh
window.addEventListener('beforeunload', () => {
  if (typeof currentPlayer !== 'undefined' && currentPlayer) {
    try {
      const data = currentPlayer.serialize();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      navigator.sendBeacon('/api/save', new Blob([JSON.stringify({ name: currentPlayer.name, data })], { type: 'application/json' }));
    } catch (e) { /* ignore */ }
  }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Pre-fill name from save
  let saved;
  try { saved = localStorage.getItem(SAVE_KEY); } catch (e) { saved = null; }
  if (saved) {
    try {
      const data = JSON.parse(saved);
      document.getElementById('player-name-input').value = data.name || '';
    } catch (e) { /* ignore */ }
  }

  // Initialize UI with a placeholder player (will be replaced on start)
  const dummyPlayer = new Player('');
  initUI(dummyPlayer, saveGame);
});
