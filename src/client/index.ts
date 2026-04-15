import amqp from "amqplib";
import { clientWelcome, printClientHelp, getInput, commandStatus, printQuit } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { 
  ExchangePerilDirect, 
  ExchangePerilTopic, 
  PauseKey, 
  ArmyMovesPrefix, 
  WarRecognitionsPrefix 
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
    handlerWar(gs),
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
          publishJSON(
            publishCh,
            ExchangePerilTopic,
            `${ArmyMovesPrefix}.${username}`,
            move
          );
        } catch (err) {
          console.log((err as Error).message)
        }
        break;
      case "status":
        await commandStatus(gs);
        break;
      case "help":
        printClientHelp();
        break;
      case "spam":
        console.log("Spamming not allowed yet!");
        break;
      case "quit":
        printQuit();
        process.exit(0);
      default:
        console.log("Unknown command");
    } 
  }
}


main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
