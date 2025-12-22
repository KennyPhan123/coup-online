import type * as Party from "partykit/server";
import Game from "../src/game/Game.js";
import { generateCode } from "../src/game/utils.js";

// Store all active game rooms
const rooms: Map<string, Game> = new Map();

// Map connection IDs to room codes
const connectionRooms: Map<string, string> = new Map();

export default class CoupServer implements Party.Server {
    constructor(readonly room: Party.Room) { }

    onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        // Send welcome message
        conn.send(JSON.stringify({ type: "connected", id: conn.id }));
    }

    onMessage(message: string, sender: Party.Connection) {
        try {
            const data = JSON.parse(message);
            this.handleMessage(data, sender);
        } catch (e) {
            console.error("Error parsing message:", e);
        }
    }

    handleMessage(data: any, sender: Party.Connection) {
        const { type, ...payload } = data;

        switch (type) {
            case "createRoom": {
                const code = generateCode();
                const game = new Game(code, sender.id, payload.name);
                rooms.set(code, game);
                connectionRooms.set(sender.id, code);

                sender.send(JSON.stringify({
                    type: "joined",
                    code,
                    id: sender.id
                }));
                this.broadcastRoomUpdate(code);
                break;
            }

            case "joinRoom": {
                const { code, name } = payload;
                const room = rooms.get(code);

                if (room && room.addPlayer(sender.id, name)) {
                    connectionRooms.set(sender.id, code);
                    sender.send(JSON.stringify({
                        type: "joined",
                        code,
                        id: sender.id
                    }));
                    this.broadcastRoomUpdate(code);
                } else {
                    sender.send(JSON.stringify({
                        type: "error",
                        message: "Room not found or full"
                    }));
                }
                break;
            }

            case "start": {
                const code = payload.code;
                const room = rooms.get(code);
                if (room && room.start()) {
                    this.broadcastRoomUpdate(code);
                }
                break;
            }

            case "playAgain": {
                const code = payload.code;
                const room = rooms.get(code);
                if (room && room.start()) {
                    this.broadcastRoomUpdate(code);
                }
                break;
            }

            case "action": {
                const { code, type: actionType, targetId } = payload;
                const room = rooms.get(code);
                if (room) {
                    room.handleAction(sender.id, actionType, targetId);
                    this.broadcastRoomUpdate(code);
                }
                break;
            }

            case "response": {
                const { code, response, extra } = payload;
                const room = rooms.get(code);
                if (room) {
                    room.handleResponse(sender.id, response, extra);
                    this.broadcastRoomUpdate(code);
                }
                break;
            }

            case "chooseCard": {
                const { code, index } = payload;
                const room = rooms.get(code);
                if (room) {
                    if (room.state === "RESOLVING_CHALLENGE") {
                        room.resolveChallenge(index);
                    } else if (room.state === "LOSE_INFLUENCE") {
                        room.handleCardLoss(sender.id, index);
                    }
                    this.broadcastRoomUpdate(code);
                }
                break;
            }

            case "exchange": {
                const { code, roles } = payload;
                const room = rooms.get(code);
                if (room) {
                    room.handleExchange(sender.id, roles);
                    this.broadcastRoomUpdate(code);
                }
                break;
            }
        }
    }

    onClose(conn: Party.Connection) {
        const code = connectionRooms.get(conn.id);
        if (code) {
            const room = rooms.get(code);
            if (room) {
                room.handleDisconnect(conn.id);
                this.broadcastRoomUpdate(code);

                // Clean up empty rooms
                if (room.players.length === 0) {
                    rooms.delete(code);
                }
            }
            connectionRooms.delete(conn.id);
        }
    }

    broadcastRoomUpdate(code: string) {
        const room = rooms.get(code);
        if (!room) return;

        // Send personalized state to each connection in the room
        for (const conn of this.room.getConnections()) {
            const playerCode = connectionRooms.get(conn.id);
            if (playerCode === code) {
                const state = room.getSanitizedState(conn.id);
                conn.send(JSON.stringify({
                    type: "update",
                    ...state
                }));
            }
        }
    }
}
