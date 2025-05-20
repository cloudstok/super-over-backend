import type { Namespace, Socket } from "socket.io";
import { placeBetHandler } from "../services/handlers";
import { gameLobby } from "..";
import { EStatusCode } from "../classes/infiniteLobby";
import { Settlements } from "../models/settlements";
import { redisRead } from "../cache/redis";
import type { Info } from "../interfaces";

export const socketRouter = async (io: Namespace, socket: Socket) => {
    try {
        console.log("socket connected with id:", socket.id);
        const info: Info = await redisRead.getDataFromRedis(socket.id);
        let lastWin: any;
        if (info) {
            lastWin = await Settlements.fetchLastWin(info.urId, info.operatorId);
            lastWin.win_amt = lastWin.win_amt ? lastWin.win_amt.toFixed(2) : "0.00";
        }
        const gameState = { ...gameLobby.getCurrentRoundId(), ...gameLobby.getCurrentStatus(), prevRoundResults: gameLobby.getPrevRoundResults(), teamInfo: gameLobby.getTeamInfo(), roundResult: gameLobby.getCurrentStatus().statusCode >= EStatusCode.sc ? gameLobby.getRoundResult() : {} }
        setTimeout(() => {
            socket.emit("message", { event: "game_state", ...gameState })
            if (lastWin) socket.emit('lastWin', { lastWin });
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