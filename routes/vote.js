const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// 현재 진행 중인 투표 조회
router.get('/current', requireAuth, async (req, res) => {
    try {
        const [votes] = await pool.query(`
            SELECT v.*, r.name as restaurantName
            FROM votes v
            JOIN restaurants r ON v.restaurant_id = r.id
            WHERE v.end_time > NOW()
            ORDER BY v.end_time ASC
            LIMIT 1
        `);

        if (votes.length === 0) {
            return res.json(null);
        }

        const vote = votes[0];

        // 투표에 포함된 메뉴와 투표 수 조회
        const [menus] = await pool.query(`
            SELECT m.*, COUNT(vr.id) as votes
            FROM vote_items vi
            JOIN menus m ON vi.menu_id = m.id
            LEFT JOIN vote_records vr ON vr.vote_item_id = vi.id
            WHERE vi.vote_id = ?
            GROUP BY m.id
        `, [vote.id]);

        vote.menus = menus;
        res.json(vote);
    } catch (error) {
        console.error('현재 투표 조회 오류:', error);
        res.status(500).json({ error: '투표 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 투표 기록 조회
router.get('/history', requireAuth, async (req, res) => {
    try {
        const [votes] = await pool.query(`
            SELECT v.*, r.name as restaurantName
            FROM votes v
            JOIN restaurants r ON v.restaurant_id = r.id
            ORDER BY v.end_time DESC
            LIMIT 10
        `);

        // 각 투표의 메뉴와 투표 수 조회
        for (let vote of votes) {
            const [menus] = await pool.query(`
                SELECT m.*, COUNT(vr.id) as votes
                FROM vote_items vi
                JOIN menus m ON vi.menu_id = m.id
                LEFT JOIN vote_records vr ON vr.vote_item_id = vi.id
                WHERE vi.vote_id = ?
                GROUP BY m.id
            `, [vote.id]);
            vote.menus = menus;
        }

        res.json(votes);
    } catch (error) {
        console.error('투표 기록 조회 오류:', error);
        res.status(500).json({ error: '투표 기록을 가져오는 중 오류가 발생했습니다.' });
    }
});

// 투표 생성 (선생님만)
router.post('/', requireAuth, async (req, res) => {
    if (req.user.userType !== 'teacher') {
        return res.status(403).json({ error: '선생님만 투표를 생성할 수 있습니다.' });
    }

    const { title, restaurantId, menuIds, endTime } = req.body;

    try {
        // 트랜잭션 시작
        await pool.query('START TRANSACTION');

        // 투표 생성 (vote_date는 서버에서 CURDATE()로 자동 설정)
        const [result] = await pool.query(`
            INSERT INTO votes (title, vote_date, restaurant_id, end_time, created_by)
            VALUES (?, CURDATE(), ?, ?, ?)
        `, [title, restaurantId, endTime, req.user.id]);

        const voteId = result.insertId;

        // 투표 항목 추가
        for (const menuId of menuIds) {
            await pool.query(`
                INSERT INTO vote_items (vote_id, menu_id)
                VALUES (?, ?)
            `, [voteId, menuId]);
        }

        // 트랜잭션 커밋
        await pool.query('COMMIT');

        res.status(201).json({ message: '투표가 생성되었습니다.' });
    } catch (error) {
        // 트랜잭션 롤백
        await pool.query('ROLLBACK');
        console.error('투표 생성 오류:', error);
        res.status(500).json({ error: '투표 생성 중 오류가 발생했습니다.' });
    }
});

// 투표하기
router.post('/:voteId/vote', requireAuth, async (req, res) => {
    const { voteId } = req.params;
    const { menuId } = req.body;

    try {
        // 투표가 진행 중인지 확인
        const [votes] = await pool.query(`
            SELECT * FROM votes
            WHERE id = ? AND end_time > NOW()
        `, [voteId]);

        if (votes.length === 0) {
            return res.status(400).json({ error: '종료된 투표입니다.' });
        }

        // 이미 투표했는지 확인
        const [existingVotes] = await pool.query(`
            SELECT * FROM vote_records
            WHERE vote_id = ? AND user_id = ?
        `, [voteId, req.user.id]);

        if (existingVotes.length > 0) {
            return res.status(400).json({ error: '이미 투표하셨습니다.' });
        }

        // 투표 항목이 유효한지 확인
        const [voteItems] = await pool.query(`
            SELECT * FROM vote_items
            WHERE vote_id = ? AND menu_id = ?
        `, [voteId, menuId]);

        if (voteItems.length === 0) {
            return res.status(400).json({ error: '유효하지 않은 투표 항목입니다.' });
        }

        // 투표 기록 추가
        await pool.query(`
            INSERT INTO vote_records (vote_id, vote_item_id, user_id)
            VALUES (?, ?, ?)
        `, [voteId, voteItems[0].id, req.user.id]);

        res.json({ message: '투표가 완료되었습니다.' });
    } catch (error) {
        console.error('투표 오류:', error);
        res.status(500).json({ error: '투표 중 오류가 발생했습니다.' });
    }
});

module.exports = router; 