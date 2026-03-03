import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("chat.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS whitelist (
    username TEXT PRIMARY KEY
  )
`);

// Ensure admin is always whitelisted
db.prepare("INSERT OR IGNORE INTO whitelist (username) VALUES (?)").run("dongtran2699");

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
    connectionStateRecovery: {
      // the backup duration of the sessions and the packets
      maxDisconnectionDuration: 2 * 60 * 1000,
      // whether to skip middlewares upon successful recovery
      skipMiddlewares: true,
    },
  });

  const PORT = 3000;
  const MAX_USERS = 10;
  const ADMIN_USER = "dongtran2699";

  // State
  let activeUsers = new Map<string, string>(); // socketId -> username
  let typingUsers = new Set<string>(); // username

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    if (socket.recovered) {
      // recovery was successful: socket.id, socket.rooms and socket.data were restored
      console.log("Session recovered for:", socket.id);
    }

    socket.on("join", (username: string) => {
      // Check whitelist
      const isWhitelisted = db.prepare("SELECT 1 FROM whitelist WHERE username = ?").get(username);
      if (!isWhitelisted && username !== ADMIN_USER) {
        socket.emit("error", "Bạn không có trong danh sách được phép tham gia. Vui lòng liên hệ admin dongtran2699.");
        return;
      }

      // Check if user is already in
      const currentUsers = Array.from(activeUsers.values());
      
      if (currentUsers.length >= MAX_USERS && !currentUsers.includes(username)) {
        socket.emit("error", "Phòng đã đầy (tối đa 10 người).");
        return;
      }

      activeUsers.set(socket.id, username);
      
      // Send history
      const history = db.prepare("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50").all().reverse();
      socket.emit("history", history);
      
      // Send whitelist if admin
      if (username === ADMIN_USER) {
        const whitelist = db.prepare("SELECT username FROM whitelist").all().map((row: any) => row.username);
        socket.emit("whitelistUpdate", whitelist);
      }

      // Broadcast join
      io.emit("userList", Array.from(new Set(activeUsers.values())));
      io.emit("message", {
        username: "System",
        text: `${username} đã tham gia cuộc trò chuyện.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("addMember", (newUsername: string) => {
      const admin = activeUsers.get(socket.id);
      if (admin === ADMIN_USER) {
        try {
          db.prepare("INSERT OR IGNORE INTO whitelist (username) VALUES (?)").run(newUsername);
          const whitelist = db.prepare("SELECT username FROM whitelist").all().map((row: any) => row.username);
          socket.emit("whitelistUpdate", whitelist);
          io.emit("message", {
            username: "System",
            text: `Admin đã thêm ${newUsername} vào danh sách thành viên.`,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Error adding member:", e);
        }
      }
    });

    socket.on("removeMember", (targetUsername: string) => {
      const admin = activeUsers.get(socket.id);
      if (admin === ADMIN_USER && targetUsername !== ADMIN_USER) {
        db.prepare("DELETE FROM whitelist WHERE username = ?").run(targetUsername);
        const whitelist = db.prepare("SELECT username FROM whitelist").all().map((row: any) => row.username);
        socket.emit("whitelistUpdate", whitelist);
        
        // Disconnect the user if they are currently online
        for (const [sid, uname] of activeUsers.entries()) {
          if (uname === targetUsername) {
            const targetSocket = io.sockets.sockets.get(sid);
            if (targetSocket) {
              targetSocket.emit("error", "Bạn đã bị xóa khỏi danh sách thành viên.");
              targetSocket.disconnect();
            }
          }
        }

        io.emit("message", {
          username: "System",
          text: `Admin đã xóa ${targetUsername} khỏi danh sách thành viên.`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("sendMessage", (text: string) => {
      const username = activeUsers.get(socket.id);
      if (!username) return;

      const message = {
        username,
        text,
        timestamp: new Date().toISOString(),
      };

      // Save to DB
      db.prepare("INSERT INTO messages (username, text) VALUES (?, ?)").run(username, text);

      io.emit("message", message);
    });

    socket.on("clearChat", () => {
      const username = activeUsers.get(socket.id);
      if (username === ADMIN_USER) {
        db.prepare("DELETE FROM messages").run();
        io.emit("chatCleared");
        io.emit("message", {
          username: "System",
          text: "Lịch sử trò chuyện đã được xóa bởi admin.",
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("typing", (isTyping: boolean) => {
      const username = activeUsers.get(socket.id);
      if (username) {
        if (isTyping) {
          typingUsers.add(username);
        } else {
          typingUsers.delete(username);
        }
        socket.broadcast.emit("typingUpdate", Array.from(typingUsers));
      }
    });

    socket.on("disconnect", () => {
      const username = activeUsers.get(socket.id);
      if (username) {
        activeUsers.delete(socket.id);
        typingUsers.delete(username);
        io.emit("userList", Array.from(new Set(activeUsers.values())));
        io.emit("typingUpdate", Array.from(typingUsers));
        io.emit("message", {
          username: "System",
          text: `${username} đã rời cuộc trò chuyện.`,
          timestamp: new Date().toISOString(),
        });
      }
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
