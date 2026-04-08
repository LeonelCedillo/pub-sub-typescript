import { type ConfirmChannel } from "amqplib";

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
    // serialize value to JSON bytes
    const content = Buffer.from(JSON.stringify(value));
    // publish a message to the exchange
    return new Promise((resolve, reject) => {
        ch.publish(
            exchange, 
            routingKey, 
            content, 
            { contentType: "application/json" },
            (err) => {
                if (err !== null) {
                    reject(new Error("Message was NACKed by the broker"));
                } else {
                    resolve(); // Message was ACked (confirmed/accepted) by the broker
                }
            }
        )
    });
}