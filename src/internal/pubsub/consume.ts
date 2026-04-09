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