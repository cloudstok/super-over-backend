import { Router } from "express";
import { loadConfig } from "../utilities/loadConfig";
import type { IGameSettings } from "../interfaces";
import { Settlements } from "../models/settlements";

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

            return Object.entries(betValues)
                .filter(([_, stake]: any) => stake > 0)
                .map(([teamKey, stake]: any) => {
                    let odds = 0;
                    let profit = 0;
                    let loss = stake;

                    if (winnerTeamName === "TIE") {
                        odds = 1;
                        profit = 0;
                        loss = 0;
                    } else if (teamKey === winnerTeamName) {
                        odds = totalWinningStake > 0 ? +(totalWinAmount / totalWinningStake).toFixed(2) : 0;
                        profit = +(stake * odds - stake).toFixed(2);
                        loss = 0;
                    }

                    return {
                        round_id: roundId,
                        bet_on: teamKey,
                        odds,
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
        const { user_id, operator_id, match_id } = req.query;
        if (!user_id || !operator_id || !match_id) throw new Error("user_id, match_id and operator_id are required")
        const history = await Settlements.findByMatchId(user_id, operator_id, match_id);
        return res.status(200).send({ statusCode: 200, history, message: "match history fetched successfully" })
    } catch (error: any) {
        console.error("error occured", error.message);
        return res.status(500).send({ statusCode: 500, error: error.message, message: "unable to fetch match history" })
    }
});