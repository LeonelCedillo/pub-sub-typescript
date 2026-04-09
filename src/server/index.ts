import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  // Connection string (This is how your application will know where to connect to the RabbitMQ server):
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString); // creates a new connection to rabbitMQ
  console.log("Peril game server connected to RabbitMQ!");

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

  const publishCh = await conn.createConfirmChannel();

  printServerHelp();

  while (true) {
    const words = await getInput();
    if (words.length === 0) continue;
    const command = words[0];
    switch (command) {
      case "pause":
        console.log("Sending a pause message!");
        try {
          await publishJSON(publishCh, ExchangePerilDirect, PauseKey, { isPaused: true});
        } catch (err) {
          console.error("Error publishing message:", err);
        }
        break;
      case "resume":
        console.log("Sending a resume message!");
        try {
          await publishJSON(publishCh, ExchangePerilDirect, PauseKey, { isPaused: false});
        } catch (err) {
          console.error("Error publishing message:", err);
        }
        break;
      case "quit":
        console.log("Goodbye!");
        process.exit(0);
        break;
      default:
        console.log("Unknown command");
    } 
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
