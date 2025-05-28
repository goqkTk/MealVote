const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const crypto = require('crypto');
const transporter = require('../config/email');

// URL 암호화를 위한 키 (32바이트)
const salt = crypto.randomBytes(16);
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, salt, 32);
const IV_LENGTH = 16;

// JWT 시크릿 키
const JWT_SECRET = process.env.JWT_SECRET;

// 로그인 시도 제한을 위한 Map
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15분

// URL 암호화 함수
function encryptUrl(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// URL 복호화 함수
function decryptUrl(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = textParts.join(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        throw new Error('유효하지 않은 인증 링크입니다.');
    }
}

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { email, password, userType, name } = req.body;
        
        // 이메일 도메인 검증
        if (!email.endsWith('@sonline20.sen.go.kr')) {
            return res.status(400).json({ error: '(@sonline20.sen.go.kr)만 사용 가능합니다.' });
        }

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
        // 토큰 만료 시간 설정 (15분)
        const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

        // 사용자 정보 저장
        const [result] = await pool.query(
            'INSERT INTO users (email, password, name, user_type, verification_token, verification_token_expires, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [email, hashedPassword, name, userType, verificationToken, tokenExpires, false]
        );

        // 인증 URL 생성 및 암호화
        const verificationUrl = `${process.env.BASE_URL}/verify/${encryptUrl(verificationToken)}`;
        
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'MealVote 이메일 인증',
                html: `
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
                            <p style="text-align: center; font-size: 18px; margin: 0 0 10px;">MealVote</p>
                            <h1 style="color: #BDD971; margin: 0 0 15px; text-align: center; font-size: 24px;">이메일 인증</h1>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                            <p>안녕하세요,</p>
                            <p>아래 버튼을 클릭하여 회원가입을 완료하세요</p>
                            <div style="margin-top: 20px;">
                                <a href="${verificationUrl}" style="background-color: #BDD971; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">이메일 인증</a>
                            </div>
                            <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                            <p style="margin-top: 20px;">30분 동안 유효하며,<br>버튼이 작동하지 않을 경우 아래 링크로 접속해주세요</p>
                            <p style="color: gray;">${verificationUrl}</p>
                        </div>
                    </body>
                `
            });
        } catch (emailError) {
            return res.status(201).json({ 
                message: '회원가입이 완료되었습니다. 이메일 전송에 실패했습니다. 관리자에게 문의해주세요.',
                error: '이메일 전송 실패'
            });
        }

        res.status(201).json({ message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.' });
    } catch (error) {
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// 이메일 인증
router.get('/verify/:encryptedToken', async (req, res) => {
    try {
        const encryptedToken = req.params.encryptedToken;
        const verificationToken = decryptUrl(encryptedToken);

        // 토큰으로 사용자 찾기 (만료 시간도 확인)
        const [users] = await pool.query(
            'SELECT * FROM users WHERE verification_token = ? AND verification_token_expires > NOW()',
            [verificationToken]
        );

        if (users.length === 0) {
            // 인증 실패 시 로그인 페이지로 리다이렉트
            return res.redirect('/login?error=invalid_token');
        }

        // 사용자 인증 상태 업데이트
        await pool.query(
            'UPDATE users SET is_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE verification_token = ?',
            [verificationToken]
        );

        // 인증 성공 시 로그인 페이지로 리다이렉트
        res.redirect('/login?success=verified');
    } catch (error) {
        res.redirect('/login?error=verification_failed');
    }
});

// 로그인
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip;

    try {
        // 로그인 시도 횟수 확인
        const attempts = loginAttempts.get(ip) || { count: 0, timestamp: Date.now() };
        if (attempts.count >= MAX_ATTEMPTS) {
            const timeLeft = LOCKOUT_TIME - (Date.now() - attempts.timestamp);
            if (timeLeft > 0) {
                return res.status(429).json({ 
                    error: `너무 많은 로그인 시도. ${Math.ceil(timeLeft / 60000)}분 후에 다시 시도해주세요.` 
                });
            } else {
                loginAttempts.delete(ip);
            }
        }

        // 입력된 값이 이메일 형식인지 확인
        const isEmail = email.includes('@');

        let user;
        if (isEmail) {
            // 이메일로 사용자 찾기
            const [rows] = await pool.query('SELECT *, vote_history_count FROM users WHERE email = ?', [email]);
            user = rows[0];
        } else {
            // 이름으로 사용자 찾기
            const [rows] = await pool.query('SELECT *, vote_history_count FROM users WHERE name = ?', [email]);
            user = rows[0];
        }

        if (!user) {
            loginAttempts.set(ip, { count: attempts.count + 1, timestamp: Date.now() });
            return res.status(401).json({ error: '이메일/이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 이메일 인증 확인
        if (!user.is_verified) {
            return res.status(401).json({ error: '이메일 인증이 필요합니다. 이메일을 확인해주세요.' });
        }

        // 비밀번호 확인
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            loginAttempts.set(ip, { count: attempts.count + 1, timestamp: Date.now() });
            return res.status(401).json({ error: '이메일/이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 로그인 성공 시 시도 횟수 초기화
        loginAttempts.delete(ip);

        // 세션 재생성
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ error: '세션 생성 중 오류가 발생했습니다.' });
            }

            // 세션에 사용자 정보 저장
            req.session.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                userType: user.user_type,
                voteHistoryCount: user.vote_history_count
            };
            req.session.lastActivity = Date.now();

            res.status(200).json({ 
                message: '로그인 성공',
                user: req.session.user
            });
        });

    } catch (error) {
        res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
});

// 로그아웃
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다.' });
        }
        res.status(200).json({ message: '로그아웃되었습니다.' });
    });
});

// 비밀번호 변경
router.post('/change-password', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    try {
        // 현재 사용자 정보 조회
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 현재 비밀번호 확인
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
        }

        // 새 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 비밀번호 업데이트
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
    }
});

// 현재 로그인한 사용자 정보 조회
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    res.json({ user: req.session.user });
});

// 사용자 설정 업데이트
router.post('/settings', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    const { voteHistoryCount } = req.body;

    // 유효성 검사 (0-20 사이의 정수인지 확인)
    if (voteHistoryCount !== undefined) {
        const count = parseInt(voteHistoryCount, 10);
        if (isNaN(count) || count < 0 || count > 20) {
            return res.status(400).json({ error: '투표 기록 표시 개수는 0부터 20 사이의 정수여야 합니다.' });
        }
    }

    try {
        const updateFields = [];
        const updateValues = [];

        if (voteHistoryCount !== undefined) {
            updateFields.push('vote_history_count = ?');
            updateValues.push(voteHistoryCount);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: '업데이트할 설정이 없습니다.' });
        }

        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        updateValues.push(userId);

        await pool.query(query, updateValues);

        // 세션 정보 업데이트 (필요하다면)
        if (voteHistoryCount !== undefined) {
            req.session.user.voteHistoryCount = parseInt(voteHistoryCount, 10);
        }

        res.status(200).json({ message: '설정이 성공적으로 업데이트되었습니다.' });
    } catch (error) {
        res.status(500).json({ error: '설정 업데이트 중 오류가 발생했습니다.' });
    }
});

module.exports = {
    router,
    encryptUrl,
    decryptUrl
}; 