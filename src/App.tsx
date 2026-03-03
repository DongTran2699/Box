import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import TextareaAutosize from "react-textarea-autosize";
import { 
  Send, User, LogOut, Trash2, Users, MessageSquare, 
  UserPlus, X, ShieldCheck, Wifi, WifiOff, Menu, 
  Plus, Hash, FileText, ChevronRight, Save, Edit3,
  Zap, Star, Heart, Smile
} from "lucide-react";

type Message = {
  id?: number;
  username: string;
  text: string;
  avatar?: string;
  timestamp: string;
};

type UserInfo = {
  username: string;
  avatar: string;
};

type Room = {
  id: number;
  name: string;
  created_by: string;
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
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "docs">("chat");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentBoxRef = useRef<Doc | null>(null);

  useEffect(() => {
    currentBoxRef.current = currentBox;
  }, [currentBox]);

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
    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      const currentUname = localStorage.getItem("chat_username");
      const currentAvatar = localStorage.getItem("chat_avatar") || "user";
      if (currentUname) {
        newSocket.emit("join", { username: currentUname, avatar: currentAvatar });
      }
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    newSocket.on("message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.username !== username && msg.username !== "System") {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
    });

    newSocket.on("typingUpdate", (users: string[]) => {
      setTypingUsers(users.filter(u => u !== username));
    });

    newSocket.on("history", (history: Message[]) => {
      setMessages(history);
    });

    newSocket.on("userList", (userList: UserInfo[]) => {
      setUsers(userList);
    });

    newSocket.on("roomsUpdate", (roomList: Room[]) => {
      setRooms(roomList);
      if (!currentRoom && roomList.length > 0) {
        const general = roomList.find(r => r.name === "General");
        setCurrentRoom(general || roomList[0]);
      }
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

    newSocket.on("whitelistUpdate", (list: string[]) => {
      setWhitelist(list);
    });

    newSocket.on("error", (err: string) => {
      setError(err);
      setIsJoined(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      socket.emit("switchRoom", room.id.toString());
      setCurrentRoom(room);
      setIsSidebarOpen(false);
      setActiveTab("chat");
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
      socket.emit("sendMessage", message.trim());
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
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-zinc-200/50 p-8 border border-zinc-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Hash className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">BOX</h1>
            <p className="text-zinc-500 text-sm mt-1">Không gian chat & làm việc nhóm</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 ml-1">
                Chọn Avatar
              </label>
              <div className="flex justify-between gap-2">
                {AVATARS.map((av) => {
                  const Icon = av.icon;
                  const isSelected = avatar === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvatar(av.id)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                        isSelected 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" 
                          : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
                      }`}
                    >
                      <Icon size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!username.trim()}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-200"
            >
              Vào Box
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4 z-30">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <MessageSquare className="text-white w-4 h-4" />
          </div>
          <span className="font-bold text-zinc-900 tracking-tight">DongChat</span>
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
      <motion.div 
        className={`fixed md:relative inset-y-0 left-0 w-72 md:w-80 bg-white border-r border-zinc-200 flex flex-col shadow-sm z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-zinc-900 tracking-tight">DongChat</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Rooms Section */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Phòng Trò Chuyện</span>
              <button onClick={() => setShowRoomModal(true)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {rooms.map((r) => (
                <button 
                  key={r.id} 
                  onClick={() => handleSwitchRoom(r)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    currentRoom?.id === r.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-zinc-50 text-zinc-600"
                  }`}
                >
                  <Hash size={16} className={currentRoom?.id === r.id ? "text-indigo-600" : "text-zinc-400"} />
                  <span className="text-sm font-bold truncate">{r.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Online Users Section */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                Trực tuyến ({users.length})
              </span>
            </div>
            <div className="space-y-1">
              {users.map((u) => {
                const avatarId = u.avatar || "user";
                const avatarConfig = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
                const AvatarIcon = avatarConfig.icon;
                return (
                  <div key={u.username} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${avatarConfig.color}`}>
                      <AvatarIcon size={16} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700 truncate">{u.username}</span>
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
                {whitelist.map((u) => (
                  <div key={u} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 group transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-500">
                        {u.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-zinc-700">{u}</span>
                    </div>
                    {u !== ADMIN_USER && (
                      <button 
                        onClick={() => {
                          if (confirm(`Xóa ${u} khỏi whitelist?`)) {
                            socket?.emit("removeMember", u);
                          }
                        }}
                        className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 bg-zinc-50/50 border-t border-zinc-100">
          <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
                <User size={20} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Tài khoản</span>
                <span className="text-sm font-extrabold text-zinc-900 truncate">{username}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white relative h-full">
        {/* Header */}
        <div className="h-16 border-b border-zinc-200 flex items-center justify-between px-6 bg-white/90 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Hash size={20} className="text-indigo-600" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-extrabold text-zinc-900 leading-none truncate">{currentRoom?.name || "Đang tải..."}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${isConnected ? "text-emerald-600" : "text-red-600"}`}>
                  {isConnected ? "Đang kết nối" : "Mất kết nối"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {username === ADMIN_USER && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    if (confirm("Xóa toàn bộ tin nhắn trong phòng này?")) {
                      socket?.emit("clearChat");
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Xóa chat"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={() => setShowAddMemberModal(true)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <UserPlus size={18} />
                </button>
              </div>
            )}
            <div className="h-8 w-px bg-zinc-200 mx-1" />
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === "chat" ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                CHAT
              </button>
              <button 
                onClick={() => setActiveTab("docs")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === "docs" ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                BOXES
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-zinc-50/30">
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
                        className={`flex ${isSystem ? "justify-center" : isMe ? "justify-end" : "justify-start"} items-end gap-2`}
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
                          <span className="text-[10px] font-bold text-zinc-400 bg-white px-4 py-1.5 rounded-full uppercase tracking-widest border border-zinc-200 shadow-sm">
                            {msg.text}
                          </span>
                        ) : (
                          <div className={`max-w-[85%] md:max-w-[65%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                            {showAvatar && (
                              <span className={`text-[10px] font-bold mb-1.5 ml-1 uppercase tracking-wider ${msg.username === ADMIN_USER ? "text-amber-600" : "text-zinc-400"}`}>
                                {msg.username}
                              </span>
                            )}
                            <div className={`px-4 py-3 rounded-2xl shadow-sm relative group ${isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-zinc-900 border border-zinc-200 rounded-bl-none"}`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                              <div className={`absolute bottom-0 ${isMe ? "-left-12" : "-right-12"} opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-zinc-400 whitespace-nowrap py-1`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 ml-10">
                    <div className="bg-zinc-100 border border-zinc-200 px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 md:p-6 bg-white border-t border-zinc-200">
                <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto w-full items-end">
                  <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all shadow-inner relative">
                    <TextareaAutosize
                      minRows={1}
                      maxRows={5}
                      value={message}
                      onChange={handleTyping}
                      onKeyDown={handleKeyDown}
                      placeholder="Nhập tin nhắn..."
                      className="w-full px-5 py-4 bg-transparent border-none focus:outline-none text-sm resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!message.trim() || !isConnected}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-indigo-200 flex-shrink-0"
                  >
                    <Send size={24} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-50/30">
              {currentBox ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <button 
                      onClick={() => setCurrentBox(null)}
                      className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
                    >
                      <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <div>
                      <h3 className="text-xl font-extrabold text-zinc-900">{currentBox.name}</h3>
                      <p className="text-xs text-zinc-500">{currentBox.content}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {notes.map((note) => (
                      <motion.div 
                        key={note.id}
                        layout
                        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm group relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">{note.created_by}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(note.created_by === username || username === ADMIN_USER) && (
                              <>
                                <button 
                                  onClick={() => setEditingNote(note)}
                                  className="p-1 text-zinc-400 hover:text-indigo-600 rounded"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1 text-zinc-400 hover:text-red-600 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-zinc-800 whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-2 text-[10px] text-zinc-400 text-right">
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
                    <h3 className="text-lg font-bold text-zinc-900">Danh sách Box</h3>
                    <button 
                      onClick={() => setShowDocModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      <Plus size={16} />
                      TẠO BOX MỚI
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map((doc) => (
                      <motion.div 
                        key={doc.id}
                        layout
                        onClick={() => handleOpenBox(doc)}
                        className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                              <FileText size={16} className="text-indigo-600" />
                            </div>
                            <h4 className="font-bold text-zinc-900 truncate max-w-[150px]">{doc.name}</h4>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(doc.created_by === username || username === ADMIN_USER) && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDoc(doc);
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDoc(doc.id);
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-zinc-600 line-clamp-2 mb-4">
                          {doc.content || "Không có mô tả"}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">{doc.created_by}</span>
                          <span className="text-[10px] text-zinc-400">{new Date(doc.timestamp).toLocaleDateString()}</span>
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-extrabold text-zinc-900 mb-6">Thêm vào Whitelist</h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newMemberName.trim()) {
                    socket?.emit("addMember", newMemberName.trim());
                    setNewMemberName("");
                    setShowAddModal(false);
                  }
                }} 
                className="space-y-4"
              >
                <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Tên người dùng..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" autoFocus />
                <button type="submit" disabled={!newMemberName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Xác nhận thêm</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Create Room Modal */}
        {showRoomModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRoomModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-extrabold text-zinc-900 mb-6">Tạo phòng mới</h3>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Tên phòng..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" autoFocus />
                <button type="submit" disabled={!newRoomName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Xác nhận tạo</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddMemberModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-extrabold text-zinc-900 mb-6">Thêm vào phòng</h3>
              <form onSubmit={handleAddRoomMember} className="space-y-4">
                <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Tên người dùng..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" autoFocus />
                <button type="submit" disabled={!newMemberName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Thêm thành viên</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Create Doc Modal */}
        {showDocModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDocModal(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-extrabold text-zinc-900 mb-6">Tạo Box Ghi Chú</h3>
              <form onSubmit={handleCreateDoc} className="space-y-4">
                <input type="text" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Tên Box (ví dụ: Ghi chú họp)..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" autoFocus />
                <TextareaAutosize minRows={4} value={newDocContent} onChange={(e) => setNewDocContent(e.target.value)} placeholder="Nội dung ghi chú..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none resize-none text-sm" />
                <button type="submit" disabled={!newDocName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Lưu Box</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Doc Modal */}
        {editingDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingDoc(null)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-extrabold text-zinc-900 mb-2">Chỉnh sửa: {editingDoc.name}</h3>
              <p className="text-xs text-zinc-400 mb-6">Tạo bởi {editingDoc.created_by}</p>
              <div className="space-y-4">
                <TextareaAutosize 
                  minRows={6} 
                  maxRows={15}
                  value={editingDoc.content} 
                  onChange={(e) => setEditingDoc({...editingDoc, content: e.target.value})} 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none resize-none text-sm" 
                />
                <button 
                  onClick={() => handleUpdateDoc(editingDoc)} 
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-extrabold text-zinc-900 mb-6">Chỉnh sửa ghi chú</h3>
              <div className="space-y-4">
                <TextareaAutosize 
                  minRows={4} 
                  maxRows={10}
                  value={editingNote.content} 
                  onChange={(e) => setEditingNote({...editingNote, content: e.target.value})} 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none resize-none text-sm" 
                />
                <button 
                  onClick={() => handleUpdateNote(editingNote)} 
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Save size={18} />
                  LƯU THAY ĐỔI
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
