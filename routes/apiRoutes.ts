import { Router } from "express";
import { loadConfig } from "../utilities/loadConfig";

export const apiRouter = Router();

apiRouter.get("/load-config", async () => {
    try {
        await loadConfig();
    } catch (error: any) {
        console.error("error occured", error.message);
    }
})