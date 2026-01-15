import "@dotenvx/dotenvx/config";

import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import { connectMongoDb } from "./db/index.js";

const PORT = process.env.PORT || 8000;

try {
    await connectMongoDb();

    app.on("error", (error) => {
        console.error("Server error:", error);
        process.exit(1);
    });

    const server = http.createServer(app);

    const io = new Server(server, {
        cors: {
            origin: [
                process.env.FRONTEND_URL_LOCAL,
                process.env.FRONTEND_URL_PROD,
                "https://3tkg6xtw-3000.inc1.devtunnels.ms",
            ],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);

        socket.on("join", (userId) => {
            console.log("UserId", userId)
            socket.join(userId); // user-specific room
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected");
        });
    });

    // make io available everywhere
    app.set("io", io);

    server.listen(PORT, () =>
        console.log(`Server started at http://localhost:${PORT}`)
    );
} catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
}
