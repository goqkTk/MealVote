const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');
const { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification
} = require('firebase/auth');
const { doc, setDoc, getDoc } = require('firebase/firestore');

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { email, password, userType, name } = req.body;
        
        // Firebase Auth로 사용자 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 이메일 인증 메일 발송
        await sendEmailVerification(user);

        // Firestore에 사용자 정보 저장
        await setDoc(doc(db, 'users', user.uid), {
            email: email,
            userType: userType, // 'student' 또는 'teacher'
            name: name,
            createdAt: new Date().toISOString()
        });

        res.status(201).json({ message: '회원가입이 완료되었습니다. 이메일 인증을 확인해주세요.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 이메일 인증 확인
        if (!user.emailVerified) {
            await signOut(auth);
            return res.status(401).json({ error: '이메일 인증이 필요합니다.' });
        }

        // 사용자 정보 가져오기
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        res.json({
            user: {
                uid: user.uid,
                email: user.email,
                userType: userData.userType,
                name: userData.name
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 로그아웃
router.post('/logout', async (req, res) => {
    try {
        await signOut(auth);
        res.json({ message: '로그아웃되었습니다.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 