const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const crypto = require('crypto');
const transporter = require('../config/email');

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

        // 인증 토큰 생성
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // 사용자 정보 저장
        const [result] = await pool.query(
            'INSERT INTO users (email, password, name, user_type, verification_token, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
            [email, hashedPassword, name, userType, verificationToken, false]
        );

        // 인증 이메일 전송
        const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${verificationToken}`;
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'MealVote 이메일 인증',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #0d6efd; text-align: center;">MealVote 이메일 인증</h1>
                        <p style="font-size: 16px; line-height: 1.6;">안녕하세요, ${name}님!</p>
                        <p style="font-size: 16px; line-height: 1.6;">MealVote 회원가입을 완료하기 위해 아래 링크를 클릭해주세요:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" 
                               style="background-color: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                이메일 인증하기
                            </a>
                        </div>
                        <p style="font-size: 14px; color: #666;">이 링크는 24시간 동안 유효합니다.</p>
                        <p style="font-size: 14px; color: #666;">본 메일은 발신 전용입니다. 문의사항은 관리자에게 연락해주세요.</p>
                    </div>
                `
            });
            console.log('인증 이메일 전송 성공:', email);
        } catch (emailError) {
            console.error('이메일 전송 오류:', emailError);
            // 이메일 전송 실패 시에도 회원가입은 완료
            return res.status(201).json({ 
                message: '회원가입이 완료되었습니다. 이메일 전송에 실패했습니다. 관리자에게 문의해주세요.',
                error: '이메일 전송 실패'
            });
        }

        res.status(201).json({ message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.' });
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// 이메일 인증
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // 토큰으로 사용자 찾기
        const [users] = await pool.query(
            'SELECT * FROM users WHERE verification_token = ?',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: '유효하지 않은 인증 토큰입니다.' });
        }

        // 사용자 인증 상태 업데이트
        await pool.query(
            'UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = ?',
            [token]
        );

        res.json({ message: '이메일이 성공적으로 인증되었습니다.' });
    } catch (error) {
        console.error('이메일 인증 오류:', error);
        res.status(500).json({ error: '이메일 인증 중 오류가 발생했습니다.' });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 입력된 값이 이메일 형식인지 확인
        const isEmail = email.includes('@');

        let user;
        if (isEmail) {
            // 이메일로 사용자 찾기
            const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
            user = rows[0];
        } else {
            // 이름으로 사용자 찾기
            const [rows] = await pool.query('SELECT * FROM users WHERE name = ?', [email]);
            user = rows[0];
        }

        if (!user) {
            return res.status(401).json({ error: '이메일/이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 이메일 인증 확인
        if (!user.is_verified) {
            return res.status(401).json({ error: '이메일 인증이 필요합니다. 이메일을 확인해주세요.' });
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