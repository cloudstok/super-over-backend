import { redisWrite } from "../cache/redis";
import type { Info, IUserDetailResponse } from "../interfaces";
import { Socket } from "socket.io";

export const checkAuth = async (socket: Socket, next: Function) => {
    try {
        const token: string = socket.handshake.query?.token as string;
        const game_id: string = socket.handshake.query?.game_id as string;
        const userIP = getUserIP(socket);
        console.log({ token, game_id, userIP });
        if (!token) {
            return next(new Error("Authentication error: Invalid token"));
        }
        const newUser = await getUserDetail({ token });
        if (!newUser || newUser.status === false) {
            console.log("Authentication failed: User not found or invalid token");
            return next(
                new Error("Authentication error: Failed to authenticate user")
            );
        }

        const info: Info = {
            urId: newUser.user.user_id,
            urNm: newUser.user.name,
            bl: Number(newUser.user.balance),
            operatorId: newUser.user.operatorId,
            gmId: game_id,
            sid: socket.id,
            token: token
        };

        await redisWrite.setDataToRedis(socket.id, info);
        setTimeout(() => {
            socket.emit("info", { urId: info.urId, urNm: info.urNm, bl: info.bl, operatorId: info.operatorId });
        }, 50);
        next();
    } catch (error: any) {
        console.error("Authentication error:", error.message);
        next(new Error("Authentication error: " + error.message));
    }
};

export const getUserDetail = async ({ token }: { token: string }): Promise<IUserDetailResponse> => {
    const url = `${process.env.service_base_url}/service/user/detail`;
    console.log(url);
    try {
        if (!token) throw new Error("Invalid token");
        const resp = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json", token },
        });
        if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        const respJson = (await resp.json()) as IUserDetailResponse;
        if (respJson.status === false) {
            throw new Error("Invalid token or user not found");
        }
        return respJson;
    } catch (error: any) {
        console.error("Error fetching user details:", error.message);
        throw error;
    }
};

export const getUserIP = (socket: any): string => {
    const forwardedFor = socket.handshake.headers?.["x-forwarded-for"];
    if (forwardedFor) {
        const ip = forwardedFor.split(",")[0].trim();
        if (ip) return ip;
    }
    return socket.handshake.address || "";
};
