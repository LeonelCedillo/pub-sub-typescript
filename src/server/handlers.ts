import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";
import { AckType } from "../internal/pubsub/consume.js";


export function handlerLog(): (gameLog: GameLog) => Promise<AckType>{
    return async (gameLog: GameLog): Promise<AckType> => {
        try {
            await writeLog(gameLog);
            return AckType.Ack;
        } catch (err) {
            console.error("Error writing log:", err);
            return AckType.NackDiscard;
        } finally {
            process.stdout.write("> ");
        }
    }
}