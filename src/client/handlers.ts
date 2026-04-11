import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleMove } from "../internal/gamelogic/move.js";
import type { ArmyMove } from "../internal/gamelogic/gamedata.js";

// This is the handler we pass into subscribeJSON that is called each time a new message is consumed.
export function handlerPause(gs:GameState): (ps: PlayingState) => void {
    return (ps: PlayingState) => {
        handlePause(gs, ps);
        process.stdout.write("> ");
    }
}


export function handlerMove(gs:GameState): (move: ArmyMove) => void {
    return (move: ArmyMove): void => {
        handleMove(gs, move);
        console.log(`Moved ${move.units.length} units to ${move.toLocation}`);
        process.stdout.write("> ");
    }
}