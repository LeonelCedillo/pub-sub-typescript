import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import { AckType } from "../internal/pubsub/consume.js";

// This is the handler we pass into subscribeJSON that is called each time a new message is consumed.
export function handlerPause(gs:GameState): (ps: PlayingState) => AckType {
    return (ps: PlayingState): AckType => {
        handlePause(gs, ps);
        process.stdout.write("> ");
        return AckType.Ack
    }
}


export function handlerMove(gs:GameState): (move: ArmyMove) => AckType {
    return (move: ArmyMove): AckType => {
        try {
            const outcome = handleMove(gs, move);
            switch(outcome) {
                case MoveOutcome.Safe:
                case MoveOutcome.MakeWar:
                    return AckType.Ack;
                default:
                    return AckType.NackDiscard;
            }
        } finally {
            console.log(`Moved ${move.units.length} units to ${move.toLocation}`);
            process.stdout.write("> ");
        }        
    }
}