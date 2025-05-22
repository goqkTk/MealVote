const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const { router: authRouter, encryptUrl, decryptUrl } = require('./routes/auth');
const voteRoutes = require('./routes/vote');
const { requireAuth } = require('./middleware/auth');
const pool = require('./config/database');

const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production'
    }
}));

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 라우트 설정
app.use('/api/auth', authRouter);
app.use('/api/votes', voteRoutes);
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
        console.error('이메일 인증 오류:', error);
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

// 서버 시작
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`${PORT} 포트에서 실행 중입니다`);
}); 