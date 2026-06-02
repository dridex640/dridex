const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 20 * 1024 * 1024
});

app.use(express.static(__dirname));

let users = {};
let messageHistory = [];

io.on("connection", (socket) => {
  socket.emit("history", messageHistory);

  socket.on("join", (data) => {
    users[socket.id] = {
      username: data.username,
      avatar: data.avatar || ""
    };

    io.emit("users", Object.values(users));

    const systemMsg = {
      type: "system",
      text: `${data.username} kanala katıldı.`,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    messageHistory.push(systemMsg);
    io.emit("system", systemMsg);
  });

  socket.on("message", (data) => {
    const user = users[socket.id];
    if (!user) return;

    const msg = {
      type: "text",
      username: user.username,
      avatar: user.avatar,
      text: data.text,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    messageHistory.push(msg);
    io.emit("message", msg);
  });

  socket.on("image", (data) => {
    const user = users[socket.id];
    if (!user) return;

    const msg = {
      type: "image",
      username: user.username,
      avatar: user.avatar,
      fileName: data.fileName,
      fileData: data.fileData,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    messageHistory.push(msg);
    io.emit("message", msg);
  });

  socket.on("file", (data) => {
    const user = users[socket.id];
    if (!user) return;

    const msg = {
      type: "file",
      username: user.username,
      avatar: user.avatar,
      fileName: data.fileName,
      fileData: data.fileData,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    messageHistory.push(msg);
    io.emit("message", msg);
  });

  socket.on("typing", () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit("typing", user.username);
    }
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];

    if (user) {
      delete users[socket.id];
      io.emit("users", Object.values(users));

      const systemMsg = {
        type: "system",
        text: `${user.username} kanaldan ayrıldı.`,
        time: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit"
        })
      };

      messageHistory.push(systemMsg);
      io.emit("system", systemMsg);
    }
  });
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Canlı sohbet çalışıyor:");
  console.log("http://localhost:3000");
});