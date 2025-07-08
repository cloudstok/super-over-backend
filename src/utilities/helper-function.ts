import { appConfig } from './app-config';
import { createLogger } from './logger';
import { Socket } from 'socket.io';

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


function getRandomNumber(): number {
  return Math.floor(Math.random() * 13) + 1;
}



interface GameResult {
  1: string,
  2: string,
  winner: 1 | 2 | 3
}

function concatRandomSuit (val: number): string {
  const suits = ['D', 'H', 'C', 'S'];
  return `${val}-${suits[Math.floor(Math.random() * 4)]}`
}

export const getResult = (): GameResult => {

  const result: GameResult = {
    1: '',
    2: '',
    winner: 1
  };

  const batsman: number = getRandomNumber();
  const bowler: number = getRandomNumber();
  result[1] = concatRandomSuit(batsman);
  result[2] = concatRandomSuit(bowler);
  if (batsman > bowler) result['winner'] = 1;
  else if (batsman < bowler) result['winner'] = 2;
  else result['winner'] = 3;
  return result;
};

type BetResult = {
  chip: number;
  betAmount: number;
  winAmount: number;
  mult: number;
  status: 'win' | 'loss';
};


export const getBetResult = (betAmount: number, chip: number, result: number): BetResult => {
  const resultData: BetResult = {
    chip,
    betAmount,
    winAmount: 0,
    mult: (chip === 1 || chip === 2) ? 1.98 : 11,
    status: 'loss'
  };

  if (chip === result) {
    resultData.status = 'win';
    resultData.winAmount = Math.min(betAmount * resultData.mult, appConfig.maxCashoutAmount);
  }

  return resultData;
};