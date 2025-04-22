import { createServer } from "http";
import { Server, type Socket } from "socket.io"
import express from "express";
import cors from "cors";

import { createTables } from "./db/dbConnection"
import { createLogger } from "./utilities/logger";
import { checkAuth } from "./middlewares/socketAuth";
import { socketRouter } from "./routes/socketRoutes";
import { InfiniteGameLobby } from "./classes/infiniteLobby";
import { config } from "dotenv";
import { initQueue } from "./utilities/amqp";

config({ path: ".env" });
initQueue();
createTables();

const PORT = process.env.PORT || 3300;
const logger = createLogger("SERVER", "plain");
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const serverIo = io.of("/")
    .use((socket: Socket, next: Function) => checkAuth(socket, next))
    .on("connection", (socket: Socket) => socketRouter(serverIo, socket));

export const gameLobby: InfiniteGameLobby = new InfiniteGameLobby(serverIo);

app.use(cors({ origin: "*" }))

httpServer.listen(PORT, () => logger.info(`server running on port ${PORT}`));
