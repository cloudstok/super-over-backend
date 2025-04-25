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
        if (!user_id || !operator_id) throw new Error("user_id and operator_id are required")
        if (limit) limit = Number(limit);
        const history = await Settlements.find(user_id, operator_id, limit);
        return res.status(200).send({ statusCode: 200, history, message: "bets history fetched successfully" })
    } catch (error: any) {
        console.error("error occured", error.message);
        return res.status(500).send({ statusCode: 500, error: error.message, message: "unable to fetch bets history" })
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