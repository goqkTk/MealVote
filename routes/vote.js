const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const webpush = require('web-push'); // web-push 라이브러리 추가

// Socket.IO 인스턴스를 가져오기 위한 함수
let io;
function setSocketIO(socketIO) {
    io = socketIO;
}

// VAPID 키 설정
const vapidPublicKey = process.env.VAPID_PUBLIC;
const vapidPrivateKey = process.env.VAPID_PRIVATE;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID public and private keys are not set in environment variables!');
  console.error('Push notifications will not work.');
} else {
  webpush.setVapidDetails(
    'mailto:' + process.env.EMAIL_USER,
    vapidPublicKey,
    vapidPrivateKey
  );
}

// VAPID 공개 키 제공 엔드포인트
router.get('/vapid-public-key', (req, res) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC;
  if (!vapidPublicKey) {
    return res.status(500).json({ error: 'VAPID public key not configured.' });
  }
  res.status(200).json({ vapidPublicKey });
});

// 푸시 알림 구독 정보 저장 엔드포인트
router.post('/subscribe', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const subscription = req.body; // 클라이언트에서 전송한 구독 객체

    // TODO: 구독 정보 유효성 검사 필요 (subscription 객체의 구조 확인 등)
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Invalid subscription data.' });
    }

    try {
        // 데이터베이스에 구독 정보 저장 또는 업데이트
        // users 테이블에 push_subscription 컬럼이 있다고 가정
        // 컬럼 타입은 TEXT 또는 JSON 타입을 지원하는 경우 JSON, TEXT만 지원하면 JSON.stringify 사용
        const [result] = await pool.query(
            'UPDATE users SET push_subscription = ? WHERE id = ?',
            [JSON.stringify(subscription), userId] // 구독 객체를 JSON 문자열로 저장
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Subscription saved successfully.' });
        } else {
            // 사용자가 없는 경우는 requireAuth에서 처리되므로 여기에 올 일은 거의 없습니다.
             res.status(404).json({ error: 'User not found.' });
        }

    } catch (error) {
        res.status(500).json({ error: 'Failed to save subscription.' });
    }
});

// 푸시 알림 구독 해제 엔드포인트
router.post('/unsubscribe', requireAuth, async (req, res) => {
    try {
        const { subscription } = req.body;
        
        // 사용자의 구독 정보 삭제
        await pool.query(
            'UPDATE users SET push_subscription = NULL WHERE id = ?',
            [req.user.id]
        );
        
        res.status(200).json({ message: 'Successfully unsubscribed' });
    } catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
    }
});

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
        res.status(500).json({ error: '투표 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 투표 기록 조회
router.get('/history', requireAuth, async (req, res) => {
    try {
        let limit;
        if (req.query.limit === 'all') {
            limit = null; // 제한 없음
        } else {
            limit = req.query.limit ? parseInt(req.query.limit) : 10;
        }

        let votesQuery = `
            SELECT v.*, r.name as restaurantName
            FROM votes v
            JOIN restaurants r ON v.restaurant_id = r.id
            WHERE v.end_time <= NOW()
            ORDER BY v.end_time DESC
        `;
        let votesParams = [];
        if (limit) {
            votesQuery += ' LIMIT ?';
            votesParams.push(limit);
        }

        const [votes] = await pool.query(votesQuery, votesParams);

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
                             WHERE vi2.vote_id = vi.vote_id AND vr2.user_id = ? AND vi2.menu_id = m.id) as user_voted
                FROM vote_items vi
                JOIN menus m ON vi.menu_id = m.id
                LEFT JOIN vote_records vr ON vr.vote_item_id = vi.id
                WHERE vi.vote_id = ?
                GROUP BY m.id
            `, [req.user.id, vote.id]);
            vote.menus = menus;
        }

        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: '투표 기록을 가져오는 중 오류가 발생했습니다.' });
    }
});

// 투표 생성 (선생님만)
router.post('/', requireAuth, async (req, res) => {
    if (req.user.userType !== 'teacher') {
        return res.status(403).json({ error: '선생님만 투표를 생성할 수 있습니다.' });
    }

    const { title, restaurantId, menuIds, endTime } = req.body;

    // 입력값 검증
    if (!title || typeof title !== 'string' || title.length > 100) {
        return res.status(400).json({ error: '유효하지 않은 투표 제목입니다.' });
    }

    if (!restaurantId || isNaN(restaurantId)) {
        return res.status(400).json({ error: '유효하지 않은 가게 ID입니다.' });
    }

    if (!Array.isArray(menuIds) || menuIds.length === 0) {
        return res.status(400).json({ error: '유효하지 않은 메뉴 목록입니다.' });
    }

    if (!endTime || isNaN(new Date(endTime).getTime())) {
        return res.status(400).json({ error: '유효하지 않은 마감 시간입니다.' });
    }

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
                voteId: voteId,
                message: '새로운 투표가 생성되었습니다.'
            });
        }

        res.status(201).json({ message: '투표가 생성되었습니다.' });

        // --- 푸시 알림 전송 로직 추가 --- START
        // 푸시 알림을 보낼 대상 사용자들의 구독 정보 가져오기
        // 여기서는 모든 사용자에게 보낸다고 가정하고 push_subscription이 있는 모든 사용자를 조회합니다.
        const [subscribers] = await pool.query(
            'SELECT push_subscription FROM users WHERE push_subscription IS NOT NULL'
        );

        const notificationPayload = JSON.stringify({
            title: '새로운 투표가 시작되었습니다!',
            body: `${title} 투표에 참여하세요!`, // 투표 제목 사용
            icon: '/images/smcicon.png', // 알림 아이콘
            data: { // 클릭 시 열릴 URL 등 추가 데이터
                url: '/' // 투표 페이지 URL
            }
        });

        // 구독자들에게 푸시 알림 전송 시도
        for (const subscriber of subscribers) {
            try {
                const subscription = JSON.parse(subscriber.push_subscription);
                const sendResult = await webpush.sendNotification(subscription, notificationPayload);
            } catch (error) {
                // 구독 정보 파싱 오류 또는 푸시 전송 오류 처리
                
                // 만료된 구독 정보 처리 (GCM 오류 코드 410)
                if (error.statusCode === 410) {
                    console.log('Subscription expired, removing from database.');
                     try {
                         // TODO: 특정 사용자의 구독 정보만 삭제하도록 쿼리 수정 필요
                         // 현재 쿼리는 해당 구독 정보 문자열과 일치하는 모든 레코드를 삭제합니다.
                         await pool.query('UPDATE users SET push_subscription = NULL WHERE push_subscription = ?', [subscriber.push_subscription]);
                         console.log('Expired subscription removed from database.');
                     } catch (dbError) {
                         console.error('Error removing expired subscription from database:', dbError);
                     }
                }
            }
        }
        // --- 푸시 알림 전송 로직 추가 --- END

    } catch (error) {
        // 트랜잭션 롤백
        await pool.query('ROLLBACK');
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
                message: '투표가 업데이트되었습니다.'
            });
        }

        res.json({ message: '투표가 완료되었습니다.' });

    } catch (error) {
        res.status(500).json({ error: '투표 중 오류가 발생했습니다.' });
    }
});

// 투표 마감 API
router.post('/:voteId/end', requireAuth, async (req, res) => {
    if (req.user.userType !== 'teacher') {
        return res.status(403).json({ error: '선생님만 투표를 마감할 수 있습니다.' });
    }

    const voteId = req.params.voteId;

    try {
        // 투표 마감 시간 업데이트
        await pool.query(
            'UPDATE votes SET end_time = NOW() WHERE id = ?',
            [voteId]
        );

        // 실시간 업데이트를 위한 이벤트 발생
        if (io) {
            io.emit('voteEnded', { 
                voteId: voteId,
                message: '투표가 마감되었습니다.'
            });
        }

        res.json({ message: '투표가 마감되었습니다.' });
    } catch (error) {
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
        res.status(500).json({ error: '투표자 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

module.exports = { router, setSocketIO }; 