const express = require("express");
const http = require("http");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 20 * 1024 * 1024
});

app.use(express.static(__dirname));
app.use(express.json({ limit: "20mb" }));

const USERS_FILE = "./users.json";

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }

  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let onlineUsers = {};

const rooms = [
  "genel",
  "oyun",
  "müzik",
  "spor",
  "teknoloji"
];

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || username.length < 5) {
    return res.json({
      success: false,
      message: "Kullanıcı adı en az 5 karakter olmalı."
    });
  }

  if (!password || password.length < 6) {
    return res.json({
      success: false,
      message: "Şifre en az 6 karakter olmalı."
    });
  }

  const users = loadUsers();

  const exists = users.find(
    user => user.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    return res.json({
      success: false,
      message: "Bu kullanıcı adı zaten kayıtlı."
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  users.push({
    username,
    passwordHash,
    createdAt: new Date().toISOString()
  });

  saveUsers(users);

  res.json({
    success: true,
    message: "Kayıt başarılı. Şimdi giriş yapabilirsin."
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const users = loadUsers();

  const user = users.find(
    user => user.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.json({
      success: false,
      message: "Kullanıcı bulunamadı."
    });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    return res.json({
      success: false,
      message: "Şifre hatalı."
    });
  }

  res.json({
    success: true,
    username: user.username
  });
});

io.on("connection", (socket) => {
  socket.on("join", (data) => {
    const room = data.room || "genel";

    if (!rooms.includes(room)) return;

    socket.join(room);

    onlineUsers[socket.id] = {
      username: data.username,
      avatar: data.avatar || "",
      room
    };

    io.emit("users", Object.values(onlineUsers));

    io.to(room).emit("system", {
      type: "system",
      text: `${data.username} ${room} odasına katıldı.`,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });
  });

  socket.on("switchRoom", (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const newRoom = data.room;
    if (!rooms.includes(newRoom)) return;

    socket.leave(user.room);

    io.to(user.room).emit("system", {
      type: "system",
      text: `${user.username} odadan ayrıldı.`,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });

    user.room = newRoom;
    socket.join(newRoom);

    io.emit("users", Object.values(onlineUsers));

    io.to(newRoom).emit("system", {
      type: "system",
      text: `${user.username} ${newRoom} odasına katıldı.`,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });
  });

  socket.on("message", (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const msg = {
      type: "text",
      room: user.room,
      username: user.username,
      avatar: user.avatar,
      text: data.text,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    io.to(user.room).emit("message", msg);
  });

  socket.on("image", (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const msg = {
      type: "image",
      room: user.room,
      username: user.username,
      avatar: user.avatar,
      fileName: data.fileName,
      fileData: data.fileData,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    io.to(user.room).emit("message", msg);
  });

  socket.on("dm", (data) => {
    const sender = onlineUsers[socket.id];
    if (!sender) return;

    const targetSocketId = Object.keys(onlineUsers).find(
      id => onlineUsers[id].username === data.to
    );

    if (!targetSocketId) return;

    const dmMsg = {
      type: "dm",
      from: sender.username,
      to: data.to,
      text: data.text,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    socket.emit("dm", dmMsg);
    io.to(targetSocketId).emit("dm", dmMsg);
  });

  socket.on("typing", () => {
    const user = onlineUsers[socket.id];
    if (user) {
      socket.to(user.room).emit("typing", user.username);
    }
  });

  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];

    if (user) {
      io.to(user.room).emit("system", {
        type: "system",
        text: `${user.username} ayrıldı.`,
        time: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit"
        })
      });

      delete onlineUsers[socket.id];
      io.emit("users", Object.values(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DRIDEXCHAT çalışıyor: ${PORT}`);
});
