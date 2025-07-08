import { Router } from "express";
import { GS, loadConfig } from "../utilities/loadConfig";
import type { IGameSettings } from "../interfaces";
import { Settlements } from "../models/settlements";
import { GAME_SETTINGS } from "../constants/constant";

export const apiRouter = Router();

apiRouter.get("/load-config", async (req: any, res: any) => {
    try {
        // @ts-ignore
        const settings: IGameSettings = (await loadConfig());
        return res.status(200).send({ statusCode: 200, settings, message: "settings loaded successfully" })
    } catch (error: any) {
        console.error("error occured", error.message);
    }
});

apiRouter.get("/bet-history", async (req: any, res: any) => {
    try {
        let { user_id, operator_id, limit } = req.query;
        if (!user_id || !operator_id) throw new Error("user_id and operator_id are required");
        if (limit) limit = Number(limit);

        const history = await Settlements.find(user_id, operator_id, limit);

        const transformedHistory = history.flatMap((entry: any) => {
            const betValues = entry.bet_values || {};
            const winResult = entry.win_result || {};
            const totalWinAmount = entry.win_amt || 0;
            const roundId = entry.match_id;

            const teamAName = winResult.teamA;
            const teamBName = winResult.teamB;
            const winnerCode = winResult.winner;
            const winnerTeamName =
                winnerCode === winResult.a ? teamAName :
                    winnerCode === winResult.b ? teamBName :
                        winnerCode === "TIE" ? "TIE" :
                            "UNKNOWN";

            const totalWinningStake =
                winnerTeamName !== "TIE" && betValues[winnerTeamName]
                    ? betValues[winnerTeamName]
                    : 0;

            const normalizeZero = (num: number) => (Object.is(num, -0) ? 0 : num);

            return Object.entries(betValues)
                .filter(([_, stake]: any) => stake > 0)
                .map(([teamKey, stake]: any) => {
                    let odds = winnerTeamName === "TIE" ? 0.5 : 1.98;
                    let profit = 0;
                    let loss = stake;

                    if (teamKey === winnerTeamName) {
                        profit = +(stake * odds - stake).toFixed(2);
                        loss = 0;
                    } else if (winnerTeamName === "TIE") {
                        // If it's a tie, the profit is half the stake
                        profit = +(stake * 0.5).toFixed(2);
                        loss = 0;
                    }

                    // Normalize after all logic
                    profit = + normalizeZero(profit);
                    loss = + normalizeZero(loss);

                    return {
                        round_id: roundId,
                        bet_on: teamKey,
                        odds: odds.toFixed(2),
                        stake,
                        profit,
                        loss
                    };
                });
        });


        return res.status(200).send({
            statusCode: 200,
            history: transformedHistory,
            message: "bets history split by team"
        });
    } catch (error: any) {
        console.error("error occurred", error.message);
        return res.status(500).send({
            statusCode: 500,
            error: error.message,
            message: "unable to fetch bets history"
        });
    }
});

apiRouter.get("/match-history", async (req: any, res: any) => {
    try {
        const gs = GS.GAME_SETTINGS as IGameSettings || GAME_SETTINGS;
        const { user_id, operator_id, lobby_id } = req.query;

        if (!user_id || !operator_id || !lobby_id) {
            throw new Error("user_id, lobby_id and operator_id are required");
        }

        const history = await Settlements.findByMatchId(user_id, operator_id, lobby_id);
        const winResult = history.win_result;

        const finalData: any = {
            lobby_id: history.match_id,
            user_id: history.user_id,
            operator_id: history.operator_id,
            total_bet_amount: history.bet_amt,
            winner: gs.teams[winResult.winner],
            team_a: winResult.teamA,
            team_b: winResult.teamB,
            team_a_score: winResult.teamAScore,
            team_b_score: winResult.teamBScore,
            team_a_wickets: winResult.teamAWickets,
            team_b_wickets: winResult.teamBWickets,
            bet_time: history.created_at
        };

        // Dynamically include only the teams that the user has actually bet on
        let betIndex = 1;
        for (const [team, amount] of Object.entries(history.bet_values)) {
            if (amount && amount as number > 0) {
                finalData[`Bet${betIndex}`] = {
                    team: team,
                    bet_amount: amount,
                    status: history.status,
                    win_amount: team === gs.teams[winResult.winner] ? history.win_amt : 0
                };
                betIndex++;
            }
        }

        return res.status(200).send({
            status: true,
            data: finalData
        });
    } catch (error: any) {
        console.error("error occured", error.message);
        return res.status(500).send({
            status: false,
            error: error.message,
            message: "unable to fetch match history"
        });
    }
});

