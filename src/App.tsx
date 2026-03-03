import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import TextareaAutosize from "react-textarea-autosize";
import { 
  Send, User, LogOut, Trash2, Users, MessageSquare, 
  UserPlus, X, ShieldCheck, Wifi, WifiOff, Menu, 
  Plus, Hash, FileText, ChevronRight, Save, Edit3,
  Zap, Star, Heart, Smile, Eraser, Reply, Moon, Sun, ExternalLink, Eye
} from "lucide-react";

type Message = {
  id?: number;
  username: string;
  text: string;
  avatar?: string;
  timestamp: string;
  room_id?: string;
  reply_to_id?: number;
  reply_to_text?: string;
  reply_to_username?: string;
};

type UserInfo = {
  username: string;
  avatar: string;
};

type Room = {
  id: number;
  name: string;
  created_by: string;
  drive_link?: string;
};

type Doc = {
  id: number;
  room_id: number;
  name: string;
  content: string; // Description
  created_by: string;
  timestamp: string;
};

type Note = {
  id: number;
  doc_id: number;
  content: string;
  created_by: string;
  timestamp: string;
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("user");
  const [isJoined, setIsJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [currentBox, setCurrentBox] = useState<Doc | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [whitelist, setWhitelist] = useState<{ username: string, avatar: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberAvatar, setNewMemberAvatar] = useState("user");
  const [newRoomName, setNewRoomName] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [activeTab, setActiveTab] = useState<"chat" | "docs">("chat");
  const [allRoomMembers, setAllRoomMembers] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentBoxRef = useRef<Doc | null>(null);
  const currentRoomRef = useRef<Room | null>(null);

  useEffect(() => {
    currentBoxRef.current = currentBox;
  }, [currentBox]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const ADMIN_USER = "dongtran2699";

  useEffect(() => {
    const savedUsername = localStorage.getItem("chat_username");
    const savedAvatar = localStorage.getItem("chat_avatar");
    if (savedUsername) {
      setUsername(savedUsername);
    }
    if (savedAvatar) {
      setAvatar(savedAvatar);
    }

    const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;
    console.log("Initializing socket connection to:", SOCKET_URL || "default host");
    
    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket", "polling"]
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);
      setIsConnecting(false);
      const currentUname = localStorage.getItem("chat_username");
      const currentAvatar = localStorage.getItem("chat_avatar") || "user";
      if (currentUname) {
        console.log("Auto-joining as:", currentUname);
        newSocket.emit("join", { username: currentUname, avatar: currentAvatar });
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      setIsConnecting(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setIsConnected(false);
      setIsConnecting(false);
    });

    newSocket.on("reconnect_attempt", (attempt) => {
      console.log("Socket reconnect attempt:", attempt);
      setIsConnecting(true);
    });

    newSocket.on("reconnect", () => {
      setIsConnected(true);
      setIsConnecting(false);
    });

    newSocket.on("message", (msg: Message) => {
      // Only add message if it belongs to current room
      if (msg.room_id && currentRoomRef.current && msg.room_id !== currentRoomRef.current.id.toString()) {
        return;
      }
      setMessages((prev) => {
        if (msg.id && prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.username !== username && msg.username !== "System") {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
    });

    newSocket.on("typingUpdate", (users: string[]) => {
      setTypingUsers(users.filter(u => u !== username));
    });

    newSocket.on("history", ({ roomId, history }: { roomId: string, history: Message[] }) => {
      if (currentRoomRef.current && roomId === currentRoomRef.current.id.toString()) {
        setMessages((prev) => {
          // Merge history with existing messages (in case some arrived before history)
          // Deduplicate by ID if available, otherwise by timestamp+text+username
          const existingIds = new Set(prev.map(m => m.id).filter(id => id !== undefined));
          const newHistory = history.filter(m => m.id === undefined || !existingIds.has(m.id));
          
          // Combine and sort by timestamp
          const combined = [...newHistory, ...prev].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          return combined;
        });
      }
    });

    newSocket.on("userList", (userList: UserInfo[]) => {
      setUsers(userList);
    });

    newSocket.on("roomsUpdate", (roomList: Room[]) => {
      setRooms(roomList);
      setCurrentRoom(prev => {
        if (!prev) {
          const general = roomList.find(r => r.name === "General");
          return general || roomList[0];
        }
        const updated = roomList.find(r => r.id === prev.id);
        return updated || prev;
      });
    });

    newSocket.on("chatCleared", () => {
      setMessages([]);
    });

    newSocket.on("roomMembers", (members: string[]) => {
      setAllRoomMembers(members);
    });

    newSocket.on("docsUpdate", (docList: Doc[]) => {
      setDocs(docList);
    });

    newSocket.on("notesUpdate", ({ docId, notes }: { docId: number, notes: Note[] }) => {
      if (currentBoxRef.current?.id === docId) {
        setNotes(notes);
      }
    });

    newSocket.on("docDeleted", (docId: number) => {
      if (currentBoxRef.current?.id === docId) {
        setCurrentBox(null);
      }
    });

    newSocket.on("whitelistUpdate", (list: { username: string, avatar: string }[]) => {
      setWhitelist(list);
    });

    newSocket.on("error", (err: string) => {
      setError(err);
      setIsJoined(false);
    });

    newSocket.on("roomDeleted", (generalRoomId: number) => {
      // Force switch to General room if current room is deleted
      if (currentRoomRef.current?.id !== generalRoomId) {
        // We need to find the general room object. 
        // Since we might not have the full list updated yet, we can rely on roomsUpdate or just fetch.
        // But simpler: just reload or let roomsUpdate handle it.
        // Actually, let's just alert and reload for safety or wait for roomsUpdate.
        // Better:
        alert("Phòng này đã bị xóa.");
        window.location.reload();
      }
    });

    return () => {
      newSocket.close();
    };
  }, []); // Removed dependency on currentRoom

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingUsers]);

  const AVATARS = [
    { id: "user", icon: User, color: "bg-zinc-100 text-zinc-600" },
    { id: "zap", icon: Zap, color: "bg-yellow-100 text-yellow-600" },
    { id: "star", icon: Star, color: "bg-indigo-100 text-indigo-600" },
    { id: "heart", icon: Heart, color: "bg-rose-100 text-rose-600" },
    { id: "smile", icon: Smile, color: "bg-emerald-100 text-emerald-600" },
  ];

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && socket) {
      socket.emit("join", { username: username.trim(), avatar });
      setIsJoined(true);
      setError("");
      localStorage.setItem("chat_username", username.trim());
      localStorage.setItem("chat_avatar", avatar);
    }
  };

  const handleSwitchRoom = (room: Room) => {
    if (socket && room.id !== currentRoom?.id) {
      setMessages([]); // Clear messages immediately when switching
      socket.emit("switchRoom", room.id.toString());
      setCurrentRoom(room);
      setIsSidebarOpen(false);
      setActiveTab("chat");
    }
  };

  const handleDeleteRoom = (roomId: number, roomName: string) => {
    if (socket && confirm(`Bạn có chắc chắn muốn xóa phòng "${roomName}"?`)) {
      socket.emit("deleteRoom", roomId);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim() && socket) {
      socket.emit("createRoom", newRoomName.trim());
      setNewRoomName("");
      setShowRoomModal(false);
    }
  };

  const handleAddRoomMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemberName.trim() && currentRoom && socket) {
      socket.emit("addRoomMember", { roomId: currentRoom.id, username: newMemberName.trim() });
      setNewMemberName("");
      setShowAddMemberModal(false);
    }
  };

  const handleCreateDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDocName.trim() && currentRoom && socket) {
      socket.emit("createDoc", { 
        roomId: currentRoom.id, 
        name: newDocName.trim(), 
        content: newDocContent // Description
      });
      setNewDocName("");
      setNewDocContent("");
      setShowDocModal(false);
    }
  };

  const handleUpdateDoc = (doc: Doc) => {
    if (socket && currentRoom) {
      socket.emit("updateDoc", { 
        docId: doc.id, 
        roomId: currentRoom.id, 
        content: doc.content 
      });
      setEditingDoc(null);
    }
  };

  const handleDeleteDoc = (docId: number) => {
    if (socket && currentRoom && confirm("Xóa Box này và toàn bộ ghi chú bên trong?")) {
      socket.emit("deleteDoc", { docId, roomId: currentRoom.id });
    }
  };

  const handleOpenBox = (box: Doc) => {
    setCurrentBox(box);
    setNotes([]); // Clear previous notes
    if (socket) {
      socket.emit("getNotes", box.id);
    }
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNoteContent.trim() && currentBox && socket) {
      socket.emit("createNote", { 
        docId: currentBox.id, 
        content: newNoteContent.trim() 
      });
      setNewNoteContent("");
    }
  };

  const handleUpdateNote = (note: Note) => {
    if (socket && currentBox) {
      socket.emit("updateNote", { 
        noteId: note.id, 
        docId: currentBox.id, 
        content: note.content 
      });
      setEditingNote(null);
    }
  };

  const handleDeleteNote = (noteId: number) => {
    if (socket && currentBox && confirm("Xóa ghi chú này?")) {
      socket.emit("deleteNote", { noteId, docId: currentBox.id });
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (socket) {
      socket.emit("typing", true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", false);
      }, 2000);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && socket) {
      if (replyingTo) {
        socket.emit("sendMessage", { 
          text: message.trim(), 
          replyTo: {
            id: replyingTo.id,
            text: replyingTo.text,
            username: replyingTo.username
          } 
        });
        setReplyingTo(null);
      } else {
        socket.emit("sendMessage", message.trim());
      }
      socket.emit("typing", false);
      setMessage("");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
      localStorage.removeItem("chat_username");
      localStorage.removeItem("chat_avatar");
      window.location.reload();
    }
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl shadow-zinc-200/50 dark:shadow-none p-8 border border-zinc-100 dark:border-zinc-800 transition-colors"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
              <Hash className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">BOX</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Không gian chat & làm việc nhóm</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded-lg border border-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!username.trim()}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Vào Box
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row h-[100dvh] overflow-hidden font-sans transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden h-14 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 z-30 flex-shrink-0">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <MessageSquare className="text-white w-4 h-4" />
          </div>
          <span className="font-bold text-zinc-900 tracking-tight">Underground</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {(isSidebarOpen || windowWidth >= 768) && (
          <motion.div 
            initial={windowWidth < 768 ? { x: -320 } : false}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed md:relative inset-y-0 left-0 w-72 md:w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shadow-sm z-50 md:translate-x-0"
          >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-zinc-900 dark:text-white tracking-tight">Underground</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {/* Rooms Section */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Phòng Trò Chuyện</span>
              <button onClick={() => setShowRoomModal(true)} className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center gap-1 group">
                  <button 
                    onClick={() => handleSwitchRoom(r)}
                    className={`flex-1 flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      currentRoom?.id === r.id ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Hash size={16} className={currentRoom?.id === r.id ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"} />
                    <span className="text-sm font-bold truncate">{r.name}</span>
                  </button>
                  {username === ADMIN_USER && r.name !== "General" && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => {
                          const newName = prompt("Nhập tên mới cho phòng:", r.name);
                          if (newName && newName.trim() !== "" && newName !== r.name) {
                            socket?.emit("updateRoom", { roomId: r.id, name: newName });
                          }
                        }}
                        className="p-2 text-zinc-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl"
                        title="Sửa tên phòng"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(r.id, r.name)}
                        className="p-2 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                        title="Xóa phòng"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Online Users Section */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Trực tuyến ({users.length})
              </span>
            </div>
            <div className="space-y-1">
              {users.map((u) => {
                const avatarId = u.avatar || "user";
                const avatarConfig = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
                const AvatarIcon = avatarConfig.icon;
                return (
                  <div key={u.username} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${avatarConfig.color}`}>
                      <AvatarIcon size={16} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 truncate">{u.username}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Whitelist Section (Admin Only) */}
          {username === ADMIN_USER && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-indigo-500" />
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                    Whitelist ({whitelist.length})
                  </span>
                </div>
                <button onClick={() => setShowAddModal(true)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md">
                  <UserPlus size={14} />
                </button>
              </div>
              <div className="space-y-1">
                {whitelist.map((u) => {
                  const avatarId = u.avatar || "user";
                  const avatarConfig = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
                  const AvatarIcon = avatarConfig.icon;
                  return (
                    <div key={u.username} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 group transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${avatarConfig.color}`}>
                          <AvatarIcon size={16} />
                        </div>
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{u.username}</span>
                      </div>
                      {u.username !== ADMIN_USER && (
                        <button 
                          onClick={() => {
                            if (confirm(`Xóa ${u.username} khỏi whitelist?`)) {
                              socket?.emit("removeMember", u.username);
                            }
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title="Xóa khỏi whitelist"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 transition-colors">
          <div className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-100 dark:shadow-none flex-shrink-0">
                <User size={20} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Tài khoản</span>
                <span className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">{username}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 relative h-full overflow-hidden transition-colors duration-300">
        {/* Header */}
        <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
              <Hash size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-extrabold text-zinc-900 dark:text-white leading-none truncate">{currentRoom?.name || "Đang tải..."}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-emerald-500 animate-pulse" : 
                  isConnecting ? "bg-amber-500 animate-pulse" : "bg-red-500"
                }`} />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                  isConnected ? "text-emerald-600 dark:text-emerald-400" : 
                  isConnecting ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                }`}>
                  {isConnected ? "Đã kết nối" : isConnecting ? "Đang kết nối..." : "Mất kết nối"}
                </span>
                {!isConnected && !isConnecting && (
                  <button 
                    onClick={() => {
                      setIsConnecting(true);
                      socket?.connect();
                    }}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setShowMembersModal(true)}
              className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
              title="Thành viên"
            >
              <Users size={20} />
            </button>
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
            {username === ADMIN_USER && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    if (confirm("Xóa toàn bộ tin nhắn trong phòng này?")) {
                      socket?.emit("clearChat");
                    }
                  }}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  title="Xóa lịch sử chat"
                >
                  <Eraser size={18} />
                </button>
                {currentRoom?.name !== "General" && (
                  <button 
                    onClick={() => handleDeleteRoom(currentRoom!.id, currentRoom!.name)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    title="Xóa phòng này"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button onClick={() => setShowAddMemberModal(true)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="Thêm thành viên">
                  <UserPlus size={18} />
                </button>
              </div>
            )}
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === "chat" ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                CHAT
              </button>
              <button 
                onClick={() => setActiveTab("docs")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === "docs" ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                BOX
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 bg-zinc-50/30 dark:bg-zinc-950/30 custom-scrollbar overscroll-contain">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => {
                    const isSystem = msg.username === "System";
                    const isMe = msg.username === username;
                    const showAvatar = !isMe && !isSystem && (i === 0 || messages[i-1].username !== msg.username);
                    
                    const avatarId = msg.avatar || "user";
                    const avatarConfig = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
                    const AvatarIcon = avatarConfig.icon;

                    return (
                      <motion.div
                        key={msg.id || i}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${isSystem ? "justify-center" : isMe ? "justify-end" : "justify-start"} items-end gap-2 group/message`}
                      >
                        {!isMe && !isSystem && (
                          <div className="w-8 h-8 flex-shrink-0">
                            {showAvatar ? (
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${avatarConfig.color}`}>
                                <AvatarIcon size={16} />
                              </div>
                            ) : <div className="w-8" />}
                          </div>
                        )}

                        {isSystem ? (
                          <span className="text-[10px] font-bold text-zinc-400 bg-white dark:bg-zinc-800 px-4 py-1.5 rounded-full uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            {msg.text}
                          </span>
                        ) : (
                          <div className={`max-w-[85%] md:max-w-[65%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                            {showAvatar && (
                              <span className={`text-[10px] font-bold mb-1.5 ml-1 uppercase tracking-wider ${msg.username === ADMIN_USER ? "text-amber-600 dark:text-amber-500" : "text-zinc-400 dark:text-zinc-500"}`}>
                                {msg.username}
                              </span>
                            )}
                            <div className={`relative group ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                              {msg.reply_to_text && (
                                <div className={`mb-1 px-3 py-2 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-800 border-l-2 border-indigo-400 text-zinc-500 dark:text-zinc-400 max-w-full truncate opacity-80 ${isMe ? "mr-1" : "ml-1"}`}>
                                  <span className="font-bold block text-[10px] uppercase mb-0.5">Trả lời {msg.reply_to_username}</span>
                                  {msg.reply_to_text}
                                </div>
                              )}
                              <div className={`px-4 py-3 rounded-2xl shadow-sm relative ${isMe ? "bg-indigo-600 text-white rounded-br-none dark:shadow-none" : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-bl-none"}`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                                <div className={`absolute bottom-0 ${isMe ? "-left-12" : "-right-12"} opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-zinc-400 whitespace-nowrap py-1`}>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <button
                                onClick={() => setReplyingTo(msg)}
                                className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 opacity-0 group-hover/message:opacity-100 transition-all shadow-sm ${isMe ? "-left-10" : "-right-10"}`}
                                title="Trả lời"
                              >
                                <Reply size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 ml-10">
                    <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 md:p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                {replyingTo && (
                  <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 p-3 rounded-t-2xl border-x border-t border-zinc-200 dark:border-zinc-700 mb-[-1px] relative z-10">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Reply size={16} className="text-indigo-500 flex-shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase">
                          Trả lời {replyingTo.username}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] md:max-w-md">
                          {replyingTo.text}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setReplyingTo(null)}
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2 md:gap-3 max-w-5xl mx-auto w-full items-end">
                  <div className={`flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all shadow-inner relative ${replyingTo ? "rounded-tl-none rounded-tr-none" : ""}`}>
                    <TextareaAutosize
                      minRows={1}
                      maxRows={5}
                      value={message}
                      onChange={handleTyping}
                      onKeyDown={handleKeyDown}
                      placeholder="Nhập tin nhắn..."
                      className="w-full px-4 py-3 md:px-5 md:py-4 bg-transparent border-none focus:outline-none text-sm resize-none dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!message.trim() || !isConnected}
                    className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-indigo-200 dark:shadow-none flex-shrink-0"
                  >
                    <Send size={20} className="md:w-6 md:h-6" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-50/30 dark:bg-zinc-950/30 custom-scrollbar">
              {currentBox ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <button 
                      onClick={() => setCurrentBox(null)}
                      className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
                    >
                      <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <div>
                      <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">{currentBox.name}</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentBox.content}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {notes.map((note) => (
                      <motion.div 
                        key={note.id}
                        layout
                        className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm group relative transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">{note.created_by}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(note.created_by === username || username === ADMIN_USER) && (
                              <>
                                <button 
                                  onClick={() => setEditingNote(note)}
                                  className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500 text-right">
                          {new Date(note.timestamp).toLocaleString()}
                        </div>
                      </motion.div>
                    ))}
                    {notes.length === 0 && (
                      <div className="text-center py-10 text-zinc-400">
                        <p className="text-sm">Chưa có ghi chú nào trong Box này.</p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleCreateNote} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                    <TextareaAutosize
                      minRows={2}
                      maxRows={6}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleCreateNote(e);
                        }
                      }}
                      placeholder="Viết ghi chú mới..."
                      className="w-full bg-transparent border-none focus:outline-none text-sm resize-none mb-2"
                    />
                    <div className="flex justify-end">
                      <button 
                        type="submit" 
                        disabled={!newNoteContent.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        Thêm ghi chú
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Danh sách Box</h3>
                    <div className="flex gap-2">
                      {currentRoom?.drive_link && (
                        <a 
                          href={currentRoom.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                        >
                          <ExternalLink size={16} />
                          <span className="hidden md:inline">DRIVE</span>
                        </a>
                      )}
                      {username === ADMIN_USER && (
                        <button 
                          onClick={() => {
                            setDriveLink(currentRoom?.drive_link || "");
                            setShowDriveModal(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => setShowDocModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                      >
                        <Plus size={16} />
                        <span className="hidden md:inline">TẠO BOX MỚI</span>
                        <span className="md:hidden">TẠO BOX</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {docs.map((doc) => (
                      <motion.div 
                        key={doc.id}
                        layout
                        onClick={() => handleOpenBox(doc)}
                        className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
                              <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h4 className="font-bold text-zinc-900 dark:text-white truncate max-w-[150px]">{doc.name}</h4>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(doc.created_by === username || username === ADMIN_USER) && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDoc(doc);
                                  }}
                                  className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDoc(doc.id);
                                  }}
                                  className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">
                          {doc.content || "Không có mô tả"}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-700">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">{doc.created_by}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{new Date(doc.timestamp).toLocaleDateString()}</span>
                        </div>
                      </motion.div>
                    ))}
                    {docs.length === 0 && (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-400">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Chưa có Box nào trong phòng này.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Add Whitelist Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Thêm vào Whitelist</h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newMemberName.trim()) {
                    socket?.emit("addMember", { username: newMemberName.trim(), avatar: newMemberAvatar });
                    setNewMemberName("");
                    setNewMemberAvatar("user");
                    setShowAddModal(false);
                  }
                }} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 ml-1">
                    Chọn Avatar
                  </label>
                  <div className="flex justify-between gap-2">
                    {AVATARS.map((av) => {
                      const Icon = av.icon;
                      const isSelected = newMemberAvatar === av.id;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setNewMemberAvatar(av.id)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            isSelected 
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" 
                              : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                          }`}
                        >
                          <Icon size={18} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Tên người dùng..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" autoFocus />
                <button type="submit" disabled={!newMemberName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Xác nhận thêm</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Create Room Modal */}
        {showRoomModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRoomModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Tạo phòng mới</h3>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Tên phòng..." className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white" autoFocus />
                <button type="submit" disabled={!newRoomName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Xác nhận tạo</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddMemberModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Thêm vào phòng</h3>
              <form onSubmit={handleAddRoomMember} className="space-y-4">
                <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Tên người dùng..." className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white" autoFocus />
                <button type="submit" disabled={!newMemberName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Thêm thành viên</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Create Doc Modal */}
        {showDocModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDocModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Tạo Box Ghi Chú</h3>
              <form onSubmit={handleCreateDoc} className="space-y-4">
                <input type="text" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Tên Box (ví dụ: Ghi chú họp)..." className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none dark:text-white" autoFocus />
                <TextareaAutosize minRows={4} value={newDocContent} onChange={(e) => setNewDocContent(e.target.value)} placeholder="Nội dung ghi chú..." className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none resize-none text-sm dark:text-white" />
                <button type="submit" disabled={!newDocName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Lưu Box</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Doc Modal */}
        {editingDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingDoc(null)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-2">Chỉnh sửa: {editingDoc.name}</h3>
              <p className="text-xs text-zinc-400 mb-6">Tạo bởi {editingDoc.created_by}</p>
              <div className="space-y-4">
                <TextareaAutosize 
                  minRows={6} 
                  maxRows={15}
                  value={editingDoc.content} 
                  onChange={(e) => setEditingDoc({...editingDoc, content: e.target.value})} 
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none resize-none text-sm dark:text-white" 
                />
                <button 
                  onClick={() => handleUpdateDoc(editingDoc)} 
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Save size={18} />
                  LƯU THAY ĐỔI
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Note Modal */}
        {editingNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingNote(null)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Chỉnh sửa ghi chú</h3>
              <div className="space-y-4">
                <TextareaAutosize 
                  minRows={4} 
                  maxRows={10}
                  value={editingNote.content} 
                  onChange={(e) => setEditingNote({...editingNote, content: e.target.value})} 
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none resize-none text-sm dark:text-white" 
                />
                <button 
                  onClick={() => handleUpdateNote(editingNote)} 
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Save size={18} />
                  LƯU THAY ĐỔI
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Members Modal */}
        {showMembersModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMembersModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 max-h-[80vh] overflow-y-auto border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Thành viên phòng ({allRoomMembers.length})</h3>
              <div className="space-y-2">
                {allRoomMembers.map((member) => (
                  <div key={member} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                        {member.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{member}</span>
                    </div>
                    {username === ADMIN_USER && member !== ADMIN_USER && (
                      <button
                        onClick={() => {
                          if (confirm(`Xóa ${member} khỏi whitelist?`)) {
                            socket?.emit("removeMember", member);
                          }
                        }}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Xóa khỏi whitelist"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Drive Link Modal */}
        {showDriveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDriveModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-6">Liên kết Drive</h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (currentRoom) {
                    socket?.emit("updateRoomDriveLink", { roomId: currentRoom.id, link: driveLink });
                    setShowDriveModal(false);
                  }
                }} 
                className="space-y-4"
              >
                <input type="text" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="Dán link Drive vào đây..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" autoFocus />
                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Lưu liên kết</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
