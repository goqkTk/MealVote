// DOM 요소
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const adminSection = document.getElementById('adminSection');
const voteForm = document.getElementById('voteForm');
const menuList = document.getElementById('menuList');
const voteResults = document.getElementById('voteResults');
const addStoreBtn = document.getElementById('addStoreBtn');
const storeModal = new bootstrap.Modal(document.getElementById('storeModal'));
const storeForm = document.getElementById('storeForm');
const addMenuBtn = document.getElementById('addMenuBtn');
const saveStoreBtn = document.getElementById('saveStoreBtn');

// 현재 사용자 상태
let currentUser = null;
let isAdmin = false;

// 로그인 상태 변경 감지
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // 사용자 역할 확인
        const userDoc = await db.collection('users').doc(user.uid).get();
        isAdmin = userDoc.exists && userDoc.data().isAdmin;
        
        // UI 업데이트
        updateLoginStatus();
        updateAdminSection();
    } else {
        currentUser = null;
        isAdmin = false;
        loginStatus.innerHTML = '<button id="loginBtn" class="btn btn-outline-primary">로그인</button>';
        adminSection.classList.add('d-none');
    }
});

// 로그인 버튼 클릭 이벤트
loginBtn.addEventListener('click', () => {
    auth.signInWithPopup(provider);
});

// 로그인 상태 UI 업데이트
function updateLoginStatus() {
    loginStatus.innerHTML = `
        <div class="user-info">
            <img src="${currentUser.photoURL}" alt="프로필" class="user-avatar">
            <span>${currentUser.displayName}</span>
            <button class="btn btn-outline-danger btn-sm" onclick="logout()">로그아웃</button>
        </div>
    `;
}

// 관리자 섹션 UI 업데이트
function updateAdminSection() {
    if (isAdmin) {
        adminSection.classList.remove('d-none');
    } else {
        adminSection.classList.add('d-none');
    }
}

// 로그아웃
function logout() {
    auth.signOut();
}

// 투표 폼 제출 이벤트
voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    const selectedMenu = document.querySelector('input[name="menu"]:checked');
    if (!selectedMenu) {
        alert('메뉴를 선택해주세요.');
        return;
    }

    try {
        await db.collection('votes').add({
            userId: currentUser.uid,
            menuId: selectedMenu.value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('투표가 완료되었습니다.');
    } catch (error) {
        console.error('투표 중 오류 발생:', error);
        alert('투표 중 오류가 발생했습니다.');
    }
});

// 가게/메뉴 추가 버튼 클릭 이벤트
addStoreBtn.addEventListener('click', () => {
    if (!isAdmin) {
        alert('관리자만 접근할 수 있습니다.');
        return;
    }
    storeModal.show();
});

// 메뉴 입력 필드 추가
addMenuBtn.addEventListener('click', () => {
    const menuItem = document.createElement('div');
    menuItem.className = 'input-group mb-2';
    menuItem.innerHTML = `
        <input type="text" class="form-control menu-input" required>
        <button type="button" class="btn btn-outline-danger remove-menu">삭제</button>
    `;
    document.getElementById('menuItems').appendChild(menuItem);
});

// 메뉴 삭제 버튼 이벤트 위임
document.getElementById('menuItems').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-menu')) {
        e.target.parentElement.remove();
    }
});

// 가게 저장 버튼 클릭 이벤트
saveStoreBtn.addEventListener('click', async () => {
    const storeName = document.getElementById('storeName').value;
    const menuInputs = document.querySelectorAll('.menu-input');
    const menus = Array.from(menuInputs).map(input => input.value);

    if (!storeName || menus.length === 0) {
        alert('가게 이름과 메뉴를 모두 입력해주세요.');
        return;
    }

    try {
        await db.collection('stores').add({
            name: storeName,
            menus: menus,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        storeModal.hide();
        storeForm.reset();
        document.getElementById('menuItems').innerHTML = `
            <div class="input-group mb-2">
                <input type="text" class="form-control menu-input" required>
                <button type="button" class="btn btn-outline-danger remove-menu">삭제</button>
            </div>
        `;
        alert('가게가 추가되었습니다.');
    } catch (error) {
        console.error('가게 추가 중 오류 발생:', error);
        alert('가게 추가 중 오류가 발생했습니다.');
    }
});

// 실시간 투표 현황 업데이트
function updateVoteResults() {
    if (!isAdmin) return;

    db.collection('votes')
        .where('timestamp', '>=', new Date(new Date().setHours(0, 0, 0, 0)))
        .onSnapshot((snapshot) => {
            const votes = {};
            snapshot.forEach((doc) => {
                const vote = doc.data();
                votes[vote.menuId] = (votes[vote.menuId] || 0) + 1;
            });

            // 투표 결과 UI 업데이트
            voteResults.innerHTML = Object.entries(votes)
                .map(([menuId, count]) => `
                    <div class="vote-result">
                        <span>${menuId}</span>
                        <div class="progress flex-grow-1">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${(count / snapshot.size) * 100}%">
                                ${count}표
                            </div>
                        </div>
                    </div>
                `).join('');
        });
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    updateVoteResults();
}); 