const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// 가게 목록 조회
router.get('/', requireAuth, async (req, res) => {
    try {
        const [restaurants] = await pool.query(`
            SELECT * FROM restaurants
            ORDER BY name ASC
        `);
        res.json(restaurants);
    } catch (error) {
        console.error('가게 목록 조회 오류:', error);
        res.status(500).json({ error: '가게 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

// 가게 메뉴 조회
router.get('/:id/menus', requireAuth, async (req, res) => {
    try {
        // 가게 정보 조회
        const [restaurants] = await pool.query(`
            SELECT * FROM restaurants
            WHERE id = ?
        `, [req.params.id]);

        if (restaurants.length === 0) {
            return res.status(404).json({ error: '가게를 찾을 수 없습니다.' });
        }

        const restaurant = restaurants[0];

        // 메뉴 목록 조회
        const [menus] = await pool.query(`
            SELECT * FROM menus
            WHERE restaurant_id = ?
            ORDER BY name ASC
        `, [req.params.id]);

        // 각 메뉴에 가게 정보 추가
        const menusWithRestaurant = menus.map(menu => ({
            ...menu,
            restaurant: restaurant
        }));

        res.json(menusWithRestaurant);
    } catch (error) {
        console.error('가게 정보 조회 오류:', error);
        res.status(500).json({ error: '가게 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 가게 추가 (선생님만)
router.post('/', requireAuth, async (req, res) => {
    if (req.user.userType !== 'teacher') {
        return res.status(403).json({ error: '선생님만 가게를 추가할 수 있습니다.' });
    }

    const { name, description, menus } = req.body;

    // 입력값 검증
    if (!name || typeof name !== 'string' || name.length > 100) {
        return res.status(400).json({ error: '유효하지 않은 가게 이름입니다.' });
    }

    if (description && (typeof description !== 'string' || description.length > 500)) {
        return res.status(400).json({ error: '유효하지 않은 가게 설명입니다.' });
    }

    if (!Array.isArray(menus) || menus.length === 0) {
        return res.status(400).json({ error: '유효하지 않은 메뉴 목록입니다.' });
    }

    // 메뉴 입력값 검증
    for (const menu of menus) {
        if (!menu.name || typeof menu.name !== 'string' || menu.name.length > 100) {
            return res.status(400).json({ error: '유효하지 않은 메뉴 이름입니다.' });
        }
        if (menu.price && (typeof menu.price !== 'number' || menu.price < 0)) {
            return res.status(400).json({ error: '유효하지 않은 메뉴 가격입니다.' });
        }
        if (menu.description && (typeof menu.description !== 'string' || menu.description.length > 500)) {
            return res.status(400).json({ error: '유효하지 않은 메뉴 설명입니다.' });
        }
    }

    try {
        // 트랜잭션 시작
        await pool.query('START TRANSACTION');

        // 가게 추가
        const [result] = await pool.query(`
            INSERT INTO restaurants (name, description)
            VALUES (?, ?)
        `, [name, description]);

        const restaurantId = result.insertId;

        // 메뉴 추가
        for (const menu of menus) {
            await pool.query(`
                INSERT INTO menus (restaurant_id, name, price, description)
                VALUES (?, ?, ?, ?)
            `, [restaurantId, menu.name, menu.price, menu.description]);
        }

        // 트랜잭션 커밋
        await pool.query('COMMIT');

        res.status(201).json({ message: '가게가 추가되었습니다.' });
    } catch (error) {
        // 트랜잭션 롤백
        await pool.query('ROLLBACK');
        console.error('가게 추가 오류:', error);
        res.status(500).json({ error: '가게 추가 중 오류가 발생했습니다.' });
    }
});

// 가게 수정 (선생님만)
router.put('/:id', requireAuth, async (req, res) => {
    if (req.user.userType !== 'teacher') {
        return res.status(403).json({ error: '선생님만 가게를 수정할 수 있습니다.' });
    }

    const { name, description, menus } = req.body;
    const restaurantId = req.params.id;

    try {
        // 트랜잭션 시작
        await pool.query('START TRANSACTION');

        // 가게 정보 수정
        await pool.query(`
            UPDATE restaurants
            SET name = ?, description = ?
            WHERE id = ?
        `, [name, description, restaurantId]);

        // 기존 메뉴 삭제
        await pool.query('DELETE FROM menus WHERE restaurant_id = ?', [restaurantId]);

        // 새 메뉴 추가
        for (const menu of menus) {
            await pool.query(`
                INSERT INTO menus (restaurant_id, name, price, description)
                VALUES (?, ?, ?, ?)
            `, [restaurantId, menu.name, menu.price, menu.description]);
        }

        // 트랜잭션 커밋
        await pool.query('COMMIT');

        res.json({ message: '가게가 수정되었습니다.' });
    } catch (error) {
        // 트랜잭션 롤백
        await pool.query('ROLLBACK');
        console.error('가게 수정 오류:', error);
        res.status(500).json({ error: '가게 수정 중 오류가 발생했습니다.' });
    }
});

// 가게 삭제 (선생님만)
router.delete('/:id', requireAuth, async (req, res) => {
    if (req.user.userType !== 'teacher') {
        return res.status(403).json({ error: '선생님만 가게를 삭제할 수 있습니다.' });
    }

    try {
        await pool.query('DELETE FROM restaurants WHERE id = ?', [req.params.id]);
        res.json({ message: '가게가 삭제되었습니다.' });
    } catch (error) {
        console.error('가게 삭제 오류:', error);
        res.status(500).json({ error: '가게 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router; 