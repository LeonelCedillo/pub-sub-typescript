import type { ConfirmChannel } from "amqplib";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import { AckType } from "../internal/pubsub/consume.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar } from "../internal/gamelogic/war.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { WarOutcome } from "../internal/gamelogic/war.js";
import { publishGameLog } from "./index.js";


// This is the handler we pass into subscribeJSON that is called each time a new message is consumed.
export function handlerPause(gs:GameState): (ps: PlayingState) => AckType {
    return (ps: PlayingState): AckType => {
        handlePause(gs, ps);
        process.stdout.write("> ");
        return AckType.Ack;
    };
}


export function handlerMove(gs:GameState, ch:ConfirmChannel): (move: ArmyMove) => Promise<AckType> {
    return async (move: ArmyMove): Promise<AckType> => {
        try {
            const outcome = handleMove(gs, move);
            switch(outcome) {
                case MoveOutcome.Safe:
                case MoveOutcome.SamePlayer:
                    return AckType.Ack;
                case MoveOutcome.MakeWar:
                    const rw: RecognitionOfWar = {
                        attacker: move.player,
                        defender: gs.getPlayerSnap(),
                    };
                    try {
                        await publishJSON(
                            ch, 
                            ExchangePerilTopic, 
                            `${WarRecognitionsPrefix}.${gs.getUsername()}`, //user consuming the move
                            rw
                        )
                        return AckType.Ack;
                    } catch(err) {
                        console.error("Error publishing war recognition:", err);
                        return AckType.NackRequeue;
                    }
                default:
                    return AckType.NackDiscard;
            }
        } finally {
            process.stdout.write("> ");
        }        
    }
}


// Handler that consumes all the war messages that the "move" handler publishes
export function handlerWar(gs:GameState, ch: ConfirmChannel): (war: RecognitionOfWar) => Promise<AckType> {
    return async (war: RecognitionOfWar): Promise<AckType> => {
        try {
            const outcome = handleWar(gs, war);
            switch (outcome.result) {
                case WarOutcome.NotInvolved:
                    // Requeue the message so that another client can pick it up and try to process it.
                    return AckType.NackRequeue;
                    // The event can only be processed successfully by a client involved in the war.
                case WarOutcome.NoUnits: 
                    return AckType.NackDiscard;
                case WarOutcome.OpponentWon:
                case WarOutcome.YouWon:
                    try {
                        await publishGameLog(
                            ch, 
                            gs.getUsername(), 
                            `${outcome.winner} won a war against ${outcome.loser}`
                        );
                        return AckType.Ack;
                    } catch (err) {
                        console.error("Error publishing game log:", err);
                        return AckType.NackRequeue;
                    }
                case WarOutcome.Draw:
                    try {
                        await publishGameLog(
                            ch, 
                            gs.getUsername(), 
                            `A war between {attacker} and {defender} resulted in a draw`
                        );
                        return AckType.Ack;
                    } catch (err) {
                        console.error("Error publishing game log:", err);
                        return AckType.NackRequeue;
                    }
                default:
                    const unreachable: never =  outcome;
                    console.log("Unexpected war resolution: ", unreachable);
                    return AckType.NackDiscard;
            } 
        } finally {
            process.stdout.write("> ");
        }   
    }
}