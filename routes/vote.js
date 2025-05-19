const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy
} = require('firebase/firestore');

// 가게 목록 조회
router.get('/restaurants', async (req, res) => {
    try {
        const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
        const restaurants = [];
        restaurantsSnapshot.forEach(doc => {
            restaurants.push({ id: doc.id, ...doc.data() });
        });
        res.json(restaurants);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 가게 추가 (선생님만)
router.post('/restaurants', async (req, res) => {
    try {
        const { name, menus } = req.body;
        const restaurantData = {
            name,
            menus,
            createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, 'restaurants'), restaurantData);
        res.status(201).json({ id: docRef.id, ...restaurantData });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 투표 생성 (선생님만)
router.post('/votes', async (req, res) => {
    try {
        const { restaurantId, endTime } = req.body;
        const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
        
        if (!restaurantDoc.exists()) {
            return res.status(404).json({ error: '가게를 찾을 수 없습니다.' });
        }

        const voteData = {
            restaurantId,
            restaurantName: restaurantDoc.data().name,
            menus: restaurantDoc.data().menus,
            endTime,
            status: 'active',
            createdAt: new Date().toISOString(),
            votes: {}
        };

        const docRef = await addDoc(collection(db, 'votes'), voteData);
        res.status(201).json({ id: docRef.id, ...voteData });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 활성화된 투표 목록 조회
router.get('/votes/active', async (req, res) => {
    try {
        const votesQuery = query(
            collection(db, 'votes'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc')
        );
        
        const votesSnapshot = await getDocs(votesQuery);
        const votes = [];
        votesSnapshot.forEach(doc => {
            votes.push({ id: doc.id, ...doc.data() });
        });
        res.json(votes);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 투표하기
router.post('/votes/:voteId/vote', async (req, res) => {
    try {
        const { voteId } = req.params;
        const { userId, menuIndex } = req.body;
        
        const voteDoc = await getDoc(doc(db, 'votes', voteId));
        if (!voteDoc.exists()) {
            return res.status(404).json({ error: '투표를 찾을 수 없습니다.' });
        }

        const voteData = voteDoc.data();
        if (voteData.status !== 'active') {
            return res.status(400).json({ error: '종료된 투표입니다.' });
        }

        // 이전 투표 제거
        const votes = voteData.votes || {};
        delete votes[userId];

        // 새 투표 추가
        votes[userId] = menuIndex;

        await updateDoc(doc(db, 'votes', voteId), { votes });
        res.json({ message: '투표가 완료되었습니다.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 투표 종료 (선생님만)
router.post('/votes/:voteId/end', async (req, res) => {
    try {
        const { voteId } = req.params;
        await updateDoc(doc(db, 'votes', voteId), {
            status: 'ended',
            endedAt: new Date().toISOString()
        });
        res.json({ message: '투표가 종료되었습니다.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 