import type { Namespace, Socket } from "socket.io";
import { placeBetHandler } from "../services/handlers";
import { gameLobby } from "..";
import { GS } from "../utilities/loadConfig";
import { GAME_SETTINGS } from "../constants/constant";

export const socketRouter = async (io: Namespace, socket: Socket) => {
    try {
        console.log("socket connected with id:", socket.id);
        const gameState = { ...gameLobby.getCurrentRoundId(), ...gameLobby.getCurrentStatus() }
        setTimeout(() => {
            socket.emit("message", { event: "game_state", ...gameState, gameSettings: GS.GAME_SETTINGS || GAME_SETTINGS })
        }, 100);
        socket.on("message", async (data: string) => {
            const [event, roundId, betData] = data.split(":");
            switch (event) {
                case "PB":
                    await placeBetHandler(io, socket, roundId, betData)
                    break;
                default:
                    socket.emit("betError", "invalid event");
                    break;
            }
        });
        return
    } catch (error) {
        console.error("error", error);
    }
}

// PB:{roundid}:{TEAM_A}-10,10,10,100,100|TEAM_B-50,50,50,1000