const { Server } = require('socket.io');

module.exports = (server, app) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  app.locals.io = io;

  io.on('connection', (socket) => {
    socket.on('join-room', (doctorId) => {
      if (doctorId) socket.join(String(doctorId));
    });

    socket.on('leave-room', (doctorId) => {
      if (doctorId) socket.leave(String(doctorId));
    });

    socket.on('disconnect', () => {});
  });

  return io;
};
