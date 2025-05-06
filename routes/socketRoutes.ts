import type { Namespace, Socket } from "socket.io";
import { placeBetHandler } from "../services/handlers";
import { gameLobby } from "..";
import { GS } from "../utilities/loadConfig";
import { GAME_SETTINGS } from "../constants/constant";
import { EStatusCode } from "../classes/infiniteLobby";

export const socketRouter = async (io: Namespace, socket: Socket) => {
    try {
        console.log("socket connected with id:", socket.id);
        const gameState = { ...gameLobby.getCurrentRoundId(), ...gameLobby.getCurrentStatus(), prevRoundResults: gameLobby.getPrevRoundResults(), teamInfo: gameLobby.getTeamInfo(), roundResult: gameLobby.getCurrentStatus().statusCode >= EStatusCode.sc ? gameLobby.getRoundResult() : {} }
        setTimeout(() => {
            socket.emit("message", { event: "game_state", ...gameState })
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
// PB:1745227259107:1-10,1-10,1-10,6-10,6-10