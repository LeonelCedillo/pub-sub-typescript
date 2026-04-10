import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";

// This is the handler we pass into subscribeJSON that is called each time a new message is consumed.
export function handlerPause(gs:GameState): (ps: PlayingState) => void {
    return (ps: PlayingState) => {
        handlePause(gs, ps);
        process.stdout.write("> ");
    }
}