import { logger } from "..";
import { GAME_SETTINGS } from "../constants/constant";
import type { IGameSettings } from "../interfaces"
import { GameSettings } from "../models/gameSettings"

export const GS: { GAME_SETTINGS: Partial<IGameSettings> } = {
    GAME_SETTINGS: {}
}

export const loadConfig = async () => {
    const settingsArr: any[] = await GameSettings.fetchActiveSettings();
    settingsArr.forEach(settings => {
        GS.GAME_SETTINGS = settings.settings
    })
    if (!GS.GAME_SETTINGS) GS.GAME_SETTINGS = GAME_SETTINGS;
    logger.info("✅ GAME_SETTINGS loaded successfully")
}