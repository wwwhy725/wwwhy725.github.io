// ============================================================
// Texas Hold'em Poker - Main Application
// ============================================================

import { PokerGame } from './poker-engine.js';
import { AIPlayer, LLMProvider, AI_NAMES, shufflePersonalities, AI_PERSONALITIES } from './ai-player.js';
import { UIController } from './ui-controller.js';

const STARTING_CHIPS = 1000;
const BUY_IN_AMOUNT = 1000;
const DEFAULT_GEMINI_KEY = 'AIzaSyCkDCG-PMojVrjSDOlUntDTwLHtKEBHfzk';
const DEFAULT_MODEL = 'gemini-2.0-flash';

class PokerApp {
  constructor() {
    this.ui = new UIController();
    this.game = null;
    this.aiPlayer = null;
    this.isPlaying = false;
  }

  init() {
    this.ui.init();
    this.ui.loadSettings();
    this.bindEvents();
    this.initPlayers();
  }

  bindEvents() {
    document.getElementById('poker-launcher').addEventListener('click', () => {
      document.getElementById('poker-launcher').classList.add('hidden');
      document.getElementById('game-container').classList.remove('hidden');
    });
    document.getElementById('btn-start-game').addEventListener('click', () => this.startGame());
    document.getElementById('btn-welcome-settings').addEventListener('click', () => {
      // Hide welcome content, show settings inside the welcome overlay
      document.querySelector('.welcome-content').style.display = 'none';
      document.getElementById('settings-modal').style.display = 'flex';
      document.getElementById('settings-modal').classList.add('welcome-mode');
    });
    document.getElementById('btn-settings').addEventListener('click', () => this.ui.showSettings());
    document.getElementById('llm-provider').addEventListener('change', () => this.ui.updateProviderUI());
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      this.ui.saveSettings();
      this.ui.hideSettings();
      // If we were in welcome mode, restore the welcome content
      const modal = document.getElementById('settings-modal');
      if (modal.classList.contains('welcome-mode')) {
        modal.classList.remove('welcome-mode');
        modal.style.display = '';
        document.querySelector('.welcome-content').style.display = '';
      }
      this.initPlayers();
    });
    document.getElementById('btn-cancel-settings').addEventListener('click', () => {
      this.ui.hideSettings();
      const modal = document.getElementById('settings-modal');
      if (modal.classList.contains('welcome-mode')) {
        modal.classList.remove('welcome-mode');
        modal.style.display = '';
        document.querySelector('.welcome-content').style.display = '';
      }
    });
    document.getElementById('btn-new-hand').addEventListener('click', () => this.playNextHand());
    document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    document.getElementById('btn-buyin').addEventListener('click', () => this.handleHumanBuyIn());
  }

  initPlayers() {
    const settings = this.ui.getSettings();

    if (settings.provider === 'default') {
      const provider = new LLMProvider('gemini', DEFAULT_GEMINI_KEY, DEFAULT_MODEL);
      this.aiPlayer = new AIPlayer(provider);
    } else if (settings.provider !== 'none' && settings.apiKey) {
      const provider = new LLMProvider(settings.provider, settings.apiKey, settings.model);
      this.aiPlayer = new AIPlayer(provider);
    } else {
      this.aiPlayer = new AIPlayer(null);
    }

    const count = settings.playerCount || 6;
    const aiCount = count - 1;
    const personalities = shufflePersonalities(aiCount);

    this.playerConfigs = [
      { id: 0, name: settings.playerName || 'You', chips: STARTING_CHIPS, isHuman: true, personality: null, totalBuyIn: 0, buyInCount: 0 },
      ...AI_NAMES.slice(0, aiCount).map((name, i) => ({
        id: i + 1,
        name,
        chips: STARTING_CHIPS,
        isHuman: false,
        personality: personalities[i],
        totalBuyIn: 0,
        buyInCount: 0,
      })),
    ];
  }

  async startGame() {
    document.getElementById('welcome-screen').classList.add('hidden');
    this.initPlayers();
    this._startFreshGame();
    await this.playNextHand();
  }

  async restartGame() {
    // Abort any in-progress hand
    this._aborted = true;
    this.isPlaying = false;
    this.ui.stopThinkingCycle();
    this.ui.hideActionPanel();
    this.initPlayers();
    this._startFreshGame();
    this._aborted = false;
    this.ui.showMessage('New game started!', 2000);
    await this.playNextHand();
  }

  _startFreshGame() {
    const settings = this.ui.getSettings();
    this.game = new PokerGame(
      this.playerConfigs.map(p => ({ ...p })),
      5, 10
    );

    this.game.onStateChange = (state) => this.ui.renderState(state);
    this.game.onLogMessage = (msg) => this.ui.addLogMessage(msg);
    this.game.onRequestAction = (playerIndex, validActions, state) =>
      this.handleActionRequest(playerIndex, validActions, state);

    this.ui.clearLog();
    this.ui.setupSeats(settings.playerCount || 6);
    this.ui.addLogMessage('Welcome to Texas Hold\'em!');
    this.ui.addLogMessage(`${this.game.players.length} players at the table.`);

    if (settings.provider === 'default') {
      this.ui.addLogMessage(`AI powered by Gemini (${DEFAULT_MODEL}) - Free mode`);
    } else if (settings.provider !== 'none' && settings.apiKey) {
      const modelName = this.aiPlayer.llmProvider?.getModelName() || 'unknown';
      this.ui.addLogMessage(`AI powered by ${settings.provider === 'openai' ? 'OpenAI' : 'Google Gemini'} (${modelName})`);
    } else {
      this.ui.addLogMessage('AI using heuristic strategies.');
    }

    this.ui.updateLeaderboard(this.game.players, STARTING_CHIPS);
    this.updateBuyInButton();
  }

  async playNextHand() {
    if (this.isPlaying) return;

    if (!this.game) {
      await this.startGame();
      return;
    }

    // Auto buy-in for AI players who are out (max 3 buy-ins)
    for (const p of this.game.players) {
      if (!p.isHuman && p.chips <= 0 && (p.buyInCount || 0) < 3) {
        this.game.buyIn(this.game.players.indexOf(p), BUY_IN_AMOUNT);
      }
    }

    const active = this.game.getActivePlayers();
    if (active.length < 2) {
      this.ui.showMessage('Not enough players. Use Buy In or Restart.', 4000);
      return;
    }

    const human = this.game.players[0];
    if (human.chips <= 0) {
      this.ui.showMessage('You\'re out of chips! Buy in or restart.', 3000);
      return;
    }

    this.isPlaying = true;
    document.getElementById('btn-new-hand').disabled = true;
    document.getElementById('btn-buyin').disabled = true;

    try {
      await this.game.startHand();
    } catch (err) {
      console.error('Error during hand:', err);
      this.ui.addLogMessage(`Error: ${err.message}`);
    }

    this.ui.updateLeaderboard(this.game.players, STARTING_CHIPS);

    this.isPlaying = false;
    document.getElementById('btn-new-hand').disabled = false;
    this.updateBuyInButton();

    await this.ui.delay(1000);
    this.ui.showMessage('Click "Next Hand" to continue', 2000);
  }

  handleHumanBuyIn() {
    if (this.isPlaying) return;
    const human = this.game.players[0];
    if ((human.buyInCount || 0) >= 3) {
      this.ui.showMessage('Maximum buy-ins reached (3)', 2000);
      return;
    }
    this.game.buyIn(0, BUY_IN_AMOUNT);
    this.ui.updateLeaderboard(this.game.players, STARTING_CHIPS);
    this.ui.renderState(this.game.getState());
    this.ui.showMessage(`Bought in for $${BUY_IN_AMOUNT}!`, 2000);
    this.updateBuyInButton();
  }

  updateBuyInButton() {
    const btn = document.getElementById('btn-buyin');
    if (!this.game) { btn.disabled = true; return; }
    const human = this.game.players[0];
    const remaining = 3 - (human.buyInCount || 0);
    btn.textContent = remaining > 0 ? `Buy In $${BUY_IN_AMOUNT} (${remaining} left)` : 'Max Buy-Ins Used';
    btn.disabled = this.isPlaying || human.chips >= this.game.bigBlind * 20 || remaining <= 0;
  }

  async handleActionRequest(playerIndex, validActions, state) {
    const player = state.players[playerIndex];

    if (player.isHuman) {
      return await this.ui.showActionPanel(playerIndex, validActions, state);
    } else {
      // AI decision with realistic thinking time
      this.ui.renderState(state);

      const el = document.getElementById(`player-${playerIndex}`);
      el?.classList.add('active-player');

      const personality = AI_PERSONALITIES[player.personality] || AI_PERSONALITIES.owl;

      // Start the decision computation (instant for heuristic, may take a bit for LLM)
      const decisionPromise = this.aiPlayer.decide(playerIndex, validActions, state);

      // Wait for decision to know difficulty
      const decision = await decisionPromise;

      // Determine thinking time based on difficulty (3-5s range)
      let thinkSeconds;
      switch (decision.difficulty) {
        case 'easy':
          thinkSeconds = 2 + Math.floor(Math.random() * 2);   // 2-3s
          break;
        case 'hard':
          thinkSeconds = 4 + Math.floor(Math.random() * 2);   // 4-5s
          break;
        default: // medium
          thinkSeconds = 3 + Math.floor(Math.random() * 2);   // 3-4s
          break;
      }

      // Show thinking with countdown timer and cycling messages
      this.ui.startThinkingCycle(playerIndex, thinkSeconds, personality);

      // Wait for the thinking time (abort-aware)
      await this.ui.delay(thinkSeconds * 1000);
      if (this._aborted) return { action: 'fold' };

      // Stop thinking indicator
      this.ui.stopThinkingCycle();
      this.ui.showThinking(playerIndex, false);
      el?.classList.remove('active-player');

      // Warn once if LLM failed and fell back to heuristic
      if (decision.source === 'heuristic' && this.aiPlayer.llmProvider?.apiKey && !this._llmFallbackWarned) {
        this._llmFallbackWarned = true;
        this.ui.addLogMessage('Warning: LLM call failed, using heuristic AI. Check your API key/model name.');
      }

      // Brief pause after action is displayed so user can read it
      await this.ui.delay(800);
      if (this._aborted) return { action: 'fold' };

      return decision;
    }
  }
}

// ---- Initialize ----
const app = new PokerApp();
document.addEventListener('DOMContentLoaded', () => app.init());
