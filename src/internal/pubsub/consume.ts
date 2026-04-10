import amqp, { type Channel } from "amqplib";


export enum SimpleQueueType {
  Durable,
  Transient,
}


// (client) Declare and bind a Queue:
export async function declareAndBind(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    key: string,
    queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
    const ch = await conn.createChannel();
    const queue = await ch.assertQueue(queueName, {
        durable: queueType === SimpleQueueType.Durable,
        exclusive: queueType === SimpleQueueType.Transient,
        autoDelete: queueType === SimpleQueueType.Transient,
    });
    await ch.bindQueue(queue.queue, exchange, key);
    return [ch, queue];
}


export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => void,
): Promise<void> {
    const [ch, queue] = await declareAndBind(
        conn, exchange, queueName, key, queueType
    );
    await ch.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;
        let data: T;
        try {
            data = JSON.parse(msg.content.toString());
        } catch(err) {
            console.error("Could not unmarshall message:", err);
            return;
        }
        handler(data);
        // Acknowledge the message to remove it from the queue
        ch.ack(msg);
    });
    
}