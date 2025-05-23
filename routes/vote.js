const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Socket.IO 인스턴스를 가져오기 위한 함수
let io;
function setSocketIO(socketIO) {
    io = socketIO;
}

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

        // 날짜 필드를 ISO 문자열로 변환하여 클라이언트로 전송
        if (vote.vote_date) {
            vote.voteDate = new Date(vote.vote_date).toISOString();
        }
        if (vote.end_time) {
            vote.endTime = new Date(vote.end_time).toISOString();
        }

        // 투표에 포함된 메뉴와 투표 수 조회, 사용자 투표 정보 포함
        const [menus] = await pool.query(`
            SELECT m.*, COUNT(vr.id) as votes,
                   (SELECT vi2.id FROM vote_records vr2 JOIN vote_items vi2 ON vr2.vote_item_id = vi2.id WHERE vi2.vote_id = vi.vote_id AND vr2.user_id = ?) as user_voted_item_id
            FROM vote_items vi
            JOIN menus m ON vi.menu_id = m.id
            LEFT JOIN vote_records vr ON vr.vote_item_id = vi.id
            WHERE vi.vote_id = ?
            GROUP BY m.id
        `, [req.user.id, vote.id]);

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
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;

        const [votes] = await pool.query(`
            SELECT DISTINCT v.*, r.name as restaurantName
            FROM votes v
            JOIN restaurants r ON v.restaurant_id = r.id
            JOIN vote_records vr ON v.id = vr.vote_id
            WHERE vr.user_id = ?
            ORDER BY v.end_time DESC
            LIMIT ?
        `, [req.user.id, limit]);

        // 각 투표의 메뉴와 투표 수 조회 및 날짜 필드 형식 변환
        for (let vote of votes) {
            // 날짜 필드를 ISO 문자열로 변환하여 클라이언트로 전송
            if (vote.vote_date) {
                vote.voteDate = new Date(vote.vote_date).toISOString();
            }
            if (vote.end_time) {
                vote.endTime = new Date(vote.end_time).toISOString();
            }

            const [menus] = await pool.query(`
                SELECT m.*, COUNT(vr.id) as votes,
                       EXISTS(SELECT 1 FROM vote_records vr2 
                             JOIN vote_items vi2 ON vr2.vote_item_id = vi2.id 
                             WHERE vi2.vote_id = ? AND vr2.user_id = ? AND vi2.menu_id = m.id) as user_voted
                FROM vote_items vi
                JOIN menus m ON vi.menu_id = m.id
                LEFT JOIN vote_records vr ON vr.vote_item_id = vi.id
                WHERE vi.vote_id = ?
                GROUP BY m.id
            `, [vote.id, req.user.id, vote.id]);
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

        // 실시간 업데이트를 위한 이벤트 발생
        if (io) {
            io.emit('voteCreated', { 
                message: '새로운 투표가 생성되었습니다.',
                voteId: voteId
            });
        }

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

        // 이미 투표했는지 확인 및 기존 투표 삭제
        const [existingVoteItems] = await pool.query(`
            SELECT vi.id
            FROM vote_records vr
            JOIN vote_items vi ON vr.vote_item_id = vi.id
            WHERE vr.vote_id = ? AND vr.user_id = ?
        `, [voteId, req.user.id]);

        if (existingVoteItems.length > 0) {
            // 기존 투표 기록 삭제
            await pool.query('DELETE FROM vote_records WHERE vote_id = ? AND user_id = ?', [voteId, req.user.id]);
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

        // 실시간 업데이트를 위한 이벤트 발생
        if (io) {
            io.emit('voteUpdated', { 
                voteId: voteId,
                message: existingVoteItems.length > 0 ? '투표가 변경되었습니다.' : '투표가 완료되었습니다.'
            });
        }

        res.json({ message: existingVoteItems.length > 0 ? '투표가 변경되었습니다.' : '투표가 완료되었습니다.' });

    } catch (error) {
        console.error('투표 오류:', error);
        res.status(500).json({ error: '투표 중 오류가 발생했습니다.' });
    }
});

// 투표 마감 API
router.post('/:voteId/end', requireAuth, async (req, res) => {
    try {
        const { voteId } = req.params;
        const userId = req.user.id;

        // 사용자가 선생님인지 확인
        const [users] = await pool.query(
            'SELECT user_type FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0 || users[0].user_type !== 'teacher') {
            return res.status(403).json({ error: '선생님만 투표를 마감할 수 있습니다.' });
        }

        // 투표 상태 업데이트
        await pool.query(
            'UPDATE votes SET end_time = NOW() WHERE id = ?',
            [voteId]
        );

        // 실시간 업데이트를 위해 이벤트 발생
        if (io) {
            io.emit('voteEnded', { 
                voteId: voteId,
                message: '투표가 마감되었습니다.' 
            });
        }

        res.json({ message: '투표가 마감되었습니다.' });
    } catch (error) {
        console.error('투표 마감 오류:', error);
        res.status(500).json({ error: '투표 마감 중 오류가 발생했습니다.' });
    }
});

// 투표자 목록 조회
router.get('/:voteId/voters', requireAuth, async (req, res) => {
    try {
        const { voteId } = req.params;
        const { menuId } = req.query;

        const [voters] = await pool.query(`
            SELECT u.name
            FROM vote_records vr
            JOIN vote_items vi ON vr.vote_item_id = vi.id
            JOIN users u ON vr.user_id = u.id
            WHERE vi.vote_id = ? AND vi.menu_id = ?
            ORDER BY vr.created_at DESC
        `, [voteId, menuId]);

        res.json(voters);
    } catch (error) {
        console.error('투표자 목록 조회 오류:', error);
        res.status(500).json({ error: '투표자 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

module.exports = { router, setSocketIO }; 