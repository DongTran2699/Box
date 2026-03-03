import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_USERS = 10;
const ADMIN_USER = "dongtran2699";

// Database Interface
interface DBAdapter {
  init(): Promise<void>;
  getMessages(roomId: string, limit: number): Promise<any[]>;
  addMessage(roomId: string, username: string, text: string, avatar?: string, replyTo?: { id: number, text: string, username: string }): Promise<any>;
  clearMessages(roomId: string): Promise<void>;
  addToWhitelist(username: string, avatar?: string): Promise<void>;
  removeFromWhitelist(username: string): Promise<void>;
  getWhitelist(): Promise<{ username: string, avatar: string }[]>;
  isWhitelisted(username: string): Promise<boolean>;
  getAvatar(username: string): Promise<string | null>;
  
  // Room methods
  createRoom(name: string, createdBy: string): Promise<any>;
  getRooms(username: string): Promise<any[]>;
  addRoomMember(roomId: number, username: string): Promise<void>;
  getRoomMembers(roomId: number): Promise<string[]>;
  updateRoom(roomId: number, name: string): Promise<void>;
  updateRoomDriveLink(roomId: number, link: string): Promise<void>;
  deleteRoom(roomId: number): Promise<void>;
  
  // Doc/Box methods
  createDoc(roomId: number, name: string, content: string, createdBy: string): Promise<any>;
  getDocs(roomId: number): Promise<any[]>;
  updateDoc(docId: number, content: string): Promise<void>;
  deleteDoc(docId: number, username: string): Promise<boolean>;

  // Note methods
  createNote(docId: number, content: string, createdBy: string): Promise<any>;
  getNotes(docId: number): Promise<any[]>;
  updateNote(noteId: number, content: string, username: string): Promise<boolean>;
  deleteNote(noteId: number, username: string): Promise<boolean>;
  
  // Helper
  getGeneralRoomId(): Promise<number>;
}

// SQLite Adapter
class SqliteAdapter implements DBAdapter {
  private db: Database.Database;

  constructor() {
    this.db = new Database("chat.db");
  }

  async init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT DEFAULT 'general',
        username TEXT,
        text TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Check if room_id column exists in messages table (for existing databases)
    const tableInfo = this.db.prepare("PRAGMA table_info(messages)").all();
    const hasRoomId = tableInfo.some((col: any) => col.name === 'room_id');
    if (!hasRoomId) {
      this.db.exec("ALTER TABLE messages ADD COLUMN room_id TEXT DEFAULT 'general'");
    }
    const hasAvatar = tableInfo.some((col: any) => col.name === 'avatar');
    if (!hasAvatar) {
      this.db.exec("ALTER TABLE messages ADD COLUMN avatar TEXT");
    }
    const hasReplyToId = tableInfo.some((col: any) => col.name === 'reply_to_id');
    if (!hasReplyToId) {
      this.db.exec("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER");
      this.db.exec("ALTER TABLE messages ADD COLUMN reply_to_text TEXT");
      this.db.exec("ALTER TABLE messages ADD COLUMN reply_to_username TEXT");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whitelist (
        username TEXT PRIMARY KEY,
        avatar TEXT DEFAULT 'user'
      )
    `);
    
    // Migration for whitelist avatar
    const whitelistInfo = this.db.prepare("PRAGMA table_info(whitelist)").all();
    const hasWhitelistAvatar = whitelistInfo.some((col: any) => col.name === 'avatar');
    if (!hasWhitelistAvatar) {
      this.db.exec("ALTER TABLE whitelist ADD COLUMN avatar TEXT DEFAULT 'user'");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_by TEXT,
        drive_link TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migration for drive_link
    const roomsInfo = this.db.prepare("PRAGMA table_info(rooms)").all();
    const hasDriveLink = roomsInfo.some((col: any) => col.name === 'drive_link');
    if (!hasDriveLink) {
      this.db.exec("ALTER TABLE rooms ADD COLUMN drive_link TEXT");
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INTEGER,
        username TEXT,
        PRIMARY KEY (room_id, username)
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        name TEXT,
        content TEXT,
        created_by TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id INTEGER,
        content TEXT,
        created_by TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ensure admin is always whitelisted
    this.db.prepare("INSERT OR IGNORE INTO whitelist (username) VALUES (?)").run(ADMIN_USER);
    // Ensure general room exists
    const general = this.db.prepare("SELECT id FROM rooms WHERE name = 'General'").get();
    if (!general) {
      this.db.prepare("INSERT INTO rooms (name, created_by) VALUES (?, ?)").run("General", ADMIN_USER);
    }
  }

  async getMessages(roomId: string, limit: number) {
    return this.db.prepare("SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?").all(roomId, limit).reverse();
  }

  async addMessage(roomId: string, username: string, text: string, avatar: string = "user", replyTo?: { id: number, text: string, username: string }) {
    let result;
    if (replyTo) {
      result = this.db.prepare("INSERT INTO messages (room_id, username, text, avatar, reply_to_id, reply_to_text, reply_to_username) VALUES (?, ?, ?, ?, ?, ?, ?)").run(roomId, username, text, avatar, replyTo.id, replyTo.text, replyTo.username);
    } else {
      result = this.db.prepare("INSERT INTO messages (room_id, username, text, avatar) VALUES (?, ?, ?, ?)").run(roomId, username, text, avatar);
    }
    return { id: result.lastInsertRowid };
  }

  async clearMessages(roomId: string) {
    this.db.prepare("DELETE FROM messages WHERE room_id = ?").run(roomId);
  }

  async addToWhitelist(username: string, avatar: string = "user") {
    this.db.prepare("INSERT OR REPLACE INTO whitelist (username, avatar) VALUES (?, ?)").run(username, avatar);
  }

  async removeFromWhitelist(username: string) {
    this.db.prepare("DELETE FROM whitelist WHERE username = ?").run(username);
  }

  async getWhitelist() {
    return this.db.prepare("SELECT username, avatar FROM whitelist").all() as { username: string, avatar: string }[];
  }

  async isWhitelisted(username: string) {
    const result = this.db.prepare("SELECT 1 FROM whitelist WHERE username = ?").get(username);
    return !!result;
  }

  async getAvatar(username: string) {
    const result = this.db.prepare("SELECT avatar FROM whitelist WHERE username = ?").get(username) as any;
    return result ? result.avatar : null;
  }

  async createRoom(name: string, createdBy: string) {
    const result = this.db.prepare("INSERT INTO rooms (name, created_by) VALUES (?, ?)").run(name, createdBy);
    const roomId = result.lastInsertRowid;
    this.db.prepare("INSERT INTO room_members (room_id, username) VALUES (?, ?)").run(roomId, createdBy);
    return { id: roomId, name, created_by: createdBy };
  }

  async getRooms(username: string) {
    // Admin sees all rooms, others see rooms they are members of
    if (username === ADMIN_USER) {
      return this.db.prepare("SELECT * FROM rooms").all();
    }
    return this.db.prepare(`
      SELECT r.* FROM rooms r 
      JOIN room_members rm ON r.id = rm.room_id 
      WHERE rm.username = ?
    `).all(username);
  }

  async addRoomMember(roomId: number, username: string) {
    this.db.prepare("INSERT OR IGNORE INTO room_members (room_id, username) VALUES (?, ?)").run(roomId, username);
  }

  async getRoomMembers(roomId: number) {
    return this.db.prepare("SELECT username FROM room_members WHERE room_id = ?").all(roomId).map((row: any) => row.username);
  }

  async updateRoom(roomId: number, name: string) {
    this.db.prepare("UPDATE rooms SET name = ? WHERE id = ?").run(name, roomId);
  }

  async updateRoomDriveLink(roomId: number, link: string) {
    this.db.prepare("UPDATE rooms SET drive_link = ? WHERE id = ?").run(link, roomId);
  }

  async deleteRoom(roomId: number) {
    this.db.prepare("DELETE FROM messages WHERE room_id = ?").run(roomId.toString());
    this.db.prepare("DELETE FROM room_members WHERE room_id = ?").run(roomId);
    this.db.prepare("DELETE FROM notes WHERE doc_id IN (SELECT id FROM docs WHERE room_id = ?)").run(roomId);
    this.db.prepare("DELETE FROM docs WHERE room_id = ?").run(roomId);
    this.db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  }

  async createDoc(roomId: number, name: string, content: string, createdBy: string) {
    const result = this.db.prepare("INSERT INTO docs (room_id, name, content, created_by) VALUES (?, ?, ?, ?)").run(roomId, name, content, createdBy);
    return { id: result.lastInsertRowid, room_id: roomId, name, content, created_by: createdBy };
  }

  async getDocs(roomId: number) {
    return this.db.prepare("SELECT * FROM docs WHERE room_id = ? ORDER BY timestamp DESC").all(roomId);
  }

  async updateDoc(docId: number, content: string) {
    this.db.prepare("UPDATE docs SET content = ? WHERE id = ?").run(content, docId);
  }

  async deleteDoc(docId: number, username: string) {
    if (username === ADMIN_USER) {
      this.db.prepare("DELETE FROM docs WHERE id = ?").run(docId);
      this.db.prepare("DELETE FROM notes WHERE doc_id = ?").run(docId);
      return true;
    }
    const result = this.db.prepare("DELETE FROM docs WHERE id = ? AND created_by = ?").run(docId, username);
    if (result.changes > 0) {
      this.db.prepare("DELETE FROM notes WHERE doc_id = ?").run(docId);
      return true;
    }
    return false;
  }

  async createNote(docId: number, content: string, createdBy: string) {
    const result = this.db.prepare("INSERT INTO notes (doc_id, content, created_by) VALUES (?, ?, ?)").run(docId, content, createdBy);
    return { id: result.lastInsertRowid, doc_id: docId, content, created_by: createdBy, timestamp: new Date().toISOString() };
  }

  async getNotes(docId: number) {
    return this.db.prepare("SELECT * FROM notes WHERE doc_id = ? ORDER BY timestamp DESC").all(docId);
  }

  async updateNote(noteId: number, content: string, username: string) {
    if (username === ADMIN_USER) {
       this.db.prepare("UPDATE notes SET content = ? WHERE id = ?").run(content, noteId);
       return true;
    }
    const result = this.db.prepare("UPDATE notes SET content = ? WHERE id = ? AND created_by = ?").run(content, noteId, username);
    return result.changes > 0;
  }

  async deleteNote(noteId: number, username: string) {
    if (username === ADMIN_USER) {
      this.db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
      return true;
    }
    const result = this.db.prepare("DELETE FROM notes WHERE id = ? AND created_by = ?").run(noteId, username);
    return result.changes > 0;
  }

  async getGeneralRoomId() {
    const room = this.db.prepare("SELECT id FROM rooms WHERE name = 'General'").get() as any;
    return room ? room.id : 0;
  }
}

// Postgres Adapter
class PostgresAdapter implements DBAdapter {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    const isProduction = process.env.NODE_ENV === "production" || connectionString.includes("railway") || connectionString.includes("neon") || connectionString.includes("supabase");
    this.pool = new pg.Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id TEXT DEFAULT 'general',
        username TEXT,
        text TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migration for existing Postgres tables
    await this.pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id TEXT DEFAULT 'general'");
    await this.pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS avatar TEXT");
    await this.pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER");
    await this.pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT");
    await this.pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_username TEXT");

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS whitelist (
        username TEXT PRIMARY KEY,
        avatar TEXT DEFAULT 'user'
      )
    `);
    await this.pool.query("ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT 'user'");

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name TEXT,
        created_by TEXT,
        drive_link TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.pool.query("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS drive_link TEXT");
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INTEGER,
        username TEXT,
        PRIMARY KEY (room_id, username)
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS docs (
        id SERIAL PRIMARY KEY,
        room_id INTEGER,
        name TEXT,
        content TEXT,
        created_by TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        doc_id INTEGER,
        content TEXT,
        created_by TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.pool.query("INSERT INTO whitelist (username) VALUES ($1) ON CONFLICT (username) DO NOTHING", [ADMIN_USER]);
    
    const general = await this.pool.query("SELECT id FROM rooms WHERE name = 'General'");
    if (general.rows.length === 0) {
      await this.pool.query("INSERT INTO rooms (name, created_by) VALUES ($1, $2)", ["General", ADMIN_USER]);
    }
  }

  async getMessages(roomId: string, limit: number) {
    const result = await this.pool.query("SELECT * FROM messages WHERE room_id = $1 ORDER BY timestamp DESC LIMIT $2", [roomId, limit]);
    return result.rows.reverse();
  }

  async addMessage(roomId: string, username: string, text: string, avatar: string = "user", replyTo?: { id: number, text: string, username: string }) {
    let result;
    if (replyTo) {
      result = await this.pool.query("INSERT INTO messages (room_id, username, text, avatar, reply_to_id, reply_to_text, reply_to_username) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id", [roomId, username, text, avatar, replyTo.id, replyTo.text, replyTo.username]);
    } else {
      result = await this.pool.query("INSERT INTO messages (room_id, username, text, avatar) VALUES ($1, $2, $3, $4) RETURNING id", [roomId, username, text, avatar]);
    }
    return { id: result.rows[0].id };
  }

  async clearMessages(roomId: string) {
    await this.pool.query("DELETE FROM messages WHERE room_id = $1", [roomId]);
  }

  async addToWhitelist(username: string, avatar: string = "user") {
    await this.pool.query("INSERT INTO whitelist (username, avatar) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET avatar = $2", [username, avatar]);
  }

  async removeFromWhitelist(username: string) {
    await this.pool.query("DELETE FROM whitelist WHERE username = $1", [username]);
  }

  async getWhitelist() {
    const result = await this.pool.query("SELECT username, avatar FROM whitelist");
    return result.rows.map((row: any) => ({ username: row.username, avatar: row.avatar }));
  }

  async isWhitelisted(username: string) {
    const result = await this.pool.query("SELECT 1 FROM whitelist WHERE username = $1", [username]);
    return result.rows.length > 0;
  }

  async getAvatar(username: string) {
    const result = await this.pool.query("SELECT avatar FROM whitelist WHERE username = $1", [username]);
    return result.rows[0]?.avatar || null;
  }

  async createRoom(name: string, createdBy: string) {
    const result = await this.pool.query("INSERT INTO rooms (name, created_by) VALUES ($1, $2) RETURNING id", [name, createdBy]);
    const roomId = result.rows[0].id;
    await this.pool.query("INSERT INTO room_members (room_id, username) VALUES ($1, $2)", [roomId, createdBy]);
    return { id: roomId, name, created_by: createdBy };
  }

  async getRooms(username: string) {
    if (username === ADMIN_USER) {
      const result = await this.pool.query("SELECT * FROM rooms");
      return result.rows;
    }
    const result = await this.pool.query(`
      SELECT r.* FROM rooms r 
      JOIN room_members rm ON r.id = rm.room_id 
      WHERE rm.username = $1
    `, [username]);
    return result.rows;
  }

  async addRoomMember(roomId: number, username: string) {
    await this.pool.query("INSERT INTO room_members (room_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roomId, username]);
  }

  async getRoomMembers(roomId: number) {
    const result = await this.pool.query("SELECT username FROM room_members WHERE room_id = $1", [roomId]);
    return result.rows.map((row: any) => row.username);
  }

  async updateRoom(roomId: number, name: string) {
    await this.pool.query("UPDATE rooms SET name = $1 WHERE id = $2", [name, roomId]);
  }

  async updateRoomDriveLink(roomId: number, link: string) {
    await this.pool.query("UPDATE rooms SET drive_link = $1 WHERE id = $2", [link, roomId]);
  }

  async deleteRoom(roomId: number) {
    await this.pool.query("DELETE FROM messages WHERE room_id = $1", [roomId.toString()]);
    await this.pool.query("DELETE FROM room_members WHERE room_id = $1", [roomId]);
    await this.pool.query("DELETE FROM notes WHERE doc_id IN (SELECT id FROM docs WHERE room_id = $1)", [roomId]);
    await this.pool.query("DELETE FROM docs WHERE room_id = $1", [roomId]);
    await this.pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);
  }

  async createDoc(roomId: number, name: string, content: string, createdBy: string) {
    const result = await this.pool.query("INSERT INTO docs (room_id, name, content, created_by) VALUES ($1, $2, $3, $4) RETURNING id", [roomId, name, content, createdBy]);
    return { id: result.rows[0].id, room_id: roomId, name, content, created_by: createdBy };
  }

  async getDocs(roomId: number) {
    const result = await this.pool.query("SELECT * FROM docs WHERE room_id = $1 ORDER BY timestamp DESC", [roomId]);
    return result.rows;
  }

  async updateDoc(docId: number, content: string) {
    await this.pool.query("UPDATE docs SET content = $1 WHERE id = $2", [content, docId]);
  }

  async deleteDoc(docId: number, username: string) {
    if (username === ADMIN_USER) {
      await this.pool.query("DELETE FROM docs WHERE id = $1", [docId]);
      await this.pool.query("DELETE FROM notes WHERE doc_id = $1", [docId]);
      return true;
    }
    const result = await this.pool.query("DELETE FROM docs WHERE id = $1 AND created_by = $2", [docId, username]);
    if (result.rowCount && result.rowCount > 0) {
      await this.pool.query("DELETE FROM notes WHERE doc_id = $1", [docId]);
      return true;
    }
    return false;
  }

  async createNote(docId: number, content: string, createdBy: string) {
    const result = await this.pool.query("INSERT INTO notes (doc_id, content, created_by) VALUES ($1, $2, $3) RETURNING id", [docId, content, createdBy]);
    return { id: result.rows[0].id, doc_id: docId, content, created_by: createdBy, timestamp: new Date().toISOString() };
  }

  async getNotes(docId: number) {
    const result = await this.pool.query("SELECT * FROM notes WHERE doc_id = $1 ORDER BY timestamp DESC", [docId]);
    return result.rows;
  }

  async updateNote(noteId: number, content: string, username: string) {
    if (username === ADMIN_USER) {
      await this.pool.query("UPDATE notes SET content = $1 WHERE id = $2", [content, noteId]);
      return true;
    }
    const result = await this.pool.query("UPDATE notes SET content = $1 WHERE id = $2 AND created_by = $3", [content, noteId, username]);
    return (result.rowCount || 0) > 0;
  }

  async deleteNote(noteId: number, username: string) {
    if (username === ADMIN_USER) {
      await this.pool.query("DELETE FROM notes WHERE id = $1", [noteId]);
      return true;
    }
    const result = await this.pool.query("DELETE FROM notes WHERE id = $1 AND created_by = $2", [noteId, username]);
    return (result.rowCount || 0) > 0;
  }

  async getGeneralRoomId() {
    const result = await this.pool.query("SELECT id FROM rooms WHERE name = 'General'");
    return result.rows[0]?.id || 0;
  }
}

// Select Adapter
let db: DBAdapter;
if (process.env.DATABASE_URL) {
  console.log("Using PostgreSQL database");
  db = new PostgresAdapter(process.env.DATABASE_URL);
} else {
  console.log("Using SQLite database");
  db = new SqliteAdapter();
}

async function startServer() {
  try {
    console.log("Initializing database...");
    await db.init();
    console.log("Database initialized successfully.");

    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
    });

    // State
    let activeUsers = new Map<string, { username: string, roomId: string, avatar: string }>(); // socketId -> { username, roomId, avatar }
    let typingUsers = new Map<string, Set<string>>(); // roomId -> Set of usernames

    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

    socket.on("join", async (data: string | { username: string, avatar: string }) => {
      let username = "";
      let inputAvatar = "user";

      if (typeof data === "string") {
        username = data;
      } else {
        username = data.username;
        inputAvatar = data.avatar || "user";
      }

      const isWhitelisted = await db.isWhitelisted(username);
      if (!isWhitelisted && username !== ADMIN_USER) {
        socket.emit("error", "Bạn không có trong danh sách được phép tham gia. Vui lòng liên hệ admin dongtran2699.");
        return;
      }

      // Get avatar from whitelist if available
      let avatar = inputAvatar;
      const dbAvatar = await db.getAvatar(username);
      if (dbAvatar) {
        avatar = dbAvatar;
      } else if (username === ADMIN_USER) {
        // Ensure admin is in whitelist with avatar if not already
        await db.addToWhitelist(ADMIN_USER, inputAvatar);
      }

      // Ensure user is in General room
      const generalRoomId = await db.getGeneralRoomId();
      const roomId = generalRoomId.toString();
      
      activeUsers.set(socket.id, { username, roomId, avatar });
      socket.join(roomId);
      
      // Add user to General room members implicitly or explicitly if needed
      // For now, getRooms handles logic, but let's ensure they are in room_members for General?
      // Actually, getRooms for non-admin only returns rooms they are in.
      // So we should add them to General if not already.
      await db.addRoomMember(generalRoomId, username);

      const rooms = await db.getRooms(username);
      socket.emit("roomsUpdate", rooms);
      
      // Join all rooms for notifications
      rooms.forEach(r => socket.join(r.id.toString()));

      const history = await db.getMessages(roomId, 500);
      socket.emit("history", { roomId, history });

      // Send docs for general room
      const docs = await db.getDocs(generalRoomId);
      socket.emit("docsUpdate", docs);

      const roomMembers = await db.getRoomMembers(generalRoomId);
      socket.emit("roomMembers", roomMembers);

      if (username === ADMIN_USER) {
        const whitelist = await db.getWhitelist();
        socket.emit("whitelistUpdate", whitelist);
      }

      // Broadcast user list for general
      const generalUsers = Array.from(activeUsers.values()).filter(u => u.roomId === roomId);
      const uniqueGeneralUsers = Array.from(new Map(generalUsers.map(u => [u.username, { username: u.username, avatar: u.avatar }])).values());
      io.to(roomId).emit("userList", uniqueGeneralUsers);
    });

    socket.on("switchRoom", async (roomId: string) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      user.roomId = roomId;

      const history = await db.getMessages(roomId, 500);
      socket.emit("history", { roomId, history });

      const docs = await db.getDocs(parseInt(roomId) || 0);
      socket.emit("docsUpdate", docs);

      const roomMembers = await db.getRoomMembers(parseInt(roomId) || 0);
      socket.emit("roomMembers", roomMembers);

      // Broadcast user list for new room
      const roomUsers = Array.from(activeUsers.values()).filter(u => u.roomId === roomId);
      const uniqueRoomUsers = Array.from(new Map(roomUsers.map(u => [u.username, { username: u.username, avatar: u.avatar }])).values());
      io.to(roomId).emit("userList", uniqueRoomUsers);
    });

    socket.on("deleteRoom", async (roomId: number) => {
      const user = activeUsers.get(socket.id);
      if (!user || user.username !== ADMIN_USER) {
        socket.emit("error", "Bạn không có quyền xóa phòng này.");
        return;
      }
      
      const generalRoomId = await db.getGeneralRoomId();
      if (roomId === generalRoomId) {
        socket.emit("error", "Không thể xóa phòng General.");
        return;
      }

      await db.deleteRoom(roomId);
      
      // Notify all users in that room to switch to General
      const roomUsers = Array.from(activeUsers.values()).filter(u => u.roomId === roomId.toString());
      for (const u of roomUsers) {
        // Find socket id for user
        for (const [sid, user] of activeUsers.entries()) {
          if (user.username === u.username) {
            io.to(sid).emit("roomDeleted", generalRoomId);
            // Also update their room list
            const rooms = await db.getRooms(u.username);
            io.to(sid).emit("roomsUpdate", rooms);
          }
        }
      }
      
      // Update room list for everyone else (admin sees all rooms)
      const allRooms = await db.getRooms(ADMIN_USER);
      // Broadcast to admin sockets
      for (const [sid, u] of activeUsers.entries()) {
        if (u.username === ADMIN_USER) {
           io.to(sid).emit("roomsUpdate", allRooms);
        }
      }
    });

    socket.on("createRoom", async (name: string) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      
      const room = await db.createRoom(name, user.username);
      socket.join(room.id.toString());
      const rooms = await db.getRooms(user.username);
      socket.emit("roomsUpdate", rooms);
    });

    socket.on("updateRoom", async ({ roomId, name }: { roomId: number, name: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user || user.username !== ADMIN_USER) {
        socket.emit("error", "Bạn không có quyền sửa tên phòng.");
        return;
      }
      
      const generalRoomId = await db.getGeneralRoomId();
      if (roomId === generalRoomId) {
        socket.emit("error", "Không thể sửa tên phòng General.");
        return;
      }

      await db.updateRoom(roomId, name);
      
      // Update room list for everyone
      // We need to iterate all users and send them their room list
      for (const [sid, u] of activeUsers.entries()) {
        const rooms = await db.getRooms(u.username);
        io.to(sid).emit("roomsUpdate", rooms);
        
        // If user is in this room, update the room name in their UI if needed (client usually updates from rooms list)
        // But we might want to emit a specific event or just rely on roomsUpdate
      }
    });

    socket.on("updateRoomDriveLink", async ({ roomId, link }: { roomId: number, link: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user || user.username !== ADMIN_USER) return;

      await db.updateRoomDriveLink(roomId, link);
      
      // Update room list for everyone
      for (const [sid, u] of activeUsers.entries()) {
        const rooms = await db.getRooms(u.username);
        io.to(sid).emit("roomsUpdate", rooms);
      }
    });

    socket.on("addRoomMember", async ({ roomId, username }: { roomId: number, username: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user || user.username !== ADMIN_USER) return;

      await db.addRoomMember(roomId, username);
      const members = await db.getRoomMembers(roomId);
      io.to(roomId.toString()).emit("roomMembers", members);
      
      // Notify the added user if online
      for (const [sid, u] of activeUsers.entries()) {
        if (u.username === username) {
          io.sockets.sockets.get(sid)?.join(roomId.toString());
          const updatedRooms = await db.getRooms(username);
          io.to(sid).emit("roomsUpdate", updatedRooms);
        }
      }
    });

    socket.on("createDoc", async ({ roomId, name, content }: { roomId: number, name: string, content: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      
      await db.createDoc(roomId, name, content, user.username);
      const docs = await db.getDocs(roomId);
      io.to(roomId.toString()).emit("docsUpdate", docs);
    });

    socket.on("updateDoc", async ({ docId, roomId, content }: { docId: number, roomId: number, content: string }) => {
      await db.updateDoc(docId, content);
      const docs = await db.getDocs(roomId);
      io.to(roomId.toString()).emit("docsUpdate", docs);
    });

    socket.on("createNote", async ({ docId, content }: { docId: number, content: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      
      await db.createNote(docId, content, user.username);
      const notes = await db.getNotes(docId);
      // We need to broadcast to everyone viewing this doc.
      // For simplicity, we can broadcast to the room, but client needs to filter?
      // Or client can join a doc room?
      // Let's just emit to the room with docId
      io.to(user.roomId).emit("notesUpdate", { docId, notes });
    });

    socket.on("getNotes", async (docId: number) => {
      const notes = await db.getNotes(docId);
      socket.emit("notesUpdate", { docId, notes });
    });

    socket.on("updateNote", async ({ noteId, docId, content }: { noteId: number, docId: number, content: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      const success = await db.updateNote(noteId, content, user.username);
      if (success) {
        const notes = await db.getNotes(docId);
        io.to(user.roomId).emit("notesUpdate", { docId, notes });
      } else {
        socket.emit("error", "Bạn không có quyền chỉnh sửa ghi chú này.");
      }
    });

    socket.on("deleteNote", async ({ noteId, docId }: { noteId: number, docId: number }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      const success = await db.deleteNote(noteId, user.username);
      if (success) {
        const notes = await db.getNotes(docId);
        io.to(user.roomId).emit("notesUpdate", { docId, notes });
      } else {
        socket.emit("error", "Bạn không có quyền xóa ghi chú này.");
      }
    });

    socket.on("deleteDoc", async ({ docId, roomId }: { docId: number, roomId: number }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      const success = await db.deleteDoc(docId, user.username);
      if (success) {
        const docs = await db.getDocs(roomId);
        io.to(roomId.toString()).emit("docsUpdate", docs);
        io.to(roomId.toString()).emit("docDeleted", docId);
      } else {
        socket.emit("error", "Bạn không có quyền xóa Box này.");
      }
    });

    socket.on("sendMessage", async (data: string | { text: string, replyTo?: { id: number, text: string, username: string } }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      let text = "";
      let replyTo;

      if (typeof data === "string") {
        text = data;
      } else {
        text = data.text;
        replyTo = data.replyTo;
      }

      const savedMsg = await db.addMessage(user.roomId, user.username, text, user.avatar, replyTo);
      
      const message = {
        id: savedMsg.id,
        username: user.username,
        text,
        avatar: user.avatar,
        timestamp: new Date().toISOString(),
        room_id: user.roomId,
        reply_to_id: replyTo?.id,
        reply_to_text: replyTo?.text,
        reply_to_username: replyTo?.username,
      };

      io.to(user.roomId).emit("message", message);
    });

    socket.on("typing", (isTyping: boolean) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      if (!typingUsers.has(user.roomId)) {
        typingUsers.set(user.roomId, new Set());
      }
      
      const roomTyping = typingUsers.get(user.roomId)!;
      if (isTyping) {
        roomTyping.add(user.username);
      } else {
        roomTyping.delete(user.username);
      }
      socket.to(user.roomId).emit("typingUpdate", Array.from(roomTyping));
    });

    socket.on("addMember", async ({ username, avatar }: { username: string, avatar: string }) => {
      if (activeUsers.get(socket.id)?.username === ADMIN_USER) {
        await db.addToWhitelist(username, avatar);
        const list = await db.getWhitelist();
        socket.emit("whitelistUpdate", list);

        // Update active user if online
        for (const [sid, u] of activeUsers.entries()) {
          if (u.username === username) {
            u.avatar = avatar;
            activeUsers.set(sid, u);
            
            // Broadcast updated user list to the room they are in
            const roomUsers = Array.from(activeUsers.values()).filter(user => user.roomId === u.roomId);
            const uniqueRoomUsers = Array.from(new Map(roomUsers.map(user => [user.username, { username: user.username, avatar: user.avatar }])).values());
            io.to(u.roomId).emit("userList", uniqueRoomUsers);
          }
        }
      }
    });

    socket.on("removeMember", async (name: string) => {
      if (activeUsers.get(socket.id)?.username === ADMIN_USER && name !== ADMIN_USER) {
        await db.removeFromWhitelist(name);
        const list = await db.getWhitelist();
        socket.emit("whitelistUpdate", list);
        
        // Disconnect user if online
        for (const [sid, u] of activeUsers.entries()) {
          if (u.username === name) {
            io.to(sid).emit("error", "Bạn đã bị xóa khỏi danh sách được phép tham gia.");
            io.sockets.sockets.get(sid)?.disconnect();
          }
        }
      }
    });

    socket.on("clearChat", async () => {
      const user = activeUsers.get(socket.id);
      if (user && user.username === ADMIN_USER) {
        await db.clearMessages(user.roomId);
        io.to(user.roomId).emit("chatCleared");
        io.to(user.roomId).emit("message", {
          username: "System",
          text: `Lịch sử trò chuyện trong phòng này đã được xóa bởi ${ADMIN_USER}.`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("disconnect", () => {
      const user = activeUsers.get(socket.id);
      if (user) {
        activeUsers.delete(socket.id);
        const roomTyping = typingUsers.get(user.roomId);
        if (roomTyping) {
          roomTyping.delete(user.username);
          io.to(user.roomId).emit("typingUpdate", Array.from(roomTyping));
        }
        
        const roomUsers = Array.from(activeUsers.values()).filter(u => u.roomId === user.roomId);
        const uniqueRoomUsers = Array.from(new Map(roomUsers.map(u => [u.username, { username: u.username, avatar: u.avatar }])).values());
        io.to(user.roomId).emit("userList", uniqueRoomUsers);
      }
    });
  });

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
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
