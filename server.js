// server.js
const express   = require('express');
const http      = require('http');
const path      = require('path');
const WebSocket = require('ws');
+const { Server: IOServer } = require('socket.io');

const app    = express();
const server = http.createServer(app);

// Dein bestehender WS-Server für Würfel-Sync
const wss    = new WebSocket.Server({ server });

// Socket.IO für networked-aframe
const io = new IOServer(server);

const rooms = {};

// ——— Static files ————————————————————————————————
app.use(express.static(path.join(__dirname, 'public')));

// ——— Dein WebSocket-Code für Würfel ——————————————————
wss.on('connection', ws => {
  ws.on('message', msg => {
    let arr;
    try { arr = JSON.parse(msg); } catch { return; }
    const [cmd, data] = arr;
    if (cmd === '*enter-room*') {
      const room = data;
      if (!rooms[room]) rooms[room] = [];
      rooms[room].push(ws);
      ws.room = room;
      ws.id   = rooms[room].length;
      ws.send(JSON.stringify(['*client-id*', ws.id]));
      rooms[room].forEach(c =>
        c.send(JSON.stringify(['*client-count*', rooms[room].length]))
      );
      rooms[room].forEach(c => {
        if (c !== ws) c.send(JSON.stringify(['*client-enter*', ws.id]));
      });
    }
    if (['*spawn-cubes*','*collect-cube*'].includes(cmd)) {
      (rooms[ws.room] || []).forEach(c =>
        c.send(JSON.stringify([cmd, data]))
      );
    }
  });

  ws.on('close', () => {
    const list = rooms[ws.room] || [];
    rooms[ws.room] = list.filter(c => c !== ws);
    rooms[ws.room].forEach(c => {
      c.send(JSON.stringify(['*client-count*', rooms[ws.room].length]));
      c.send(JSON.stringify(['*client-exit*', ws.id]));
    });
  });
});

// ——— Socket.IO für networked-aframe ————————————————————
io.on('connection', socket => {
  // Raum beitreten
  socket.on('join', room => {
    socket.join(room);
    // anderen Clients mitteilen, dass jemand dazukommt
    socket.to(room).emit('clientConnected', socket.id);
  });
  // alle Nachrichten (Entity-Updates) broadcasten
  socket.on('message', data => {
    // überall senden, außer zurück zum Sender
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('message', data);
      }
    }
  });
  // beim Verlassen
  socket.on('disconnect', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('clientDisconnected', socket.id);
      }
    }
  });
});

// Port starten
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
