import { createLogger } from "./logger.js";
import { Socket } from "socket.io";

const failedBetLogger = createLogger("failedBets", "jsonl");
const failedPartialCashoutLogger = createLogger(
  "failedPartialCashout",
  "jsonl"
);
const failedCashoutLogger = createLogger("failedCashout", "jsonl");
const failedGameLogger = createLogger("failedGame", "jsonl");

interface RequestData {
  [key: string]: any; // Adjust this based on your actual request structure
}

interface ResponseData {
  [key: string]: any; // Adjust this based on your actual response structure
}

type EventType = "bet" | "game" | "cashout" | "partialCashout";

export const logEventAndEmitResponse = (
  req: RequestData,
  res: ResponseData,
  event: EventType,
  socket: Socket
): void => {
  const logData = JSON.stringify({ req, res });

  switch (event) {
    case "bet":
      failedBetLogger.error(logData);
      break;
    case "game":
      failedGameLogger.error(logData);
      break;
    case "cashout":
      failedCashoutLogger.error(logData);
      break;
    case "partialCashout":
      failedPartialCashoutLogger.error(logData);
      break;
  }

  socket.emit("betError", res);
};
