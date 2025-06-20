const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = {};

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
      ws.id = rooms[room].length;
      // ID & Count
      ws.send(JSON.stringify(['*client-id*', ws.id]));
      rooms[room].forEach(c =>
        c.send(JSON.stringify(['*client-count*', rooms[room].length]))
      );
      // others notify
      rooms[room].forEach(c => {
        if (c !== ws)
          c.send(JSON.stringify(['*client-enter*', ws.id]));
      });
    }
    if (['*spawn-cubes*','*collect-cube*'].includes(cmd)) {
      const list = rooms[ws.room] || [];
      list.forEach(c => c.send(JSON.stringify([cmd, data])));
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
