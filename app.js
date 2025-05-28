const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

// MySQL 세션 스토어 추가
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./config/database');

const { router: authRouter, encryptUrl, decryptUrl } = require('./routes/auth');
const { router: voteRouter, setSocketIO } = require('./routes/vote');
const { requireAuth } = require('./middleware/auth');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

// Socket.IO 인스턴스를 라우터에 전달
setSocketIO(io);

// MySQL 세션 스토어 설정
const sessionStore = new MySQLStore({
    expiration: 24 * 60 * 60 * 1000, // 세션 만료 시간 (1일)
    endConnectionOnClose: true,
    clearExpired: true,
    checkExpirationInterval: 60 * 60 * 1000 // 만료된 세션 정리 주기 (1시간)
}, pool);

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore, // 데이터베이스 스토어 사용
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24시간
    }
}));

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 라우트 설정
app.use('/api/auth', authRouter);
app.use('/api/votes', voteRouter);
app.use('/api/restaurants', require('./routes/restaurant'));

// 이메일 인증 라우트 (API 엔드포인트 숨김)
app.get('/verify/:encryptedToken', async (req, res) => {
    try {
        const encryptedToken = req.params.encryptedToken;
        const verificationToken = decryptUrl(encryptedToken);

        // 토큰으로 사용자 찾기 (만료 시간도 확인)
        const [users] = await pool.query(
            'SELECT * FROM users WHERE verification_token = ? AND verification_token_expires > NOW()',
            [verificationToken]
        );

        if (users.length === 0) {
            return res.redirect('/login?error=invalid_token');
        }

        // 사용자 인증 상태 업데이트
        await pool.query(
            'UPDATE users SET is_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE verification_token = ?',
            [verificationToken]
        );

        res.redirect('/login?success=verified');
    } catch (error) {
        res.redirect('/login?error=verification_failed');
    }
});

// 로그인/회원가입 페이지
app.get('/login', (req, res) => {
    res.render('login');
});

// 메인 페이지 (인증 필요)
app.get('/', requireAuth, (req, res) => {
    res.render('index');
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    // 연결된 클라이언트에게 환영 메시지 전송
    socket.emit('welcome', { message: '서버에 연결되었습니다.' });

    socket.on('disconnect', () => {
    });

    // 에러 처리
    socket.on('error', (error) => {
    });
});

// 투표 생성 시 실시간 업데이트
app.post('/api/votes', requireAuth, async (req, res) => {
    try {
        // ... existing code ...
        io.emit('voteCreated', { message: '새로운 투표가 생성되었습니다.' });
        res.status(201).json({ message: '투표가 생성되었습니다.' });
    } catch (error) {
        // ... existing code ...
    }
});

// 투표하기 시 실시간 업데이트
app.post('/api/votes/:voteId/vote', requireAuth, async (req, res) => {
    try {
        // ... existing code ...
        io.emit('voteUpdated', { voteId: voteId, message: '투표가 업데이트되었습니다.' });
        res.json({ message: '투표가 완료되었습니다.' });
    } catch (error) {
        // ... existing code ...
    }
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 서버 시작
const PORT = process.env.PORT;
const HOST = '0.0.0.0';
http.listen(PORT, HOST, () => {
    console.log(`서버가 ${process.env.BASE_URL} 에서 실행되고 있습니다`);
}); 