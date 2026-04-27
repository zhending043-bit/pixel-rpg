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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Pre-fill name from save
  const saved = localStorage.getItem(SAVE_KEY);
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
