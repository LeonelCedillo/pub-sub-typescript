import amqp, { type ConfirmChannel } from "amqplib";
import type { GameLog } from "../internal/gamelogic/logs.js";
import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import { SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { 
  clientWelcome, printClientHelp, getInput, 
  commandStatus, printQuit, getMaliciousLog 
} from "../internal/gamelogic/gamelogic.js";
import { 
  ExchangePerilDirect, ExchangePerilTopic, 
  PauseKey, ArmyMovesPrefix, 
  WarRecognitionsPrefix, GameLogSlug
} from "../internal/routing/routing.js";


async function main() {
  // Connect to rabbit (same as the server)
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Peril game client connected to RabbitMQ!");

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const username = await clientWelcome();
  const gs = new GameState(username);
  const publishCh = await conn.createConfirmChannel();

  // For each client,
  // Declares a queue and binds it to an Exhange,
  // And consumes a new message from that queue.
  await subscribeJSON(
    conn, 
    ExchangePerilDirect, 
    `${PauseKey}.${username}`, // Queue: pause.username
    PauseKey, 
    SimpleQueueType.Transient, 
    handlerPause(gs)
  );

  await subscribeJSON(
    conn, 
    ExchangePerilTopic, 
    `${ArmyMovesPrefix}.${username}`, // Queue: army_moves.username
    `${ArmyMovesPrefix}.*`, 
    SimpleQueueType.Transient, 
    handlerMove(gs, publishCh)
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    WarRecognitionsPrefix, // Queue: war
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gs, publishCh),
  );

  while (true) {
    const words = await getInput();
    if (words.length === 0) continue;
    const command = words[0];
    switch (command) {
      case "spawn":
        try {
          commandSpawn(gs, words);
        } catch (err) {
          console.log((err as Error).message)
        }
        break;
      case "move":
        try {
          const move: ArmyMove = commandMove(gs, words);
          await publishJSON(
            publishCh,
            ExchangePerilTopic,
            `${ArmyMovesPrefix}.${username}`,
            move
          );
        } catch (err) {
          console.log((err as Error).message);
        }
        break;
      case "status":
        await commandStatus(gs);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        if (words.length < 2) {
          console.log("usage: spam <n>");
          continue;
        }
        const raw = words[1];
        if (!raw) {
          console.log("usage: spam <n>");
          continue;
        }
        const n = parseInt(raw, 10);
        if (isNaN(n)) {
          console.log(`error: ${words[1]} is not a valid number`);
          continue;
        }
        for (let i = 0; i < n; i++) {
          try {
            await publishGameLog(publishCh, gs.getUsername(), getMaliciousLog());
          } catch(err) {
            console.error(
              "Failed to publish spam message:",
              (err as Error).message,
            );
            continue;
          }
        }        
        console.log(`Published ${n} malicious logs`);
        break;
      case "quit":
        printQuit();
        process.exit(0);
      default:
        console.log("Unknown command");
    } 
  }
}



export function publishGameLog(ch: ConfirmChannel, username: string, message: string): Promise<void> {
  const log: GameLog = {
    currentTime: new Date(),
    message, // description of the war event
    username, // player who initiated the war
  }
  return publishMsgPack(
    ch, 
    ExchangePerilTopic, 
    `${GameLogSlug}.${username}`, 
    log
  );
}



main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
