import amqp from "amqplib";
import { clientWelcome, printClientHelp, getInput, commandStatus, printQuit } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";


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
  await declareAndBind(
    conn, 
    ExchangePerilDirect, 
    `${PauseKey}.${username}`, 
    PauseKey, 
    SimpleQueueType.Transient
  );

  const gs = new GameState(username);

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
          commandMove(gs, words);
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
