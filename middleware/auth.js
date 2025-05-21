const jwt = require('jsonwebtoken');
// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 세션 기반 인증 미들웨어
const requireAuth = (req, res, next) => {
    // 세션에 사용자 정보가 있는지 확인
    if (!req.session || !req.session.user) {
        // 세션이 없거나 사용자 정보가 없으면 인증 실패
        return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    // 세션에 사용자 정보가 있으면 다음 미들웨어 또는 라우트 핸들러로 진행
    req.user = req.session.user; // req.user에 세션 사용자 정보를 할당하여 다른 곳에서 사용할 수 있도록 함
    next();
};

module.exports = { requireAuth }; 