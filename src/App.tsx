import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import TextareaAutosize from "react-textarea-autosize";
import { Send, User, LogOut, Trash2, Users, MessageSquare, UserPlus, X, ShieldCheck, Wifi, WifiOff } from "lucide-react";

type Message = {
  id?: number;
  username: string;
  text: string;
  timestamp: string;
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ADMIN_USER = "dongtran2699";

  useEffect(() => {
    const newSocket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      if (username) {
        newSocket.emit("join", username);
      }
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    newSocket.on("message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      // Play sound if not me
      if (msg.username !== username && msg.username !== "System") {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {}); // Ignore autoplay errors
      }
    });

    newSocket.on("typingUpdate", (users: string[]) => {
      setTypingUsers(users.filter(u => u !== username));
    });

    newSocket.on("history", (history: Message[]) => {
      setMessages(history);
    });

    newSocket.on("userList", (userList: string[]) => {
      setUsers(userList);
    });

    newSocket.on("whitelistUpdate", (list: string[]) => {
      setWhitelist(list);
    });

    newSocket.on("error", (err: string) => {
      setError(err);
      setIsJoined(false);
    });

    newSocket.on("chatCleared", () => {
      setMessages([]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && socket) {
      socket.emit("join", username.trim());
      setIsJoined(true);
      setError("");
      // Store username in local storage for auto-reconnect context
      localStorage.setItem("chat_username", username.trim());
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    if (socket) {
      socket.emit("typing", true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

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

  const handleClearChat = () => {
    if (socket && username === ADMIN_USER) {
      if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện?")) {
        socket.emit("clearChat");
      }
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemberName.trim() && socket) {
      socket.emit("addMember", newMemberName.trim());
      setNewMemberName("");
      setShowAddModal(false);
    }
  };

  const handleRemoveMember = (name: string) => {
    if (socket && username === ADMIN_USER && name !== ADMIN_USER) {
      if (confirm(`Bạn có chắc chắn muốn xóa ${name} khỏi danh sách thành viên?`)) {
        socket.emit("removeMember", name);
      }
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
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
              <MessageSquare className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Chào mừng đến với DongChat</h1>
            <p className="text-zinc-500 text-sm mt-1">Vui lòng nhập tên để bắt đầu trò chuyện</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">
                Tên người dùng
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: dongtran2699"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-200"
            >
              Tham gia ngay
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400 font-medium uppercase tracking-widest">
            <span>Quản lý bởi dongtran2699</span>
            <span>Tối đa 10 người</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col shadow-sm z-20">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-zinc-900 tracking-tight">DongChat</span>
          </div>
          <div className="flex items-center gap-1">
            {username === ADMIN_USER && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-95"
                title="Thêm thành viên"
              >
                <UserPlus size={20} />
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
              title="Đăng xuất"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Active Users Section */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                  Trực tuyến ({users.length}/10)
                </span>
              </div>
            </div>
            <div className="space-y-1">
              {users.map((u) => (
                <div 
                  key={u} 
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    u === username ? "bg-indigo-50/50" : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm ${
                      u === ADMIN_USER ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {u === ADMIN_USER ? "★" : u.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-bold text-zinc-900 truncate">
                      {u} {u === username && <span className="text-indigo-500 font-medium">(Bạn)</span>}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium truncate">
                      {u === ADMIN_USER ? "Quản trị viên" : "Thành viên"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Whitelist Section (Admin Only) */}
          {username === ADMIN_USER && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center gap-2 mb-3 px-2">
                <ShieldCheck size={14} className="text-indigo-500" />
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                  Danh sách thành viên ({whitelist.length})
                </span>
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
                        onClick={() => handleRemoveMember(u)}
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
          <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-zinc-200 shadow-sm">
            <div className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
              <User size={22} />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Tài khoản của bạn</span>
              <span className="text-sm font-extrabold text-zinc-900 truncate">{username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white relative">
        {/* Header */}
        <div className="h-16 border-b border-zinc-200 flex items-center justify-between px-6 bg-white/90 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Users size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-extrabold text-zinc-900 leading-none">Phòng Trò Chuyện Chung</h2>
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Đang hoạt động</span>
            </div>
          </div>
          
          {username === ADMIN_USER && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 active:scale-95"
            >
              <Trash2 size={14} />
              DỌN DẸP PHÒNG
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/30">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isSystem = msg.username === "System";
              const isMe = msg.username === username;
              const showAvatar = !isMe && !isSystem && (i === 0 || messages[i-1].username !== msg.username);
              
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
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold shadow-sm ${
                          msg.username === ADMIN_USER ? "bg-amber-100 text-amber-700" : "bg-white border border-zinc-200 text-zinc-500"
                        }`}>
                          {msg.username.charAt(0).toUpperCase()}
                        </div>
                      ) : <div className="w-8" />}
                    </div>
                  )}

                  {isSystem ? (
                    <span className="text-[10px] font-bold text-zinc-400 bg-white px-4 py-1.5 rounded-full uppercase tracking-widest border border-zinc-200 shadow-sm">
                      {msg.text}
                    </span>
                  ) : (
                    <div className={`max-w-[75%] md:max-w-[65%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showAvatar && (
                        <span className={`text-[10px] font-bold mb-1.5 ml-1 uppercase tracking-wider ${
                          msg.username === ADMIN_USER ? "text-amber-600" : "text-zinc-400"
                        }`}>
                          {msg.username} {msg.username === ADMIN_USER && "★"}
                        </span>
                      )}
                      <div className={`px-4 py-3 rounded-2xl shadow-sm relative group ${
                        isMe 
                          ? "bg-indigo-600 text-white rounded-br-none" 
                          : "bg-white text-zinc-900 border border-zinc-200 rounded-bl-none"
                      }`}>
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
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 bg-white border-t border-zinc-200">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto w-full">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập tin nhắn của bạn..."
              className="flex-1 px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-inner"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-xl shadow-indigo-200"
            >
              <Send size={24} />
            </button>
          </form>
        </div>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 border border-zinc-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-extrabold text-zinc-900 tracking-tight">Thêm thành viên</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">
                    Tên người dùng mới
                  </label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nhập tên..."
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMemberName.trim()}
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
                >
                  Xác nhận thêm
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
