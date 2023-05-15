const SocketIO = require('socket.io');
const { removeRoom } = require('./services');

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: '/socket.io' });
  app.set('io', io);
  const room = io.of('/room');
  const chat = io.of('/chat');

  const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
  chat.use(wrap(sessionMiddleware));

  room.on('connection', (socket) => {
    console.log('room 네임스페이스에 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    });
  });

  chat.on('connection', (socket) => {
    console.log('chat 네임스페이스에 접속');

    socket.on('join', (data) => { // data는 브라우저에서 보낸 방 아이디
      socket.join(data); // 네임스페이스 아래에 존재하는 방에 접속
      socket.to(data).emit('join', {
        user: 'system',
        chat: `${socket.request.session.color}님이 입장하셨습니다.`,
      });
    });

    socket.on('disconnect', async () => {
      console.log('chat 네임스페이스 접속 해제');
      const { referer } = socket.request.headers; // 브라우저 주소가 들어있음
      const roomId = new URL(referer).pathname.split('/').at(-1);
      const currentRoom = chat.adapter.rooms.get(roomId);
      const userCount = currentRoom?.size || 0;
      if (userCount === 0) { // 유저가 0명이면 방 삭제
        await removeRoom(roomId); // 컨트롤러 대신 서비스를 사용
        room.emit('removeRoom', roomId);
        console.log('방 제거 요청 성공');
      } else {
        socket.to(roomId).emit('exit', {
          user: 'system',
          chat: `${socket.request.session.color}님이 퇴장하셨습니다.`,
        });
      }
    });
  });

  // io.on('connection', (socket) => { // 웹소켓 연결 시
  //   const req = socket.request;
  //   const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  //   console.log('새로운 클라이언트 접속!', ip, socket.id, req.ip);
  //   socket.on('disconnect', () => { // 연결 종료 시
  //     console.log('클라이언트 접속 해제', ip, socket.id);
  //     clearInterval(socket.interval);
  //   });
  //   socket.on('error', (error) => { // 에러 시
  //     console.error(error);
  //   });
  //   socket.on('reply', (data) => { // 클라이언트로부터 메시지
  //     console.log(data);
  //   });
  //   socket.interval = setInterval(() => { // 3초마다 클라이언트로 메시지 전송
  //     socket.emit('news', 'Hello Socket.IO');
  //   }, 3000);
  // });
};