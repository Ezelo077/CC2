// server.js
const express   = require('express');
const http      = require('http');
const path      = require('path');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const rooms = {};

// Statisches Frontend ausliefern
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket-Logik (wie gehabt)
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
      // ID & Count senden
      ws.send(JSON.stringify(['*client-id*', ws.id]));
      rooms[room].forEach(c =>
        c.send(JSON.stringify(['*client-count*', rooms[room].length]))
      );
      // Anderen mitteilen, dass jemand beigetreten ist
      rooms[room].forEach(c => {
        if (c !== ws)
          c.send(JSON.stringify(['*client-enter*', ws.id]));
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

// Auf Heroku-Port hören
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
