const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { email, password, userType, name } = req.body;
        
        // 이메일 중복 확인
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
        }

        // 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 정보 저장
        const [result] = await pool.query(
            'INSERT INTO users (email, password, name, user_type) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, name, userType]
        );

        res.status(201).json({ message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    const { email, password } = req.body; // 클라이언트에서는 email 필드로 보내지만, 서버에서는 이메일 또는 이름으로 처리

    try {
        // 입력된 값이 이메일 형식인지 확인 (간단한 체크)
        const isEmail = email.includes('@');

        let user;
        if (isEmail) {
            // 이메일로 사용자 찾기
            const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
            user = rows[0];
        } else {
            // 이름으로 사용자 찾기
            const [rows] = await pool.query('SELECT * FROM users WHERE name = ?', [email]); // 클라이언트에서 email 필드로 이름을 보내므로 email 변수 사용
            user = rows[0];
        }

        if (!user) {
            return res.status(401).json({ error: '이메일/이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 비밀번호 확인
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: '이메일/이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 세션에 사용자 정보 저장
        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.user_type
        };

        res.status(200).json({ message: '로그인 성공', user: req.session.user });

    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
});

// 로그아웃
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다.' });
        }
        res.json({ message: '로그아웃되었습니다.' });
    });
});

// 현재 로그인한 사용자 정보 조회
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    res.json({ user: req.session.user });
});

module.exports = router; 