// ============================================================
// UI Controller - DOM Rendering & Event Handling
// ============================================================

import { isRed, SUITS, RANK_NAMES } from './poker-engine.js';
import { AI_PERSONALITIES } from './ai-player.js';

// Seat mapping based on player count: which DOM seat each player occupies
// 10 positions clockwise from bottom: bottom, BL, L, TL, TLC, TC, TRC, TR, R, BR
const SEAT_MAPS = {
  2:  [0, 5],
  3:  [0, 3, 7],
  4:  [0, 2, 5, 8],
  5:  [0, 1, 3, 7, 9],
  6:  [0, 1, 3, 5, 7, 9],
  7:  [0, 1, 2, 4, 6, 8, 9],
  8:  [0, 1, 2, 4, 6, 7, 8, 9],
  9:  [0, 1, 2, 3, 4, 6, 7, 8, 9],
  10: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};

const SEAT_CLASSES = [
  'seat-bottom',             // 0 - 6 o'clock
  'seat-bottom-left',        // 1 - ~8 o'clock
  'seat-left',               // 2 - 9 o'clock
  'seat-top-left',           // 3 - ~10 o'clock
  'seat-top-left-center',    // 4 - ~11 o'clock
  'seat-top-center',         // 5 - 12 o'clock
  'seat-top-right-center',   // 6 - ~1 o'clock
  'seat-top-right',          // 7 - ~2 o'clock
  'seat-right',              // 8 - 3 o'clock
  'seat-bottom-right',       // 9 - ~4 o'clock
];

class UIController {
  constructor() {
    this.actionResolver = null;
    this.logMessages = [];
    this.thinkingTimer = null;
    this.playerCount = 6;
    this.seatMap = SEAT_MAPS[6];
  }

  init() {
    this.communityArea = document.getElementById('community-cards');
    this.potDisplay = document.getElementById('pot-amount');
    this.phaseDisplay = document.getElementById('phase-display');
    this.blindsDisplay = document.getElementById('blinds-display');
    this.actionPanel = document.getElementById('action-panel');
    this.logContainer = document.getElementById('game-log');
    this.raiseSlider = document.getElementById('raise-slider');
    this.raiseInput = document.getElementById('raise-input');

    // Action buttons
    document.getElementById('btn-fold').addEventListener('click', () => this.submitAction('fold'));
    document.getElementById('btn-check').addEventListener('click', () => this.submitAction('check'));
    document.getElementById('btn-call').addEventListener('click', () => this.submitAction('call'));
    document.getElementById('btn-raise').addEventListener('click', () => this.submitAction('raise'));
    document.getElementById('btn-allin').addEventListener('click', () => this.submitAction('allin'));

    // Sync slider <-> input
    this.raiseSlider.addEventListener('input', (e) => {
      this.raiseInput.value = e.target.value;
    });

    this.raiseInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value) || 0;
      const min = parseInt(this.raiseSlider.min);
      const max = parseInt(this.raiseSlider.max);
      if (val > max) val = max;
      this.raiseSlider.value = val;
    });

    this.raiseInput.addEventListener('blur', (e) => {
      let val = parseInt(e.target.value) || parseInt(this.raiseSlider.min);
      const min = parseInt(this.raiseSlider.min);
      const max = parseInt(this.raiseSlider.max);
      val = Math.max(min, Math.min(max, val));
      e.target.value = val;
      this.raiseSlider.value = val;
    });
  }

  // ---- Player Seat Setup ----

  setupSeats(playerCount) {
    this.playerCount = playerCount;
    this.seatMap = SEAT_MAPS[playerCount] || SEAT_MAPS[6];

    // Hide all seats first, remove position classes
    for (let i = 0; i < 10; i++) {
      const el = document.getElementById(`player-${i}`);
      if (!el) continue;
      el.style.display = 'none';
      SEAT_CLASSES.forEach(c => el.classList.remove(c));
    }

    // Show and position active seats
    for (let i = 0; i < this.seatMap.length; i++) {
      const seatIndex = this.seatMap[i];
      const el = document.getElementById(`player-${i}`);
      if (!el) continue;
      el.style.display = '';
      el.classList.add(SEAT_CLASSES[seatIndex]);
    }
  }

  // ---- State Rendering ----

  renderState(state) {
    this.renderPlayers(state);
    this.renderCommunityCards(state.communityCards);
    this.potDisplay.textContent = `$${state.pot}`;
    this.phaseDisplay.textContent = this.formatPhase(state.phase);
    if (this.blindsDisplay) {
      this.blindsDisplay.textContent = `Blinds $${state.smallBlind}/$${state.bigBlind}`;
    }
  }

  renderPlayers(state) {
    state.players.forEach((player, i) => {
      const el = document.getElementById(`player-${i}`);
      if (!el) return;

      const nameEl = el.querySelector('.player-name');
      const chipsEl = el.querySelector('.player-chips');
      const cardsEl = el.querySelector('.player-cards');
      const actionEl = el.querySelector('.player-action');
      const avatarEl = el.querySelector('.player-avatar');

      nameEl.textContent = player.name;
      chipsEl.textContent = `$${player.chips}`;

      if (!player.isHuman) {
        const personality = AI_PERSONALITIES[player.personality];
        avatarEl.textContent = personality?.emoji || '🤖';
        el.title = personality ? `${personality.name}: ${personality.description}` : '';
      } else {
        avatarEl.textContent = '👤';
      }

      // Cards
      cardsEl.innerHTML = '';
      if (player.inHand && !player.folded && player.holeCards.length === 2) {
        if (player.isHuman || state.phase === 'showdown') {
          cardsEl.appendChild(this.createCardElement(player.holeCards[0]));
          cardsEl.appendChild(this.createCardElement(player.holeCards[1]));
        } else {
          cardsEl.appendChild(this.createCardBack());
          cardsEl.appendChild(this.createCardBack());
        }
      }

      // Status classes
      el.classList.toggle('folded', player.folded);
      el.classList.toggle('all-in', player.allIn);
      el.classList.toggle('eliminated', player.chips <= 0 && !player.inHand);

      // Position badges: D / SB / BB
      const dealerChip = el.querySelector('.dealer-chip');
      const sbBadge = el.querySelector('.sb-badge');
      const bbBadge = el.querySelector('.bb-badge');

      if (dealerChip) dealerChip.style.display = state.dealerIndex === i ? 'flex' : 'none';
      if (sbBadge) sbBadge.style.display = state.sbIndex === i ? 'flex' : 'none';
      if (bbBadge) bbBadge.style.display = state.bbIndex === i ? 'flex' : 'none';

      // Bet display
      const betEl = el.querySelector('.player-bet');
      if (betEl) {
        if (player.currentBet > 0) {
          betEl.textContent = `Bet: $${player.currentBet}`;
          betEl.style.display = 'block';
        } else {
          betEl.style.display = 'none';
        }
      }

      // Action display (preserve thinking state)
      if (actionEl && !actionEl.classList.contains('action-thinking')) {
        actionEl.textContent = player.lastAction || '';
        actionEl.className = 'player-action';
        if (player.lastAction) {
          if (player.lastAction.startsWith('Fold')) actionEl.classList.add('action-fold');
          else if (player.lastAction.startsWith('Raise') || player.lastAction.startsWith('All'))
            actionEl.classList.add('action-raise');
          else if (player.lastAction.startsWith('Won')) actionEl.classList.add('action-win');
          else actionEl.classList.add('action-neutral');
        }
      }
    });
  }

  renderCommunityCards(cards) {
    this.communityArea.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      if (i < cards.length) {
        const el = this.createCardElement(cards[i]);
        el.style.animationDelay = `${i * 0.1}s`;
        this.communityArea.appendChild(el);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'card card-placeholder';
        this.communityArea.appendChild(placeholder);
      }
    }
  }

  createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card ${isRed(card) ? 'card-red' : 'card-black'}`;
    const rank = RANK_NAMES[card.rank];
    const suit = SUITS[card.suit];
    el.innerHTML = `
      <span class="card-rank">${rank}</span>
      <span class="card-suit-center">${suit}</span>
    `;
    return el;
  }

  createCardBack() {
    const el = document.createElement('div');
    el.className = 'card card-back';
    el.innerHTML = '<span class="card-back-design">🂠</span>';
    return el;
  }

  formatPhase(phase) {
    const labels = {
      preflop: 'Pre-Flop',
      flop: 'Flop',
      turn: 'Turn',
      river: 'River',
      showdown: 'Showdown',
    };
    return labels[phase] || phase;
  }

  // ---- Thinking Indicator with Timer and Messages ----

  showThinking(playerIndex, show, personality) {
    const el = document.getElementById(`player-${playerIndex}`);
    if (!el) return;
    const actionEl = el.querySelector('.player-action');
    const timerEl = el.querySelector('.thinking-timer');

    if (show) {
      actionEl.className = 'player-action action-thinking';
      const msgs = personality?.thinkingMessages || ['Thinking...'];
      actionEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      if (timerEl) { timerEl.style.display = 'block'; timerEl.textContent = ''; }
    } else {
      actionEl.className = 'player-action';
      actionEl.textContent = '';
      if (timerEl) timerEl.style.display = 'none';
      this.stopThinkingCycle();
    }
  }

  startThinkingCycle(playerIndex, totalSeconds, personality) {
    const el = document.getElementById(`player-${playerIndex}`);
    if (!el) return;
    const actionEl = el.querySelector('.player-action');
    const timerEl = el.querySelector('.thinking-timer');
    const msgs = personality?.thinkingMessages || ['Thinking...'];

    let remaining = totalSeconds;
    let msgIndex = Math.floor(Math.random() * msgs.length);

    actionEl.className = 'player-action action-thinking';
    actionEl.textContent = msgs[msgIndex];
    if (timerEl) {
      timerEl.style.display = 'block';
      timerEl.textContent = `${remaining}s`;
    }

    this.thinkingTimer = setInterval(() => {
      remaining--;
      if (timerEl) timerEl.textContent = `${Math.max(0, remaining)}s`;

      // Cycle message every 4-6 seconds
      if (remaining % 5 === 0 && remaining > 0) {
        msgIndex = (msgIndex + 1) % msgs.length;
        actionEl.textContent = msgs[msgIndex];
      }
    }, 1000);
  }

  stopThinkingCycle() {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  }

  // ---- Action Input ----

  showActionPanel(playerIndex, validActions, gameState) {
    const player = gameState.players[playerIndex];
    const { actions, toCall, minRaise } = validActions;

    document.querySelectorAll('.player-seat').forEach(el => el.classList.remove('active-player'));
    document.getElementById(`player-${playerIndex}`)?.classList.add('active-player');

    document.getElementById('btn-fold').style.display = actions.includes('fold') ? '' : 'none';
    document.getElementById('btn-check').style.display = actions.includes('check') ? '' : 'none';

    const callBtn = document.getElementById('btn-call');
    callBtn.style.display = actions.includes('call') ? '' : 'none';
    callBtn.textContent = `Call $${toCall}`;

    const raiseGroup = document.getElementById('raise-group');
    raiseGroup.style.display = actions.includes('raise') ? 'flex' : 'none';

    if (actions.includes('raise')) {
      const maxRaise = player.chips + player.currentBet;
      this.raiseSlider.min = minRaise;
      this.raiseSlider.max = maxRaise;
      this.raiseSlider.value = minRaise;
      this.raiseSlider.step = Math.max(1, Math.floor(gameState.currentBet || 10));
      this.raiseInput.value = minRaise;
      this.raiseInput.min = minRaise;
      this.raiseInput.max = maxRaise;
    }

    document.getElementById('btn-allin').style.display = actions.includes('allin') ? '' : 'none';
    document.getElementById('btn-allin').textContent = `All-In $${player.chips}`;

    this.actionPanel.style.display = 'flex';
    this.actionPanel.classList.add('visible');

    return new Promise(resolve => {
      this.actionResolver = resolve;
    });
  }

  hideActionPanel() {
    this.actionPanel.classList.remove('visible');
    this.actionPanel.style.display = 'none';
    document.querySelectorAll('.player-seat').forEach(el => el.classList.remove('active-player'));
    this.actionResolver = null;
  }

  submitAction(action) {
    if (!this.actionResolver) return;
    let result = { action };
    if (action === 'raise') {
      result.amount = parseInt(this.raiseInput.value) || parseInt(this.raiseSlider.value);
    }
    const resolver = this.actionResolver;
    this.hideActionPanel();
    resolver(result);
  }

  // ---- Leaderboard ----

  updateLeaderboard(players, startingChips) {
    const container = document.getElementById('leaderboard');
    if (!container) return;

    const sorted = [...players].sort((a, b) => {
      const netA = a.chips - startingChips - (a.totalBuyIn || 0);
      const netB = b.chips - startingChips - (b.totalBuyIn || 0);
      return netB - netA;
    });

    container.innerHTML = sorted.map((p, i) => {
      const totalInvested = startingChips + (p.totalBuyIn || 0);
      const net = p.chips - totalInvested;
      const sign = net >= 0 ? '+' : '';
      const diffClass = net > 0 ? 'lb-up' : net < 0 ? 'lb-down' : 'lb-even';
      const eliminated = p.chips <= 0 ? ' lb-eliminated' : '';
      const buyIns = (p.buyInCount || 0);
      const rebuyBadge = buyIns > 0 ? `<span class="lb-rebuy">R${buyIns}</span>` : '';
      const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i+1}th`;
      return `<div class="lb-row${eliminated}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.name}</span>
        ${rebuyBadge}
        <span class="lb-chips">$${p.chips}</span>
        <span class="lb-diff ${diffClass}">${sign}${net}</span>
      </div>`;
    }).join('');
  }

  // ---- Game Log ----

  addLogMessage(msg) {
    this.logMessages.push(msg);
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (msg.includes('---')) entry.classList.add('log-phase');
    if (msg.includes('wins') || msg.includes('Won')) entry.classList.add('log-win');
    if (msg.includes('folds')) entry.classList.add('log-fold');
    if (msg.includes('raises') || msg.includes('ALL IN')) entry.classList.add('log-raise');
    if (msg.includes('buys in')) entry.classList.add('log-buyin');
    entry.textContent = msg;
    this.logContainer.appendChild(entry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  clearLog() {
    this.logMessages = [];
    this.logContainer.innerHTML = '';
  }

  // ---- Settings Modal ----

  showSettings() {
    document.getElementById('settings-modal').classList.add('visible');
  }

  hideSettings() {
    document.getElementById('settings-modal').classList.remove('visible');
  }

  updateProviderUI() {
    const provider = document.getElementById('llm-provider').value;
    const apiKeyGroup = document.getElementById('api-key-group');
    const modelGroup = document.getElementById('model-group');
    const hint = document.getElementById('provider-hint');

    if (provider === 'default') {
      apiKeyGroup.style.display = 'none';
      modelGroup.style.display = 'none';
      hint.textContent = 'Free AI powered by Gemini. No API key needed.';
    } else if (provider === 'none') {
      apiKeyGroup.style.display = 'none';
      modelGroup.style.display = 'none';
      hint.textContent = 'AI players use built-in heuristic strategies (no LLM).';
    } else {
      apiKeyGroup.style.display = '';
      modelGroup.style.display = '';
      hint.textContent = 'Provide your own API key to use this provider.';
    }
  }

  getSettings() {
    return {
      provider: document.getElementById('llm-provider').value,
      apiKey: document.getElementById('api-key').value.trim(),
      model: document.getElementById('llm-model').value,
      playerName: document.getElementById('player-name').value.trim() || 'You',
      playerCount: parseInt(document.getElementById('player-count').value) || 6,
    };
  }

  loadSettings() {
    const saved = localStorage.getItem('poker-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        document.getElementById('llm-provider').value = settings.provider || 'default';
        document.getElementById('api-key').value = settings.apiKey || '';
        document.getElementById('llm-model').value = settings.model || '';
        document.getElementById('player-name').value = settings.playerName || '';
        document.getElementById('player-count').value = settings.playerCount || 6;
        this.updateProviderUI();
        return settings;
      } catch (e) {}
    }
    this.updateProviderUI();
    return null;
  }

  saveSettings() {
    const settings = this.getSettings();
    localStorage.setItem('poker-settings', JSON.stringify(settings));
    return settings;
  }

  // ---- Utility ----

  showMessage(text, duration = 2000) {
    const el = document.getElementById('game-message');
    el.textContent = text;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), duration);
  }

  async delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

export { UIController, SEAT_MAPS };
