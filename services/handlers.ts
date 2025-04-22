import { Namespace, Socket } from "socket.io";
import { gameLobby } from "../index";
import type { Info, IPlayerDetails, IRoundResult } from "../interfaces";
import { redisRead, redisWrite } from "../cache/redis";
import { getUserIP } from "../middlewares/socketAuth";
import { updateBalanceFromAccount } from "../utilities/v2Transactions";
import { GAME_SETTINGS } from "../constants/constant";
import { BetResults } from "../models/betResults";
import { Settlements } from "../models/settlements";

// bet format with event ->
// PB:1745227259107:6-10,6-10,6-50,1-10,1-10,1-100

export const placeBetHandler = async (io: Namespace, socket: Socket, roundId: string | number, betData: string) => {
    try {

        const info: Info = await redisRead.getDataFromRedis(socket.id);
        if (!info) return socket.emit("betError", "player details not found in cache");

        const gameStatus = gameLobby.getCurrentStatus();
        if (gameStatus.statusCode !== 3) return socket.emit("betError", gameStatus.statusCode < 3 ? "not accepting bets for this round" : "bets closed for this round");

        const curRndId = gameLobby.getCurrentRoundId();
        if (Number(roundId) !== curRndId.roundId) return socket.emit("betError", "invalid roundId");

        const teamsInfo = gameLobby.getTeamInfo();
        if (!teamsInfo) return socket.emit("betError", "unable to fetch teams info");

        const betsArr = betData.split(",");
        const userBet: Record<string, number> = {}

        betsArr.forEach(bet => {
            let [teamNum, betAmt] = bet.split("-");
            let tNo = Number(teamNum);
            let amt = Number(betAmt);
            if (isNaN(tNo) || isNaN(amt) || tNo < 0 || tNo > 7 || amt % 10 !== 0) return socket.emit("betError", "invalid bet payload");
            if (teamsInfo.a !== tNo && teamsInfo.b !== tNo) return socket.emit("betError", "invalid team number");
            if (userBet[tNo]) userBet[tNo] += amt;
            else userBet[tNo] = amt;
        })
        console.log("userBet", userBet);

        const totalBetAmount = Object.values(userBet).reduce((acc, val) => acc + val, 0);
        console.log("totalBetAmount", totalBetAmount);

        const matchId = `${curRndId.roundId}`;
        const userIp = getUserIP(socket)
        const plrTxnDtl = { game_id: info.gmId, operatorId: info.operatorId, token: info.token };
        const txnDtl = { id: matchId, bet_amount: totalBetAmount, game_id: info.gmId, user_id: info.urId, ip: userIp };

        // debit, update info and emit 
        const dbtTxn: any = await updateBalanceFromAccount(txnDtl, "DEBIT", plrTxnDtl);
        if (!dbtTxn) return socket.emit("betError", "Bet Cancelled By Upstream Server.")
        info.bl -= totalBetAmount;
        await redisWrite.setDataToRedis(socket.id, info);

        let roundBets = await redisRead.getDataFromRedis(matchId);
        if (!roundBets || !Array.isArray(roundBets)) roundBets = {};

        roundBets[`${info.urId}`] = { ...dbtTxn, ...info, ...userBet };
        await redisWrite.setDataToRedis(matchId, roundBets);
        await BetResults.create({
            user_id: info.urId,
            match_id: matchId,
            operator_id: info.operatorId,
            bet_amt: totalBetAmount,
            bet_values: userBet,
            team_info: teamsInfo
        })

        console.log("place bet-----", roundBets, "-----place bet");

        socket.emit("info", { urId: info.urId, urNm: info.urNm, bl: info.bl, operatorId: info.operatorId });
        return socket.emit("message", { event: "bet_result", message: "bet has been accepted successfully" });

    } catch (error: any) {
        console.error("error during placing bet", error.message);
        return socket.emit("betError", { event: "bet_result", message: "unable to place bet", error: error.message });
    }
}

export const settlementHandler = async (io: Namespace) => {
    try {
        const curRndId = gameLobby.getCurrentRoundId();
        const matchId = `${curRndId.roundId}`;

        const roundBets = await redisRead.getDataFromRedis(matchId);
        if (!roundBets || !Object.keys(roundBets).length) return console.error("no bets found for roundId:", matchId);

        const roundResult: IRoundResult = gameLobby.getRoundResult();

        Object.keys(roundBets).forEach(userId => {
            let ttlWinAmt = 0
            if (roundBets[userId][roundResult.winner]) ttlWinAmt += Number(roundBets[userId][roundResult.winner]) * GAME_SETTINGS.win_mult;
            roundBets[userId]["winning_amount"] = ttlWinAmt;
            console.log("ttlWinAmt", ttlWinAmt);
        })

        Object.keys(roundBets).forEach(async (userId) => {
            if (roundBets[userId]["winning_amount"]) {

                const playerDetails: IPlayerDetails = {
                    game_id: roundBets[userId]?.gmId,
                    operatorId: roundBets[userId]?.operatorId,
                    token: roundBets[userId]?.token
                }
                const cdtRes = await updateBalanceFromAccount(roundBets[userId], "CREDIT", playerDetails);
                if (!cdtRes) console.error("credit txn failed for user_id", userId);

                let plInfo: Info = await redisRead.getDataFromRedis(roundBets[userId].sid);
                plInfo.bl += Number(roundBets[userId]["winning_amount"] || 0);
                await redisWrite.setDataToRedis(plInfo.sid, plInfo);

                io.to(plInfo.sid).emit("message", { event: "settlement", winAmt: roundBets[userId]["winning_amount"] })
            }
            let aBetAmt = roundBets[userId][roundResult.a];
            let bBetAmt = roundBets[userId][roundResult.b];
            let sumAB = Number(aBetAmt) + Number(bBetAmt);
            const betValues: Record<string, number> = {
                [`${roundResult.a}`]: aBetAmt || 0,
                [`${roundResult.b}`]: bBetAmt || 0,
            };

            await Settlements.create({
                user_id: userId,
                match_id: matchId,
                operator_id: roundBets[userId]?.operatorId,
                bet_amt: !isNaN(sumAB) ? sumAB : (aBetAmt ? aBetAmt : bBetAmt),
                win_amt: Number(roundBets[userId]["winning_amount"] || 0),
                bet_values: betValues,
                win_result: roundResult,
                status: roundBets[userId]["winning_amount"] ? "WIN" : "LOSS"
            })
        });



        return await redisWrite.delDataFromRedis(matchId);

    } catch (error: any) {
        console.error("error during settlement", error.message);
        return io.emit("betError", { event: "settlement", message: "unable to process settlements", error: error.message })
    }
}