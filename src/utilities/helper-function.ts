import { appConfig } from './app-config';
import { createLogger } from './logger';
import { Socket } from 'socket.io';
import { GameResult } from '../interface';

const failedBetLogger = createLogger('failedBets', 'jsonl');

export const logEventAndEmitResponse = (
  socket: Socket,
  req: any,
  res: string,
  event: string
): void => {
  const logData = JSON.stringify({ req, res });
  if (event === 'bet') {
    failedBetLogger.error(logData);
  }
  socket.emit('betError', res);
};

export const getUserIP = (socket: any): string => {
  const forwardedFor = socket.handshake.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0].trim();
    if (ip) return ip;
  }
  return socket.handshake.address || "";
};

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['1', '2', '3', '4', '6', '10', '13'];
const TEAMS = [
  'India', 'Australia',
  'England', 'New Zealand',
  'Pakistan', 'South Africa',
  'Sri Lanka', 'Bangladesh',
  'Afghanistan', 'West Indies',
  'Ireland', 'Zimbabwe',
  'Nepal', 'Netherlands',
  'Scotland'
]

type Suit = typeof SUITS[number];
type Rank = typeof RANKS[number];

interface Card {
  rank: Rank;
  suit: Suit;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  const randomIndex = Math.floor(Math.random() * SUITS.length);
  SUITS.push(SUITS[randomIndex]);
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}


function shuffle(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}



export const getResult = (): GameResult => {

  const teamA: string = TEAMS[Math.floor(Math.random() * TEAMS.length)];
  let teamB: string = TEAMS[Math.floor(Math.random() * TEAMS.length)];
  while (teamA == teamB) {
    teamB = TEAMS[Math.floor(Math.random() * TEAMS.length)];
  }
  const deck = shuffle(createDeck());
  const result: GameResult = {
    teamA,
    teamB,
    cardsA: [],
    cardsB: [],
    pointsA: 0,
    pointsB: 0,
    wicketA: 0,
    wicketB: 0,
    winner: 3
  };

  while (result.cardsA.length < 6 && result.wicketA < 2) {
    const card = deck.pop();
    if (card) {
      result.cardsA.push(`${card.suit}${card.rank}`);
      result.pointsA += !['13', '10'].includes(card.rank) ? Number(card.rank) : 0;
      if (card.rank == '13') result.wicketA += 1;
    }
  };

  while (result.pointsA > result.pointsB && (result.wicketB < 2 && result.cardsB.length < 6)) {
    const card = deck.pop();
    if (card) {
      result.cardsB.push(`${card.suit}${card.rank}`);
      result.pointsB += !['13', '10'].includes(card.rank) ? Number(card.rank) : 0;
      if (card.rank == '13') result.wicketB += 1;
    }
  };

  if (result.pointsA < result.pointsB) result.winner = 2;
  else if (result.pointsB < result.pointsA) result.winner = 1;
  else result.winner = 3;
  return result;
};

type BetResult = {
  chip: number;
  betAmount: number;
  winAmount: number;
  mult: number;
  status: 'win' | 'loss';
};


export const getBetResult = (betAmount: number, chip: number, result: number | null): BetResult => {
  const resultData: BetResult = {
    chip,
    betAmount,
    winAmount: 0,
    mult: result == 3 ? 0.5 : 1.98,
    status: 'loss'
  };

  if (result == 3) {
    resultData.mult = 0.5;
    resultData.status = 'win';
    resultData.winAmount = Math.min(betAmount * resultData.mult, appConfig.maxCashoutAmount);
  } else if (chip === result) {
    resultData.status = 'win';
    resultData.winAmount = Math.min(betAmount * resultData.mult, appConfig.maxCashoutAmount);
  }

  return resultData;
};