const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// 현재 진행 중인 투표 가져오기
router.get('/current', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const [votes] = await pool.query(
            'SELECT * FROM votes WHERE start_time <= ? AND end_time > ? ORDER BY created_at DESC LIMIT 1',
            [now, now]
        );

        if (votes.length === 0) {
            return res.json(null);
        }

        const vote = votes[0];
        const [items] = await pool.query(
            'SELECT * FROM vote_items WHERE vote_id = ?',
            [vote.id]
        );

        res.json({
            id: vote.id,
            title: vote.title,
            description: vote.description,
            startTime: vote.start_time,
            endTime: vote.end_time,
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                votes: item.votes
            }))
        });
    } catch (error) {
        console.error('투표 정보 가져오기 오류:', error);
        res.status(500).json({ error: '투표 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 투표 기록 가져오기
router.get('/history', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const [votes] = await pool.query(
            'SELECT * FROM votes WHERE end_time <= ? ORDER BY end_time DESC LIMIT 10',
            [now]
        );

        const votesWithItems = await Promise.all(votes.map(async vote => {
            const [items] = await pool.query(
                'SELECT * FROM vote_items WHERE vote_id = ?',
                [vote.id]
            );

            return {
                id: vote.id,
                title: vote.title,
                description: vote.description,
                createdAt: vote.created_at,
                startTime: vote.start_time,
                endTime: vote.end_time,
                items: items.map(item => ({
                    id: item.id,
                    name: item.name,
                    votes: item.votes
                }))
            };
        }));

        res.json(votesWithItems);
    } catch (error) {
        console.error('투표 기록 가져오기 오류:', error);
        res.status(500).json({ error: '투표 기록을 가져오는 중 오류가 발생했습니다.' });
    }
});

// 투표하기
router.post('/:voteId/vote', requireAuth, async (req, res) => {
    try {
        const { voteId } = req.params;
        const { itemId } = req.body;
        const userId = req.session.user.id;

        // 이미 투표했는지 확인
        const [existingVotes] = await pool.query(
            'SELECT * FROM vote_results WHERE vote_id = ? AND user_id = ?',
            [voteId, userId]
        );

        if (existingVotes.length > 0) {
            return res.status(400).json({ error: '이미 투표하셨습니다.' });
        }

        // 투표 결과 저장
        await pool.query(
            'INSERT INTO vote_results (vote_id, user_id, item_id) VALUES (?, ?, ?)',
            [voteId, userId, itemId]
        );

        // 투표 수 업데이트
        await pool.query(
            'UPDATE vote_items SET votes = votes + 1 WHERE id = ?',
            [itemId]
        );

        res.json({ message: '투표가 완료되었습니다.' });
    } catch (error) {
        console.error('투표 오류:', error);
        res.status(500).json({ error: '투표 중 오류가 발생했습니다.' });
    }
});

module.exports = router; 