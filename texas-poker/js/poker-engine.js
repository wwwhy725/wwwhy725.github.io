// ============================================================
// Texas Hold'em Poker Engine
// ============================================================

const MAX_BUY_INS = 3;
const SUITS = ['♣', '♦', '♥', '♠'];
const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANK_NAMES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const HAND_RANKINGS = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind',
  'Straight Flush', 'Royal Flush'
];

// ---- Card Utilities ----

function createCard(rank, suit) {
  return { rank, suit };
}

function cardToString(card) {
  return RANK_NAMES[card.rank] + SUITS[card.suit];
}

function isRed(card) {
  return card.suit === 1 || card.suit === 2;
}

// ---- Deck ----

function createDeck() {
  const cards = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      cards.push(createCard(r, s));
    }
  }
  return cards;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ---- Hand Evaluator ----

function getCombinations(arr, k) {
  const results = [];
  function combine(start, combo) {
    if (combo.length === k) { results.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return results;
}

function evaluate5(cards) {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = -1;
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  if (ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
    isStraight = true;
    straightHigh = 3;
  }

  const freq = {};
  ranks.forEach(r => { freq[r] = (freq[r] || 0) + 1; });
  const groups = Object.entries(freq).map(([r, c]) => ({ rank: parseInt(r), count: c }));
  groups.sort((a, b) => b.count - a.count || b.rank - a.rank);

  const counts = groups.map(g => g.count);
  const groupRanks = groups.map(g => g.rank);

  let handRank, kickers;

  if (isFlush && isStraight && straightHigh === 12) {
    handRank = 9;
    kickers = [straightHigh];
  } else if (isFlush && isStraight) {
    handRank = 8;
    kickers = [straightHigh];
  } else if (counts[0] === 4) {
    handRank = 7;
    kickers = groupRanks;
  } else if (counts[0] === 3 && counts[1] === 2) {
    handRank = 6;
    kickers = groupRanks;
  } else if (isFlush) {
    handRank = 5;
    kickers = ranks;
  } else if (isStraight) {
    handRank = 4;
    kickers = [straightHigh];
  } else if (counts[0] === 3) {
    handRank = 3;
    kickers = groupRanks;
  } else if (counts[0] === 2 && counts[1] === 2) {
    handRank = 2;
    kickers = groupRanks;
  } else if (counts[0] === 2) {
    handRank = 1;
    kickers = groupRanks;
  } else {
    handRank = 0;
    kickers = ranks;
  }

  return { handRank, kickers, name: HAND_RANKINGS[handRank], cards: sorted };
}

function compareHands(a, b) {
  if (a.handRank !== b.handRank) return a.handRank - b.handRank;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? -1;
    const bk = b.kickers[i] ?? -1;
    if (ak !== bk) return ak - bk;
  }
  return 0;
}

function evaluateBest(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);
  let best = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best;
}

// ---- Starting Hand Strength (for heuristic AI) ----

function startingHandStrength(c1, c2) {
  const high = Math.max(c1.rank, c2.rank);
  const low = Math.min(c1.rank, c2.rank);
  const suited = c1.suit === c2.suit;
  const pair = c1.rank === c2.rank;

  if (pair && high >= 10) return 0.95;
  if (pair && high >= 8) return 0.85;
  if (pair && high >= 5) return 0.70;
  if (pair) return 0.55;

  if (high === 12) {
    if (low >= 10) return suited ? 0.88 : 0.82;
    if (low >= 8) return suited ? 0.72 : 0.65;
    return suited ? 0.58 : 0.50;
  }

  if (high === 11) {
    if (low >= 10) return suited ? 0.75 : 0.68;
    if (low >= 8) return suited ? 0.60 : 0.52;
    return suited ? 0.48 : 0.40;
  }

  const gap = high - low;
  let base = 0.35;
  if (gap === 1) base += 0.12;
  else if (gap === 2) base += 0.06;
  if (suited) base += 0.08;
  if (high >= 8) base += 0.05;

  return Math.min(base, 0.65);
}


// ---- Game State Machine ----

class PokerGame {
  constructor(players, smallBlind = 5, bigBlind = 10) {
    this.players = players;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.dealerIndex = -1;
    this.sbIndex = -1;
    this.bbIndex = -1;
    this.handNumber = 0;
    this.log = [];
    this.onStateChange = null;
    this.onLogMessage = null;
    this.onRequestAction = null;
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.onLogMessage) this.onLogMessage(msg);
  }

  getActivePlayers() {
    return this.players.filter(p => p.chips > 0);
  }

  buyIn(playerIndex, amount) {
    const p = this.players[playerIndex];
    if ((p.buyInCount || 0) >= MAX_BUY_INS) {
      this.addLog(`${p.name} has reached the maximum buy-in limit (${MAX_BUY_INS})`);
      return false;
    }
    p.chips += amount;
    p.totalBuyIn = (p.totalBuyIn || 0) + amount;
    p.buyInCount = (p.buyInCount || 0) + 1;
    this.addLog(`${p.name} buys in for $${amount} (${p.buyInCount}/${MAX_BUY_INS} buy-ins used)`);
    return true;
  }

  async startHand() {
    const active = this.getActivePlayers();
    if (active.length < 2) {
      this.addLog('Game over! ' + active[0]?.name + ' wins!');
      return false;
    }

    this.handNumber++;
    this.addLog(`\n--- Hand #${this.handNumber} ---`);

    // Advance dealer
    do {
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    } while (this.players[this.dealerIndex].chips <= 0);

    // Initialize hand state
    this.deck = shuffleDeck(createDeck());
    this.deckIndex = 0;
    this.communityCards = [];
    this.pot = 0;
    this.phase = 'preflop';
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.lastRaiser = -1;

    for (const p of this.players) {
      p.holeCards = [];
      p.folded = false;
      p.allIn = false;
      p.currentBet = 0;
      p.totalBetThisHand = 0;
      p.inHand = p.chips > 0;
      p.lastAction = '';
    }

    // Determine blinds
    this.sbIndex = this.nextActiveIndex(this.dealerIndex);
    this.bbIndex = this.nextActiveIndex(this.sbIndex);

    this.addLog(`Dealer: ${this.players[this.dealerIndex].name} | SB: ${this.players[this.sbIndex].name} | BB: ${this.players[this.bbIndex].name}`);

    const sbAmount = Math.min(this.smallBlind, this.players[this.sbIndex].chips);
    this.placeBet(this.sbIndex, sbAmount);
    this.addLog(`${this.players[this.sbIndex].name} posts small blind $${sbAmount}`);

    const bbAmount = Math.min(this.bigBlind, this.players[this.bbIndex].chips);
    this.placeBet(this.bbIndex, bbAmount);
    this.addLog(`${this.players[this.bbIndex].name} posts big blind $${bbAmount}`);

    this.currentBet = bbAmount;

    for (const p of this.players) {
      if (p.inHand) {
        p.holeCards = [this.dealCard(), this.dealCard()];
      }
    }
    this.addLog('Hole cards dealt');

    if (this.onStateChange) await this.onStateChange(this.getState());

    const firstActor = this.nextActiveIndex(this.bbIndex);
    await this.bettingRound(firstActor);

    if (this.countActivePlayers() <= 1) {
      await this.finishHand();
      return true;
    }

    // Early showdown: all remaining players are all-in, deal out remaining cards
    if (this.isEarlyShowdown()) {
      this.addLog('--- All players are all-in! Dealing remaining cards ---');
      await this.dealRemainingCommunity();
      await this.finishHand();
      return true;
    }

    this.phase = 'flop';
    this.communityCards.push(this.dealCard(), this.dealCard(), this.dealCard());
    this.addLog(`--- Flop: ${this.communityCards.map(cardToString).join(' ')} ---`);
    await this.resetBetsAndBet();

    if (this.countActivePlayers() <= 1) {
      await this.finishHand();
      return true;
    }

    if (this.isEarlyShowdown()) {
      this.addLog('--- All players are all-in! Dealing remaining cards ---');
      await this.dealRemainingCommunity();
      await this.finishHand();
      return true;
    }

    this.phase = 'turn';
    this.communityCards.push(this.dealCard());
    this.addLog(`--- Turn: ${cardToString(this.communityCards[3])} ---`);
    await this.resetBetsAndBet();

    if (this.countActivePlayers() <= 1) {
      await this.finishHand();
      return true;
    }

    if (this.isEarlyShowdown()) {
      this.addLog('--- All players are all-in! Dealing remaining cards ---');
      await this.dealRemainingCommunity();
      await this.finishHand();
      return true;
    }

    this.phase = 'river';
    this.communityCards.push(this.dealCard());
    this.addLog(`--- River: ${cardToString(this.communityCards[4])} ---`);
    await this.resetBetsAndBet();

    await this.finishHand();
    return true;
  }

  dealCard() {
    return this.deck[this.deckIndex++];
  }

  nextActiveIndex(fromIndex) {
    let i = (fromIndex + 1) % this.players.length;
    while (i !== fromIndex) {
      if (this.players[i].inHand && !this.players[i].folded && !this.players[i].allIn) return i;
      i = (i + 1) % this.players.length;
    }
    return fromIndex;
  }

  countActivePlayers() {
    return this.players.filter(p => p.inHand && !p.folded).length;
  }

  countCanAct() {
    return this.players.filter(p => p.inHand && !p.folded && !p.allIn).length;
  }

  isEarlyShowdown() {
    return this.countActivePlayers() > 1 && this.countCanAct() === 0;
  }

  async dealRemainingCommunity() {
    while (this.communityCards.length < 5) {
      this.communityCards.push(this.dealCard());
    }
    if (this.communityCards.length >= 3) {
      this.phase = 'showdown';
      this.addLog(`Board: ${this.communityCards.map(cardToString).join(' ')}`);
      if (this.onStateChange) await this.onStateChange(this.getState());
    }
  }

  placeBet(playerIndex, amount) {
    const p = this.players[playerIndex];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.currentBet += actual;
    p.totalBetThisHand += actual;
    this.pot += actual;
    if (p.chips === 0) p.allIn = true;
    return actual;
  }

  async resetBetsAndBet() {
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.lastRaiser = -1;
    for (const p of this.players) {
      p.currentBet = 0;
    }

    if (this.onStateChange) await this.onStateChange(this.getState());

    if (this.countCanAct() < 1) return;

    const firstActor = this.nextActiveIndex(this.dealerIndex);
    await this.bettingRound(firstActor);
  }

  async bettingRound(startIndex) {
    if (this.countCanAct() === 0) return;

    const needsToAct = new Set();
    this.players.forEach((p, i) => {
      if (p.inHand && !p.folded && !p.allIn) needsToAct.add(i);
    });

    let current = startIndex;

    while (needsToAct.size > 0) {
      const p = this.players[current];

      if (needsToAct.has(current)) {
        const prevBet = this.currentBet;
        const prevMinRaise = this.minRaise;
        const action = await this.getPlayerAction(current);
        await this.executeAction(current, action);

        if (this.onStateChange) await this.onStateChange(this.getState());

        needsToAct.delete(current);

        if (this.countActivePlayers() <= 1) return;

        // Full Bet Rule: only reopen betting if the increase is a full raise
        if (this.currentBet - prevBet >= prevMinRaise) {
          this.players.forEach((p2, i) => {
            if (i !== current && p2.inHand && !p2.folded && !p2.allIn) {
              needsToAct.add(i);
            }
          });
        }
      }

      current = (current + 1) % this.players.length;
    }
  }

  getValidActions(playerIndex) {
    const p = this.players[playerIndex];
    const toCall = this.currentBet - p.currentBet;
    const actions = [];

    actions.push('fold');

    if (toCall === 0) {
      actions.push('check');
    } else if (p.chips >= toCall) {
      // Player can afford the full call
      actions.push('call');
    }
    // If p.chips < toCall, player can only go all-in (no call option)

    if (p.chips > toCall) {
      actions.push('raise');
    }

    actions.push('allin');

    return { actions, toCall: Math.min(toCall, p.chips), minRaise: this.currentBet + this.minRaise };
  }

  async getPlayerAction(playerIndex) {
    const valid = this.getValidActions(playerIndex);
    if (this.onRequestAction) {
      return await this.onRequestAction(playerIndex, valid, this.getState());
    }
    return { action: 'fold' };
  }

  async executeAction(playerIndex, action) {
    const p = this.players[playerIndex];
    const toCall = this.currentBet - p.currentBet;

    switch (action.action) {
      case 'fold':
        p.folded = true;
        p.lastAction = 'Fold';
        this.addLog(`${p.name} folds`);
        break;

      case 'check':
        p.lastAction = 'Check';
        this.addLog(`${p.name} checks`);
        break;

      case 'call': {
        const amount = this.placeBet(playerIndex, toCall);
        if (p.allIn) {
          p.lastAction = `All-In $${p.currentBet}`;
          this.addLog(`${p.name} calls $${amount} (ALL IN)`);
        } else {
          p.lastAction = `Call $${amount}`;
          this.addLog(`${p.name} calls $${amount}`);
        }
        break;
      }

      case 'raise': {
        const raiseAmount = action.amount || (this.currentBet + this.minRaise);
        const toAdd = raiseAmount - p.currentBet;
        this.placeBet(playerIndex, toAdd);
        const raiseDiff = p.currentBet - this.currentBet;
        if (raiseDiff > 0) this.minRaise = Math.max(this.minRaise, raiseDiff);
        this.currentBet = p.currentBet;
        this.lastRaiser = playerIndex;
        p.lastAction = `Raise to $${this.currentBet}`;
        this.addLog(`${p.name} raises to $${this.currentBet}`);
        break;
      }

      case 'allin': {
        this.placeBet(playerIndex, p.chips + p.currentBet);
        if (p.currentBet > this.currentBet) {
          const raiseDiff = p.currentBet - this.currentBet;
          this.minRaise = Math.max(this.minRaise, raiseDiff);
          this.currentBet = p.currentBet;
          this.lastRaiser = playerIndex;
        }
        p.lastAction = `All-In $${p.currentBet}`;
        this.addLog(`${p.name} goes ALL IN! ($${p.currentBet})`);
        break;
      }
    }
  }

  is72Offsuit(holeCards) {
    if (!holeCards || holeCards.length !== 2) return false;
    const [c1, c2] = holeCards;
    const ranks = [c1.rank, c2.rank].sort((a, b) => a - b);
    return ranks[0] === 0 && ranks[1] === 5 && c1.suit !== c2.suit;
  }

  async finishHand() {
    this.phase = 'showdown';
    const activePlayers = this.players.filter(p => p.inHand && !p.folded);
    const allWinners = [];

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += this.pot;
      this.addLog(`${winner.name} wins $${this.pot} (everyone else folded)`);
      winner.lastAction = `Won $${this.pot}`;
      allWinners.push(winner);
    } else {
      while (this.communityCards.length < 5) {
        this.communityCards.push(this.dealCard());
      }

      const evaluations = [];
      for (const p of activePlayers) {
        const result = evaluateBest(p.holeCards, this.communityCards);
        evaluations.push({ player: p, result });
        this.addLog(`${p.name} shows ${p.holeCards.map(cardToString).join(' ')} - ${result.name}`);
      }

      const potWinners = this.calculatePotWinners(activePlayers, evaluations);
      for (const { winners, amount } of potWinners) {
        const share = Math.floor(amount / winners.length);
        const remainder = amount - share * winners.length;
        for (let i = 0; i < winners.length; i++) {
          winners[i].chips += share + (i === 0 ? remainder : 0);
        }
        const winnerNames = winners.map(w => w.name).join(', ');
        const handName = evaluations.find(e => winners.includes(e.player))?.result.name;
        this.addLog(`${winnerNames} wins $${amount} with ${handName}!`);
        winners.forEach(w => { w.lastAction = `Won $${share}!`; allWinners.push(w); });
      }
    }

    // 7-2 offsuit bounty: every player at the table pays the winner 1 BB
    for (const winner of allWinners) {
      if (this.is72Offsuit(winner.holeCards)) {
        let totalBounty = 0;
        for (const p of this.players) {
          if (p !== winner && p.inHand) {
            const payment = Math.min(this.bigBlind, p.chips);
            p.chips -= payment;
            totalBounty += payment;
          }
        }
        if (totalBounty > 0) {
          winner.chips += totalBounty;
          this.addLog(`7-2 BOUNTY! ${winner.name} wins with 7-2 offsuit! Everyone pays $${this.bigBlind} (+$${totalBounty})`);
          winner.lastAction = `Won + 7-2 Bounty!`;
        }
      }
    }

    this.pot = 0;
    if (this.onStateChange) await this.onStateChange(this.getState());
  }

  calculatePotWinners(activePlayers, evaluations) {
    const allPlayersInHand = this.players.filter(p => p.inHand);
    const bets = allPlayersInHand.map(p => ({
      player: p,
      bet: p.totalBetThisHand,
      folded: p.folded
    }));

    const betLevels = [...new Set(bets.map(b => b.bet))].sort((a, b) => a - b);
    const pots = [];
    let prevLevel = 0;

    for (const level of betLevels) {
      const increment = level - prevLevel;
      if (increment <= 0) continue;

      let potAmount = 0;
      const eligible = [];

      for (const b of bets) {
        const contribution = Math.min(b.bet, level) - Math.min(b.bet, prevLevel);
        potAmount += contribution;
        if (!b.player.folded && b.bet >= level) {
          eligible.push(b.player);
        }
      }

      if (potAmount > 0 && eligible.length > 0) {
        const eligibleEvals = evaluations.filter(e => eligible.includes(e.player));
        if (eligibleEvals.length > 0) {
          let best = eligibleEvals[0];
          for (let i = 1; i < eligibleEvals.length; i++) {
            if (compareHands(eligibleEvals[i].result, best.result) > 0) {
              best = eligibleEvals[i];
            }
          }
          const winners = eligibleEvals
            .filter(e => compareHands(e.result, best.result) === 0)
            .map(e => e.player);
          pots.push({ winners, amount: potAmount });
        }
      }

      prevLevel = level;
    }

    return pots;
  }

  getState() {
    return {
      handNumber: this.handNumber,
      phase: this.phase,
      communityCards: [...this.communityCards],
      pot: this.pot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerIndex: this.dealerIndex,
      sbIndex: this.sbIndex,
      bbIndex: this.bbIndex,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        isHuman: p.isHuman,
        inHand: p.inHand,
        folded: p.folded,
        allIn: p.allIn,
        currentBet: p.currentBet,
        holeCards: p.holeCards ? [...p.holeCards] : [],
        lastAction: p.lastAction,
        personality: p.personality,
        totalBuyIn: p.totalBuyIn || 0,
        buyInCount: p.buyInCount || 0,
      })),
    };
  }
}

export {
  SUITS, SUIT_NAMES, RANK_NAMES, HAND_RANKINGS,
  createCard, cardToString, isRed,
  createDeck, shuffleDeck,
  evaluate5, evaluateBest, compareHands,
  startingHandStrength,
  PokerGame
};
