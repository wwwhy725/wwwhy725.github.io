// ============================================================
// AI Player - LLM Integration + Heuristic Fallback
// ============================================================

import { cardToString, startingHandStrength, evaluateBest } from './poker-engine.js';

const AI_PERSONALITIES = {
  shark: {
    name: 'The Shark', emoji: '🦈',
    description: 'Aggressive and calculated. Bets big with strong hands and bluffs fearlessly.',
    style: 'aggressive', bluffFreq: 0.25, tightness: 0.4,
    thinkingMessages: ['Sizing up the competition...', 'Calculating pot odds...', 'Looking for weakness...', 'Time to pounce?', 'Smells blood in the water...'],
  },
  rock: {
    name: 'The Rock', emoji: '🪨',
    description: 'Tight and conservative. Only plays premium hands but plays them hard.',
    style: 'tight', bluffFreq: 0.05, tightness: 0.7,
    thinkingMessages: ['Is this hand strong enough?', 'Patience is a virtue...', 'Waiting for the right moment...', 'Playing it safe here...', 'Discipline over impulse...'],
  },
  maniac: {
    name: 'The Maniac', emoji: '🃏',
    description: 'Wild and unpredictable. Raises often and loves to put pressure on opponents.',
    style: 'loose-aggressive', bluffFreq: 0.40, tightness: 0.2,
    thinkingMessages: ['Go big or go home!', 'Life is too short to fold!', 'Let\'s gamble!', 'Feeling lucky today...', 'Why not make it interesting?'],
  },
  fox: {
    name: 'The Fox', emoji: '🦊',
    description: 'Tricky and deceptive. Slow-plays big hands and makes sneaky bluffs.',
    style: 'tricky', bluffFreq: 0.30, tightness: 0.45,
    thinkingMessages: ['What do they think I have?', 'Setting the trap...', 'Playing it cool...', 'Misdirection is key...', 'They\'ll never see it coming...'],
  },
  owl: {
    name: 'The Owl', emoji: '🦉',
    description: 'Balanced and observant. Adapts to the table and makes calculated decisions.',
    style: 'balanced', bluffFreq: 0.15, tightness: 0.5,
    thinkingMessages: ['Reading the table...', 'Analyzing patterns...', 'Adjusting strategy...', 'Weighing the options...', 'Every detail matters...'],
  },
  whale: {
    name: 'The Whale', emoji: '🐋',
    description: 'Loose and passive. Calls too much, loves to see flops, rarely folds.',
    style: 'loose-passive', bluffFreq: 0.05, tightness: 0.15,
    thinkingMessages: ['I just wanna see the flop...', 'Can\'t fold now!', 'Maybe I\'ll get lucky...', 'It\'s only chips...', 'YOLO!'],
  },
  wolf: {
    name: 'The Wolf', emoji: '🐺',
    description: 'Pack hunter. Targets short stacks and smells fear at the table.',
    style: 'aggressive', bluffFreq: 0.20, tightness: 0.35,
    thinkingMessages: ['Who\'s the weakest here?', 'Hunting the short stacks...', 'Applying maximum pressure...', 'Fear is a weapon...', 'No mercy at the table...'],
  },
  turtle: {
    name: 'The Turtle', emoji: '🐢',
    description: 'Ultra-tight nit. Folds almost everything, only plays monsters.',
    style: 'tight', bluffFreq: 0.02, tightness: 0.85,
    thinkingMessages: ['Not good enough...', 'I\'ll wait for aces...', 'Fold and survive...', 'Slow and steady wins...', 'Premium hands only...'],
  },
  monkey: {
    name: 'The Monkey', emoji: '🐒',
    description: 'Chaotic and fun-loving. Makes random plays just to see what happens.',
    style: 'loose-aggressive', bluffFreq: 0.45, tightness: 0.1,
    thinkingMessages: ['What\'s the craziest play here?', 'Let\'s see what happens!', 'Chaos is a ladder!', 'Nobody expects this!', 'Random is the new meta!'],
  },
  eagle: {
    name: 'The Eagle', emoji: '🦅',
    description: 'Sharp-eyed positional player. Exploits position advantage ruthlessly.',
    style: 'balanced', bluffFreq: 0.18, tightness: 0.55,
    thinkingMessages: ['Position is everything...', 'Watching from above...', 'Swooping in at the right time...', 'Patience and precision...', 'Strike when ready...'],
  },
  bear: {
    name: 'The Bear', emoji: '🐻',
    description: 'Slow and powerful. Traps with big hands and crushes with overbets.',
    style: 'tricky', bluffFreq: 0.12, tightness: 0.55,
    thinkingMessages: ['Laying the trap...', 'They won\'t see the overbet coming...', 'Hibernating until the right moment...', 'Time to crush...', 'Brute force works...'],
  },
  cat: {
    name: 'The Cat', emoji: '🐱',
    description: 'Curious and playful. Pokes at pots with small bets to gather info.',
    style: 'balanced', bluffFreq: 0.22, tightness: 0.4,
    thinkingMessages: ['Curiosity doesn\'t always kill...', 'Let me probe a little...', 'Small bet for information...', 'Testing the waters...', 'Pouncing soon...'],
  },
};

// Pool of AI names (up to 9 AI players)
const AI_NAMES = ['Alex', 'Morgan', 'Jordan', 'Casey', 'Riley', 'Sam', 'Quinn', 'Avery', 'Dakota'];

// Returns a shuffled array of personality keys
function shufflePersonalities(count) {
  const keys = Object.keys(AI_PERSONALITIES);
  // Fisher-Yates shuffle
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys.slice(0, count);
}

// ---- Difficulty assessment for thinking time ----

function assessDifficulty(action, toCall, chips, pot) {
  if (action === 'fold' && toCall > chips * 0.3) return 'easy';
  if (action === 'check') return 'easy';
  if (action === 'fold') return 'medium';
  if (action === 'call' && toCall < pot * 0.2) return 'easy';
  if (action === 'call') return 'medium';
  if (action === 'allin') return 'hard';
  if (action === 'raise') return 'hard';
  return 'medium';
}

// ---- LLM API Integration ----

class LLMProvider {
  constructor(provider, apiKey, model) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model;
  }

  getModelName() {
    if (this.provider === 'openai') return this.model || 'gpt-5.2';
    if (this.provider === 'gemini') return this.model || 'gemini-2.5-flash';
    return 'unknown';
  }

  async getDecision(systemPrompt, userPrompt) {
    try {
      if (this.provider === 'openai') {
        return await this.callOpenAI(systemPrompt, userPrompt);
      } else if (this.provider === 'gemini') {
        return await this.callGemini(systemPrompt, userPrompt);
      }
    } catch (err) {
      console.warn('LLM API call failed:', err.message);
      return null;
    }
  }

  async callOpenAI(systemPrompt, userPrompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model || 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim();
  }

  async callGemini(systemPrompt, userPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model || 'gemini-2.5-flash'}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 150 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  }
}

// ---- AI Decision Engine ----

class AIPlayer {
  constructor(llmProvider) {
    this.llmProvider = llmProvider;
  }

  async decide(playerIndex, validActions, gameState) {
    const player = gameState.players[playerIndex];
    const personality = AI_PERSONALITIES[player.personality] || AI_PERSONALITIES.owl;

    if (this.llmProvider?.apiKey) {
      const llmDecision = await this.getLLMDecision(player, personality, validActions, gameState);
      if (llmDecision) {
        llmDecision.difficulty = assessDifficulty(llmDecision.action, validActions.toCall, player.chips, gameState.pot);
        llmDecision.source = 'llm';
        return llmDecision;
      }
    }

    const decision = this.getHeuristicDecision(player, personality, validActions, gameState);
    decision.difficulty = assessDifficulty(decision.action, validActions.toCall, player.chips, gameState.pot);
    decision.source = 'heuristic';
    return decision;
  }

  async getLLMDecision(player, personality, validActions, gameState) {
    const systemPrompt = this.buildSystemPrompt(player, personality);
    const userPrompt = this.buildUserPrompt(player, validActions, gameState);
    const response = await this.llmProvider.getDecision(systemPrompt, userPrompt);
    if (!response) return null;
    return this.parseLLMResponse(response, validActions, player);
  }

  buildSystemPrompt(player, personality) {
    return `You are ${player.name}, an AI poker player in a Texas Hold'em game.

Your playing style: ${personality.name} - ${personality.description}

You must respond with ONLY a JSON object in this exact format:
{"action": "fold|check|call|raise|allin", "amount": <number_or_null>, "thought": "<brief reasoning>"}

Rules:
- "fold": Give up your hand
- "check": Pass (only if no bet to call)
- "call": Match the current bet
- "raise": Increase the bet (amount = total new bet size, must be >= minimum raise)
- "allin": Bet all remaining chips

Think about pot odds, hand strength, position, and your playing style. Be strategic!`;
  }

  buildUserPrompt(player, validActions, gameState) {
    const holeCards = player.holeCards.map(cardToString).join(', ');
    const community = gameState.communityCards.length > 0
      ? gameState.communityCards.map(cardToString).join(', ')
      : 'None yet';
    const opponents = gameState.players
      .filter(p => p.id !== player.id && p.inHand && !p.folded)
      .map(p => `${p.name}: $${p.chips} chips, bet $${p.currentBet}${p.allIn ? ' (ALL IN)' : ''}${p.lastAction ? ' [' + p.lastAction + ']' : ''}`)
      .join('\n  ');

    return `Current game state:
- Phase: ${gameState.phase}
- Your cards: ${holeCards}
- Community cards: ${community}
- Pot: $${gameState.pot}
- Current bet to match: $${gameState.currentBet}
- Your current bet: $${player.currentBet}
- Cost to call: $${validActions.toCall}
- Minimum raise to: $${validActions.minRaise}
- Your chips: $${player.chips}
- Valid actions: ${validActions.actions.join(', ')}

Opponents still in hand:
  ${opponents}

What do you do? Respond with JSON only.`;
  }

  parseLLMResponse(response, validActions, player) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      let action = parsed.action?.toLowerCase();
      if (!validActions.actions.includes(action)) {
        if (action === 'raise' && !validActions.actions.includes('raise')) action = 'allin';
        else if (action === 'check' && !validActions.actions.includes('check')) action = 'call';
        else if (!validActions.actions.includes(action)) action = 'fold';
      }
      let amount = null;
      if (action === 'raise') {
        amount = parsed.amount || validActions.minRaise;
        amount = Math.max(amount, validActions.minRaise);
        amount = Math.min(amount, player.chips + player.currentBet);
      }
      return { action, amount };
    } catch (e) {
      console.warn('Failed to parse LLM response:', response);
      return null;
    }
  }

  // ---- Heuristic AI ----

  getHeuristicDecision(player, personality, validActions, gameState) {
    const { actions, toCall, minRaise } = validActions;

    let strength;
    if (gameState.communityCards.length === 0) {
      strength = startingHandStrength(player.holeCards[0], player.holeCards[1]);
    } else {
      const result = evaluateBest(player.holeCards, gameState.communityCards);
      strength = this.handRankToStrength(result.handRank);
    }

    const rand = Math.random();
    const bluffing = rand < personality.bluffFreq;
    const effectiveStrength = bluffing ? Math.min(strength + 0.35, 0.95) : strength;
    const potOdds = toCall > 0 ? toCall / (gameState.pot + toCall) : 0;

    // loose-passive style: call a lot, rarely raise
    if (personality.style === 'loose-passive') {
      if (toCall === 0) return { action: 'check' };
      if (toCall < player.chips * 0.3) return { action: 'call' };
      if (effectiveStrength > 0.6) return { action: 'call' };
      return { action: 'fold' };
    }

    if (effectiveStrength > 0.85) {
      if (actions.includes('raise')) {
        const raiseSize = this.calculateRaiseSize(personality, strength, gameState, minRaise, player);
        return { action: 'raise', amount: raiseSize };
      }
      if (rand < 0.1 && personality.style === 'tricky') {
        return { action: actions.includes('check') ? 'check' : 'call' };
      }
      return { action: 'allin' };
    }

    if (effectiveStrength > 0.65) {
      if (toCall === 0) {
        if (rand < 0.6 - personality.tightness * 0.3 && actions.includes('raise')) {
          return { action: 'raise', amount: this.calculateRaiseSize(personality, strength, gameState, minRaise, player) };
        }
        return { action: 'check' };
      }
      if (effectiveStrength > potOdds + 0.1) {
        if (rand < 0.3 && actions.includes('raise') && toCall < player.chips * 0.3) {
          return { action: 'raise', amount: this.calculateRaiseSize(personality, strength, gameState, minRaise, player) };
        }
        return { action: 'call' };
      }
      return { action: potOdds < 0.25 ? 'call' : 'fold' };
    }

    if (effectiveStrength > 0.45) {
      if (toCall === 0) {
        if (rand < 0.3 - personality.tightness * 0.2 && actions.includes('raise')) {
          return { action: 'raise', amount: minRaise };
        }
        return { action: 'check' };
      }
      if (effectiveStrength > potOdds && toCall < player.chips * 0.15) return { action: 'call' };
      return { action: 'fold' };
    }

    if (toCall === 0) {
      if (bluffing && actions.includes('raise') && rand < 0.15) return { action: 'raise', amount: minRaise };
      return { action: 'check' };
    }
    if (bluffing && rand < 0.1 && actions.includes('raise')) return { action: 'raise', amount: minRaise };
    return { action: 'fold' };
  }

  handRankToStrength(handRank) {
    const mapping = [0.20, 0.40, 0.55, 0.65, 0.72, 0.78, 0.84, 0.90, 0.95, 0.99];
    return mapping[handRank] || 0.20;
  }

  calculateRaiseSize(personality, strength, gameState, minRaise, player) {
    const pot = gameState.pot;
    let size;
    switch (personality.style) {
      case 'aggressive':
      case 'loose-aggressive':
        size = minRaise + Math.floor(pot * (0.5 + strength * 0.8));
        break;
      case 'tight':
        size = minRaise + Math.floor(pot * 0.4);
        break;
      case 'tricky':
        size = Math.random() < 0.5 ? minRaise : minRaise + Math.floor(pot * 0.8);
        break;
      default:
        size = minRaise + Math.floor(pot * 0.5);
    }
    size = Math.max(size, minRaise);
    size = Math.min(size, player.chips + player.currentBet);
    return size;
  }
}

export { AI_PERSONALITIES, AI_NAMES, shufflePersonalities, LLMProvider, AIPlayer };
