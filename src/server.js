const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { initSocketHandlers } = require("./handlers/socketHandlers");

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Initialize socket handlers
initSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
