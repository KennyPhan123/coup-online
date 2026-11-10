import Game from "../src/game/Game.js";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const match = url.pathname.match(/^\/ws\/([A-Z0-9]{4})$/);
        if (match) {
            if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
                return new Response("Expected a WebSocket", { status: 426 });
            }
            return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(match[1])).fetch(request);
        }
        if (url.pathname.startsWith("/ws/")) return new Response("Invalid room code", { status: 400 });
        return env.ASSETS.fetch(request);
    },
};

export class GameRoom {
    constructor(ctx) {
        this.ctx = ctx;
        this.game = null;
        ctx.blockConcurrencyWhile(async () => {
            const saved = await ctx.storage.get("game");
            if (saved) this.game = Object.assign(Object.create(Game.prototype), saved);
        });
    }

    async fetch(request) {
        const code = new URL(request.url).pathname.split("/").pop();
        const [client, server] = Object.values(new WebSocketPair());
        server.serializeAttachment({ id: crypto.randomUUID(), code, joined: false });
        this.ctx.acceptWebSocket(server);
        server.send(JSON.stringify({ type: "connected", id: server.deserializeAttachment().id }));
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(socket, message) {
        try {
            if (typeof message !== "string") return;
            const data = JSON.parse(message);
            const info = socket.deserializeAttachment();
            const send = (value) => socket.send(JSON.stringify(value));
            if (data.type === "createRoom" || data.type === "joinRoom") {
                if (info.joined || typeof data.name !== "string" || !data.name.trim()) return;
                if (data.type === "createRoom") {
                    if (this.game) return send({ type: "error", message: "Room code already in use. Please try again." });
                    this.game = new Game(info.code, info.id, data.name.trim());
                } else if (!this.game || !this.game.addPlayer(info.id, data.name.trim())) {
                    return send({ type: "error", message: "Room not found or full" });
                }
                info.joined = true;
                socket.serializeAttachment(info);
                send({ type: "joined", code: info.code, id: info.id });
            } else {
                const game = this.game;
                if (!info.joined || !game || data.code !== info.code) return;
                switch (data.type) {
                    case "start":
                        if (game.state === "LOBBY" && game.players[0]?.id === info.id) game.start();
                        break;
                    case "playAgain":
                        if (game.state === "GAME_OVER" && game.players[0]?.id === info.id) game.start();
                        break;
                    case "action": game.handleAction(info.id, data.actionType, data.targetId); break;
                    case "response": game.handleResponse(info.id, data.response, data.extra); break;
                    case "chooseCard":
                        if (game.state === "RESOLVING_CHALLENGE" && game.challenge?.accusedId === info.id && Number.isInteger(data.index) && game.getPlayer(info.id)?.hand[data.index] && !game.getPlayer(info.id).hand[data.index].revealed) game.resolveChallenge(data.index);
                        else if (game.state === "LOSE_INFLUENCE") game.handleCardLoss(info.id, data.index);
                        break;
                    case "exchange": game.handleExchange(info.id, data.roles); break;
                    default: return;
                }
            }
            await this.ctx.storage.put("game", this.game);
            this.broadcast();
        } catch (error) {
            console.error("WebSocket message error", error);
        }
    }

    async webSocketClose(socket) {
        const info = socket.deserializeAttachment();
        if (!info?.joined || !this.game) return;
        info.joined = false;
        socket.serializeAttachment(info);
        this.game.handleDisconnect(info.id);
        const remaining = this.ctx.getWebSockets().filter(ws => ws !== socket && ws.deserializeAttachment()?.joined && ws.readyState === 1);
        if (remaining.length === 0) {
            this.game = null;
            await this.ctx.storage.delete("game");
        } else {
            await this.ctx.storage.put("game", this.game);
            this.broadcast();
        }
    }

    async webSocketError(socket) {
        await this.webSocketClose(socket);
    }

    broadcast() {
        for (const socket of this.ctx.getWebSockets()) {
            const info = socket.deserializeAttachment();
            if (info?.joined && socket.readyState === 1) {
                socket.send(JSON.stringify({ type: "update", ...this.game.getSanitizedState(info.id) }));
            }
        }
    }
}
