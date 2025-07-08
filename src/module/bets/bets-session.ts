import { updateBalanceFromAccount } from '../../utilities/common-function';
import { addSettleBet, insertBets } from './bets-db';
import { appConfig } from '../../utilities/app-config';
import { setCache, getCache } from '../../utilities/redis-connection';
import { getBetResult, getUserIP, logEventAndEmitResponse } from '../../utilities/helper-function';
import { createLogger } from '../../utilities/logger';
import { Server, Socket } from 'socket.io';
import { read } from '../../utilities/db-connection';
const logger = createLogger('Bets', 'jsonl');
const settlBetLogger = createLogger('Settlement', 'jsonl');

interface BetData {
    betAmount: number;
    chip: number;
}

interface RoundResult {
    1: string,
    2: string,
    winner: number
}

type BetResult = {
    chip: number;
    betAmount: number;
    winAmount: number;
    mult: number;
    status: 'win' | 'loss';
};

interface BetObject {
    bet_id: string;
    token: string;
    socket_id: string;
    game_id: string;
    bet_amount?: number;
    userBets?: BetData[];
    lobby_id: number;
    txn_id?: string;
    ip?: string
}

interface LobbyData {
    lobbyId: number;
    status: number;
}

let lobbyData: LobbyData = { lobbyId: 0, status: 0 };
let roundBets: BetObject[] = [];

export const setCurrentLobby = (data: LobbyData) => {
    lobbyData = data;
};

export const placeBet = async (socket: Socket, betData: [string, string]) => {
    const playerDetails = await getCache(`PL:${socket.id}`);
    if (!playerDetails) {
        return socket.emit('betError', 'Invalid Player Details');
    }

    const parsedPlayerDetails = JSON.parse(playerDetails);
    const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
    const lobbyId = Number(betData[0]);
    const userBets = betData[1].split(',');
    const bet_id = `BT:${lobbyId}:${userId}:${operatorId}`;
    const betObj: BetObject = { bet_id, token, socket_id: parsedPlayerDetails.socketId, game_id, lobby_id: lobbyId };

    let totalBetAmount = 0;
    let isBetInvalid = 0;
    const bets: BetData[] = [];

    userBets.forEach((bet) => {
        const [chipStr, betAmountStr] = bet.split('-');
        const betAmount = Number(betAmountStr);
        const chip = Number(chipStr);
        const data: BetData = { betAmount, chip };

        if (betAmount <= 0 ||
            betAmount < appConfig.minBetAmount ||
            betAmount > appConfig.maxBetAmount ||
            lobbyData.lobbyId !== lobbyId || lobbyData.status !== 1) isBetInvalid = 1;


        if (![1, 2, 3].includes(chip)) isBetInvalid = 1;

        totalBetAmount += betAmount;
        bets.push(data);
    });

    if (isBetInvalid) {
        return logEventAndEmitResponse(socket, betObj, 'Invalid Bet', 'bet');
    }

    if (totalBetAmount > Number(balance)) {
        return logEventAndEmitResponse(socket, betObj, 'Insufficient Balance', 'bet');
    }

    const ip = getUserIP(socket);

    Object.assign(betObj, {
        bet_amount: totalBetAmount,
        userBets: bets,
        ip
    });


    const webhookData = await updateBalanceFromAccount({
        id: lobbyData.lobbyId,
        bet_amount: totalBetAmount,
        game_id,
        bet_id,
        ip,
        user_id: userId
    }, "DEBIT", { game_id, operatorId, token });

    if (!webhookData.status) return socket.emit("betError", "Bet Cancelled By Upstream Server");
    if (webhookData.txn_id) betObj.txn_id = webhookData.txn_id;

    roundBets.push(betObj);
    logger.info(JSON.stringify({ betObj }));

    await insertBets({
        totalBetAmount,
        bet_id,
        userBets: betObj.userBets!
    });

    parsedPlayerDetails.balance = Number(balance - totalBetAmount).toFixed(2);
    await setCache(`PL:${socket.id}`, JSON.stringify(parsedPlayerDetails));

    socket.emit("info", {
        user_id: userId,
        operator_id: operatorId,
        balance: parsedPlayerDetails.balance
    });

    return socket.emit("bet", { message: "Bet Placed successfully" });
};

export const settleBet = async (io: Server, result: RoundResult, lobbyId: number): Promise<void> => {
    try {

        if (roundBets.length > 0) {
            const bets = roundBets;
            const settlements = [];

            for (const betData of bets) {
                const { bet_id, socket_id, game_id, lobby_id, txn_id, userBets, ip, token } = betData;
                const [_, __, user_id, operator_id] = bet_id.split(':');
                let finalAmount = 0;
                let totalMultiplier = 0;
                let totalBetAmount = 0;
                const betResults: BetResult[] = [];
                userBets?.forEach(({ betAmount, chip }) => {
                    totalBetAmount += betAmount;
                    const roundResult = getBetResult(betAmount, chip, result.winner);
                    betResults.push(roundResult);
                    if (roundResult.mult > 0) {
                        totalMultiplier += roundResult.status == 'win' ? roundResult.mult : 0.00;
                        finalAmount += roundResult.winAmount;
                    }
                });

                settlements.push({
                    bet_id: betData.bet_id,
                    totalBetAmount: totalBetAmount,
                    userBets: betResults,
                    result,
                    totalMaxMult: totalMultiplier > 0 ? totalMultiplier : 0.00,
                    winAmount: finalAmount > 0 ? finalAmount : 0.00
                });

                settlBetLogger.info(JSON.stringify({ betData, finalAmount, result, totalMultiplier }));

                if (finalAmount > 0) {
                    const winAmount = Number(finalAmount).toFixed(2);
                    const webhookData = await updateBalanceFromAccount({ user_id, winning_amount: winAmount, id: lobbyId, game_id, txn_id: txn_id, ip }, 'CREDIT', { game_id, operatorId: operator_id, token });
                    if (!webhookData.status) console.error('Credit Txn Failed');

                    const cachedPlayerDetails = await getCache(`PL:${socket_id}`);
                    if (cachedPlayerDetails) {
                        const parsedPlayerDetails = JSON.parse(cachedPlayerDetails);
                        parsedPlayerDetails.balance = Number(Number(parsedPlayerDetails.balance) + finalAmount).toFixed(2);
                        await setCache(`PL:${socket_id}`, JSON.stringify(parsedPlayerDetails));
                        setTimeout(() => {
                            io.to(socket_id).emit("info",
                                {
                                    user_id,
                                    operator_id,
                                    balance: parsedPlayerDetails.balance
                                });
                        }, 100);
                    }

                    io.to(socket_id).emit('settlement', { message: `You won ${winAmount}`, mywinningAmount: winAmount, status: 'WIN', roundResult: result, betResults, lobby_id });
                } else {
                    io.to(socket_id).emit('settlement', { message: `You loss ${totalBetAmount}`, lossAmount: totalBetAmount, status: 'LOSS', roundResult: result, betResults, lobby_id });
                }
            }

            await addSettleBet(settlements);
            roundBets.length = 0;
        }

    } catch (error) {
        console.error('Error settling bets:', error);
    }
};


export const getHistory = async (socket: Socket, userId: string, operator_id: string) => {
    try {
        const historyData = await read(`SELECT lobby_id, result, created_at FROM lobbies ORDER BY created_at DESC LIMIT 3`);
        const getLastWin = await read(`SELECT win_amount FROM settlement WHERE user_id = ? and operator_id = ? ORDER BY created_at DESC LIMIT 1`, [decodeURIComponent(userId), operator_id]);
        if(getLastWin && getLastWin.length > 0) socket.emit('lastWin', { myWinningAmount: getLastWin[0].win_amount});
        return socket.emit('historyData', historyData);
    } catch (err) {
        console.error(`Err while getting user history data is:::`, err);
        return;
    }
}