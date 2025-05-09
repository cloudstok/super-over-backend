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

        const enrichedHistory = history.map((entry: any) => {
            const { bet_values, win_result } = entry;
            const results: any[] = [];

            const teamA = win_result.teamA;
            const teamB = win_result.teamB;
            const winnerRaw = win_result.winner;
            const winner =
                winnerRaw === "TIE" ? "TIE" :
                    winnerRaw === 1 ? teamA :
                        winnerRaw === 2 ? teamB : null;

            Object.entries(bet_values).forEach(([team, amount]: [string, any]) => {
                let multiplier = 0;
                let win_amount = 0;

                if (winner === "TIE") {
                    multiplier = 1;
                    win_amount = amount;
                } else if (team === winner) {
                    multiplier = 1.98;
                    win_amount = Number((amount * 1.98).toFixed(2));
                }

                const profit_or_loss = Number((win_amount - amount).toFixed(2));

                results.push({
                    team,
                    bet_amount: amount,
                    win_amount,
                    multiplier,
                    result: winner,
                    profit_or_loss
                });
            });

            return {
                ...entry,
                bet_breakdown: results
            };
        });

        return res.status(200).send({
            statusCode: 200,
            history: enrichedHistory,
            message: "bets history fetched successfully"
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