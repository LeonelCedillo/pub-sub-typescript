import { type ConfirmChannel } from "amqplib";
import { encode } from "@msgpack/msgpack";


// (server) Publish a message to the exchange 
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

// MessagePack is a binary data serialization format,
// an alternative to JSON that’s designed to be smaller and faster.
export function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
    // serialize value with MessagePack
    const body: Uint8Array = encode(value);
    const content: Buffer = Buffer.from(body);
    // publish a message to the exchange
    return new Promise((resolve, reject) => {
        ch.publish(
            exchange, 
            routingKey, 
            content, 
            { contentType: "application/x-msgpack" },
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