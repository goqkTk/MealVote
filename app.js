const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const voteRoutes = require('./routes/vote');
const { requireAuth } = require('./middleware/auth');

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
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24시간
    }
}));

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/votes', voteRoutes);

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
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 