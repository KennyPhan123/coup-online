const Game = require("../game/Game");
const { generateCode } = require("../game/utils");

// Store all active game rooms
const rooms = {};

/**
 * Initialize socket handlers for the game
 * @param {Object} io - Socket.IO server instance
 */
function initSocketHandlers(io) {
    io.on("connection", (socket) => {
        socket.on("createRoom", (name) => {
            const code = generateCode();
            rooms[code] = new Game(code, socket.id, name);
            socket.join(code);
            socket.emit("joined", { code, id: socket.id });
            updateRoom(io, code);
        });

        socket.on("joinRoom", ({ code, name }) => {
            const room = rooms[code];
            if (room && room.addPlayer(socket.id, name)) {
                socket.join(code);
                socket.emit("joined", { code, id: socket.id });
                updateRoom(io, code);
            } else socket.emit("error", "Room not found or full");
        });

        socket.on("start", (code) => {
            const room = rooms[code];
            if (room && room.start()) updateRoom(io, code);
        });

        socket.on("playAgain", (code) => {
            const room = rooms[code];
            if (room && room.start()) updateRoom(io, code);
        });

        socket.on("action", ({ code, type, targetId }) => {
            const room = rooms[code];
            if (room) {
                room.handleAction(socket.id, type, targetId);
                updateRoom(io, code);
            }
        });

        socket.on("response", ({ code, response, extra }) => {
            const room = rooms[code];
            if (room) {
                room.handleResponse(socket.id, response, extra);
                updateRoom(io, code);
            }
        });

        socket.on("chooseCard", ({ code, index }) => {
            const room = rooms[code];
            if (room) {
                if (room.state === "RESOLVING_CHALLENGE")
                    room.resolveChallenge(index);
                else if (room.state === "LOSE_INFLUENCE")
                    room.handleCardLoss(socket.id, index);
                updateRoom(io, code);
            }
        });

        socket.on("exchange", ({ code, roles }) => {
            const room = rooms[code];
            if (room) {
                room.handleExchange(socket.id, roles);
                updateRoom(io, code);
            }
        });

        socket.on("disconnect", () => {
            Object.values(rooms).forEach((room) => {
                if (room.getPlayer(socket.id)) {
                    room.handleDisconnect(socket.id);
                    updateRoom(io, room.code);
                    if (room.players.length === 0) delete rooms[room.code];
                }
            });
        });
    });
}

/**
 * Send updated game state to all players in a room
 * @param {Object} io - Socket.IO server instance
 * @param {string} code - Room code
 */
function updateRoom(io, code) {
    const room = rooms[code];
    if (!room) return;
    io.in(code)
        .fetchSockets()
        .then((sockets) => {
            sockets.forEach((s) =>
                s.emit("update", room.getSanitizedState(s.id)),
            );
        });
}

module.exports = { initSocketHandlers };
