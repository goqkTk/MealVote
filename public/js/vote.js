// 활성화된 투표 목록 로드 (학생용)
async function loadActiveVotes() {
    try {
        const response = await fetch('/api/votes/active');
        const votes = await response.json();
        
        const activeVotesContainer = document.getElementById('activeVotes');
        activeVotesContainer.innerHTML = '';

        votes.forEach(vote => {
            const voteCard = createVoteCard(vote);
            activeVotesContainer.appendChild(voteCard);
        });
    } catch (error) {
        console.error('투표 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// 투표 카드 생성
function createVoteCard(vote) {
    const card = document.createElement('div');
    card.className = 'col-md-6 mb-4';
    card.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">${vote.restaurantName}</h5>
                <p class="card-text">종료 시간: ${new Date(vote.endTime).toLocaleString()}</p>
                <div class="list-group">
                    ${vote.menus.map((menu, index) => `
                        <button class="list-group-item list-group-item-action" 
                                onclick="vote(${vote.id}, ${index})">
                            ${menu}
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    return card;
}

// 현재 진행 중인 투표 가져오기
async function getCurrentVote() {
    try {
        const response = await fetch('/api/votes/current');
        if (response.ok) {
            const vote = await response.json();
            displayCurrentVote(vote);
        }
    } catch (error) {
        console.error('투표 정보 가져오기 오류:', error);
    }
}

// 투표 기록 가져오기
async function getVoteHistory() {
    try {
        const response = await fetch('/api/votes/history');
        if (response.ok) {
            const votes = await response.json();
            displayVoteHistory(votes);
        }
    } catch (error) {
        console.error('투표 기록 가져오기 오류:', error);
    }
}

// HTML 특수 문자를 이스케이프하는 함수
function escapeHTML(str) {
    if (typeof str !== 'string') {
        return str; // 문자열이 아니면 그대로 반환 (예: 숫자)
    }
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// 날짜 형식을 YYYY.MM.DD 오전/오후 HH:mm으로 변경하는 함수
function formatDateTime(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString; // 유효하지 않은 날짜면 원본 반환
    }

    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    let hours = date.getHours();
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0시는 12시로

    return `${year}.${month}.${day} ${ampm} ${hours}:${minutes}`;
}

// 날짜만 YYYY.MM.DD 형식으로 변경하는 함수
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString; // 유효하지 않은 날짜면 원본 반환
    }

    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);

    return `${year}.${month}.${day}`;
}

// 현재 진행 중인 투표 표시
let voteTimer;

function displayCurrentVote(vote) {
    // 기존 타이머가 있으면 해제
    if (voteTimer) {
        clearInterval(voteTimer);
        voteTimer = null;
    }

    if (!vote) {
        document.getElementById('currentVote').innerHTML = '<p class="text-muted">현재 진행 중인 투표가 없습니다.</p>';
        return;
    }

    const currentVoteDiv = document.getElementById('currentVote');
    currentVoteDiv.innerHTML = `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="card-title mb-0">${vote.title}</h5>
                    <div class="teacher-actions">
                        <button class="btn btn-danger btn-sm" onclick="endVote('${vote.id}')">
                            <i class="fas fa-stop-circle me-1"></i>투표 마감
                        </button>
                    </div>
                </div>
                <p class="card-text">${vote.description || ''}</p>
                <p class="text-muted">
                    <span><i class="fas fa-calendar me-2"></i>${formatDate(vote.voteDate)}</span>
                    <span><i class="fas fa-clock ms-3 me-2"></i>마감: ${formatDateTime(vote.endTime)}</span>
                </p>
                <div class="list-group">
                    ${vote.menus.map(menu => `
                        <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                                onclick="vote('${vote.id}', '${menu.id}')">
                            ${menu.name}
                            <span class="badge bg-primary rounded-pill" onclick="showVoters('${vote.id}', '${menu.id}', '${menu.name}', event)">
                                ${vote.user_voted_item_id === menu.id ? '내 선택 / ' : ''}${menu.votes}표
                            </span>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // 마감 시간 설정 및 타이머 시작
    const endTime = new Date(vote.endTime).getTime();
    const now = new Date().getTime();
    const timeRemaining = endTime - now;

    if (timeRemaining > 0) {
        // 마감 시간까지 남은 시간 계산 후 해당 시간에 loadCurrentVote 실행
        voteTimer = setTimeout(() => {
            loadCurrentVote(); // 마감된 투표 정보 새로고침
            loadVoteHistory(); // 투표 기록도 새로고침
        }, timeRemaining);
    } else {
        // 이미 마감 시간이 지났다면 바로 새로고침 (페이지 로드 시 마감된 투표일 경우)
        loadCurrentVote();
        loadVoteHistory();
    }
}

// 투표자 목록 표시
async function showVoters(voteId, menuId, menuName, event) {
    event.stopPropagation(); // 투표 버튼 클릭 이벤트 전파 방지
    
    try {
        const response = await fetch(`/api/votes/${voteId}/voters?menuId=${menuId}`);
        if (response.ok) {
            const voters = await response.json();
            const votersList = document.getElementById('votersList');
            const modalTitle = document.getElementById('votersModalTitle');
            
            modalTitle.textContent = `${menuName}`;
            
            if (voters.length === 0) {
                votersList.innerHTML = '<p class="text-muted">아직 투표한 사람이 없습니다.</p>';
            } else {
                votersList.innerHTML = `
                    <ul class="list-unstyled">
                        ${voters.map(voter => `
                            <li class="voter-name">${voter.name}</li>
                        `).join('')}
                    </ul>
                `;
            }
            
            const modal = new bootstrap.Modal(document.getElementById('votersModal'));
            modal.show();
        }
    } catch (error) {
        console.error('투표자 목록 조회 오류:', error);
        alert('투표자 목록을 가져오는 중 오류가 발생했습니다.');
    }
}

// 설정 모달 표시
function showSettingsModal() {
    const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    settingsModal.show();
}

// 투표 기록 로드
async function loadVoteHistory() {
    try {
        // 초기에는 최대 2개만 표시
        const response = await fetch('/api/votes/history?limit=2');
        if (response.ok) {
            const votes = await response.json();
            displayVoteHistory(votes);
        }
    } catch (error) {
        console.error('투표 기록 로드 오류:', error);
    }
}

// 투표 기록 표시
function displayVoteHistory(votes) {
    const historyDiv = document.getElementById('voteHistory');
    if (votes.length === 0) {
        historyDiv.innerHTML = '<p class="text-muted">투표 기록이 없습니다.</p>';
        return;
    }

    historyDiv.innerHTML = votes.map(vote => `
        <div class="card mb-3">
            <div class="card-body">
                <h6 class="card-title">${vote.title}</h6>
                <p class="card-text small text-muted">
                    <span><i class="fas fa-calendar me-2"></i>${formatDate(vote.voteDate)}</span>
                </p>
                <div class="list-group list-group-flush">
                    ${vote.menus.map(menu => `
                        <div class="list-group-item d-flex justify-content-between align-items-center ${menu.user_voted ? 'bg-light' : ''}">
                            ${menu.name}
                            <div>
                                ${menu.user_voted ? '<span class="badge bg-success me-2">내 선택</span>' : ''}
                                <span class="badge bg-primary rounded-pill" onclick="showVoters('${vote.id}', '${menu.id}', '${menu.name}', event)">
                                    ${menu.votes}표
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// 전체 투표 기록 표시 (모달용)
function displayAllVoteHistory(votes) {
    const allHistoryDiv = document.getElementById('allVoteHistoryList');
    if (votes.length === 0) {
        allHistoryDiv.innerHTML = '<p class="text-muted">투표 기록이 없습니다.</p>';
        return;
    }

    allHistoryDiv.innerHTML = votes.map(vote => `
        <div class="card mb-3">
            <div class="card-body">
                <h6 class="card-title">${vote.title}</h6>
                <p class="card-text small text-muted">
                     <span><i class="fas fa-calendar me-2"></i>${formatDate(vote.voteDate)}</span>
                </p>
                <div class="list-group list-group-flush">
                    ${vote.menus.map(menu => `
                        <div class="list-group-item d-flex justify-content-between align-items-center ${menu.user_voted ? 'bg-light' : ''}">
                            ${menu.name}
                            <div>
                                ${menu.user_voted ? '<span class="badge bg-success me-2">내 선택</span>' : ''}
                                <span class="badge bg-primary rounded-pill" onclick="showVoters('${vote.id}', '${menu.id}', '${menu.name}', event)">
                                    ${menu.votes}표
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// 전체 투표 기록 가져오기 및 모달 표시
async function showAllVoteHistory() {
    try {
        const response = await fetch('/api/votes/history'); // limit 없이 모든 기록 가져오기
        if (response.ok) {
            const votes = await response.json();
            displayAllVoteHistory(votes);
            
            const modal = new bootstrap.Modal(document.getElementById('allVoteHistoryModal'));
            modal.show();
        }
    } catch (error) {
        console.error('전체 투표 기록 로드 오류:', error);
        alert('전체 투표 기록을 가져오는 중 오류가 발생했습니다.');
    }
}

// 투표하기
async function vote(voteId, itemId) {
    try {
        const response = await fetch(`/api/votes/${voteId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ itemId })
        });

        if (response.ok) {
            getCurrentVote();
            getVoteHistory();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('투표 오류:', error);
        alert('투표 중 오류가 발생했습니다.');
    }
}

// 가게 목록 로드 (선생님용)
async function loadRestaurants() {
    try {
        const response = await fetch('/api/votes/restaurants');
        const restaurants = await response.json();
        
        const restaurantList = document.getElementById('restaurantList');
        restaurantList.innerHTML = '';

        restaurants.forEach(restaurant => {
            const restaurantCard = createRestaurantCard(restaurant);
            restaurantList.appendChild(restaurantCard);
        });
    } catch (error) {
        console.error('가게 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// 가게 카드 생성
function createRestaurantCard(restaurant) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.innerHTML = `
        <div class="card-body">
            <h5 class="card-title">${restaurant.name}</h5>
            <h6 class="card-subtitle mb-2 text-muted">메뉴 목록</h6>
            <ul class="list-group list-group-flush">
                ${restaurant.menus.map(menu => `
                    <li class="list-group-item">${menu}</li>
                `).join('')}
            </ul>
            <div class="mt-3">
                <button class="btn btn-primary btn-sm" onclick="showEditRestaurantModal('${restaurant.id}')">
                    수정
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteRestaurant('${restaurant.id}')">
                    삭제
                </button>
            </div>
        </div>
    `;
    return card;
}

// 가게 추가 모달 표시
function showAddRestaurantModal() {
    const modal = document.getElementById('restaurantModal');
    const form = document.getElementById('restaurantForm');
    const title = document.getElementById('restaurantModalTitle');
    
    // 폼 초기화
    form.reset();
    form.restaurantId.value = '';
    title.textContent = '가게 추가';
    
    // 모달 표시
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}

// 가게 수정 모달 표시
async function showEditRestaurantModal(restaurantId) {
    try {
        // 가게 정보 가져오기
        const response = await fetch(`/api/restaurants/${restaurantId}/menus`);
        if (!response.ok) {
            throw new Error('가게 정보를 가져오는데 실패했습니다.');
        }

        const menus = await response.json();
        const restaurant = menus[0]?.restaurant;

        if (!restaurant) {
            throw new Error('가게 정보를 찾을 수 없습니다.');
        }

        const modal = document.getElementById('restaurantModal');
        const form = document.getElementById('restaurantForm');
        const title = document.getElementById('restaurantModalTitle');
        
        // 폼 초기화
        form.reset();
        
        // 가게 정보 설정
        form.restaurantId.value = restaurant.id;
        form.name.value = restaurant.name;
        form.description.value = restaurant.description || '';
        
        // 메뉴 목록 설정
        const menuList = document.getElementById('menuList');
        menuList.innerHTML = menus.map(menu => `
            <div class="input-group mb-2">
                <input type="text" class="form-control" name="menuNames[]" value="${menu.name}" required>
                <input type="number" class="form-control" name="menuPrices[]" value="${menu.price}" required>
                <button type="button" class="btn btn-danger" onclick="removeMenu(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        title.textContent = '가게 수정';
        
        // 모달 표시
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    } catch (error) {
        console.error('가게 수정 모달 표시 오류:', error);
        alert(error.message);
    }
}

// 가게 삭제
async function deleteRestaurant(restaurantId) {
    if (!confirm('정말로 이 가게를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('가게가 삭제되었습니다.');
            loadRestaurants();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('가게 삭제 오류:', error);
        alert('가게 삭제 중 오류가 발생했습니다.');
    }
}

// 투표 생성 모달 표시
function showCreateVoteModal() {
    const modalElement = document.getElementById('createVoteModal');
    const modal = new bootstrap.Modal(modalElement);
    const form = document.getElementById('createVoteForm');
    const menuSelectionDiv = document.getElementById('menuSelection');

    // 폼 초기화
    form.reset();
    menuSelectionDiv.innerHTML = ''; // 메뉴 선택 영역 초기화

    // 마감 시간 설정 (현재 시간 + 3시간)
    const endTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
    
    // 로컬 시간대에 맞춰 datetime-local 형식으로 포맷
    const year = endTime.getFullYear();
    const month = ('0' + (endTime.getMonth() + 1)).slice(-2);
    const day = ('0' + endTime.getDate()).slice(-2);
    const hours = ('0' + endTime.getHours()).slice(-2);
    const minutes = ('0' + endTime.getMinutes()).slice(-2);
    
    const localDatetimeString = `${year}-${month}-${day}T${hours}:${minutes}`;

    form.endTime.value = localDatetimeString;

    modal.show();
}

// 메뉴 입력 필드 추가
function addMenuField() {
    const menuList = document.getElementById('menuList');
    const newField = document.createElement('div');
    newField.className = 'input-group mb-2';
    newField.innerHTML = `
        <input type="text" class="form-control" name="menuNames[]" placeholder="메뉴 이름" required>
        <input type="number" class="form-control" name="menuPrices[]" placeholder="가격">
        <button type="button" class="btn btn-danger" onclick="removeMenu(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    menuList.appendChild(newField);
}

// 메뉴 입력 필드 제거
function removeMenu(button) {
    const menuList = document.getElementById('menuList');
    if (menuList.children.length > 1) {
        button.closest('.input-group').remove();
    } else {
        alert('최소 1개 이상의 메뉴가 필요합니다.');
    }
}

// 가게 추가/수정
async function submitRestaurant() {
    const form = document.getElementById('restaurantForm');
    const formData = new FormData(form);
    
    // 필수 입력 확인
    const name = formData.get('name');
    const menuNames = formData.getAll('menuNames[]');
    const menuPrices = formData.getAll('menuPrices[]');
    const restaurantId = formData.get('restaurantId');

    if (!name || menuNames.length === 0) {
        alert('가게 이름과 최소 1개 이상의 메뉴를 입력해주세요.');
        return;
    }

    const restaurant = {
        name: name,
        description: formData.get('description'),
        menus: []
    };

    for (let i = 0; i < menuNames.length; i++) {
        if (!menuNames[i] || !menuPrices[i]) {
            alert('모든 메뉴의 이름과 가격을 입력해주세요.');
            return;
        }
        restaurant.menus.push({
            name: menuNames[i],
            price: parseInt(menuPrices[i])
        });
    }

    try {
        const url = restaurantId ? `/api/restaurants/${restaurantId}` : '/api/restaurants';
        const method = restaurantId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(restaurant)
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('restaurantModal')).hide();
            form.reset();
            loadRestaurants();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('가게 저장 오류:', error);
        alert('가게 저장 중 오류가 발생했습니다.');
    }
}

// 투표 생성
async function submitVote() {
    const form = document.getElementById('createVoteForm');
    const formData = new FormData(form);
    
    const title = formData.get('title');
    const restaurantId = formData.get('restaurantId');
    const menuIds = formData.getAll('menuIds[]');
    const endTime = formData.get('endTime');

    // 유효성 검사
    if (!title) {
        alert('투표 제목을 입력해주세요.');
        return;
    }
    if (!restaurantId) {
        alert('가게를 선택해주세요.');
        return;
    }
    if (menuIds.length === 0) {
        alert('투표할 메뉴를 하나 이상 선택해주세요.');
        return;
    }
    if (!endTime) {
        alert('투표 마감 시간을 설정해주세요.');
        return;
    }

    const vote = {
        title: title,
        restaurantId: restaurantId,
        menuIds: menuIds,
        endTime: endTime
    };

    try {
        const response = await fetch('/api/votes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(vote)
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('createVoteModal')).hide();
            form.reset();
            await loadCurrentVote();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('투표 생성 오류:', error);
        alert('투표 생성 중 오류가 발생했습니다.');
    }
}

// 투표하기
async function vote(voteId, menuId) {
    try {
        const response = await fetch(`/api/votes/${voteId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ menuId })
        });

        if (response.ok) {
            loadCurrentVote();
            loadVoteHistory();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('투표 오류:', error);
        alert('투표 중 오류가 발생했습니다.');
    }
}

// 투표 마감 함수
async function endVote(voteId) {
    if (!confirm('정말로 이 투표를 마감하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/votes/${voteId}/end`, {
            method: 'POST'
        });

        if (response.ok) {
            loadCurrentVote();
            loadVoteHistory();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('투표 마감 오류:', error);
        alert('투표 마감 중 오류가 발생했습니다.');
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
    // 사용자 타입 확인
    const userType = await checkUserType();
    
    // 현재 진행 중인 투표 로드
    loadCurrentVote();
    
    // 투표 기록 로드
    loadVoteHistory();
    
    // 선생님인 경우 가게 목록 로드
    if (userType === 'teacher') {
        loadRestaurants();
    }
});

// 사용자 타입 확인
async function checkUserType() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (data.user.userType === 'teacher') {
                document.body.classList.add('teacher');
            }
            return data.user.userType;
        }
    } catch (error) {
        console.error('사용자 정보 확인 오류:', error);
    }
    return null;
}

// 현재 진행 중인 투표 로드
async function loadCurrentVote() {
    try {
        const response = await fetch('/api/votes/current');
        if (response.ok) {
            const vote = await response.json();
            displayCurrentVote(vote);
        } else {
            document.getElementById('currentVote').innerHTML = '<p class="text-muted">현재 진행 중인 투표가 없습니다.</p>';
        }
    } catch (error) {
        console.error('투표 정보 로드 오류:', error);
    }
}

// 가게 목록 로드
async function loadRestaurants() {
    try {
        const response = await fetch('/api/restaurants');
        if (response.ok) {
            const restaurants = await response.json();
            const restaurantList = document.getElementById('restaurantList');
            
            if (restaurants.length === 0) {
                restaurantList.innerHTML = '<div class="col-12"><p class="text-muted">등록된 가게가 없습니다.</p></div>';
                return;
            }

            restaurantList.innerHTML = restaurants.map(restaurant => `
                <div class="col-md-4 mb-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title">${restaurant.name}</h5>
                            <p class="card-text small text-muted">${restaurant.description || '설명 없음'}</p>
                            <div class="d-flex justify-content-end gap-2">
                                <button class="btn btn-primary btn-sm" onclick="showEditRestaurantModal(${restaurant.id})">
                                    <i class="fas fa-edit me-1"></i>수정
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteRestaurant(${restaurant.id})">
                                    <i class="fas fa-trash me-1"></i>삭제
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            // 투표 생성 모달의 가게 선택 옵션도 업데이트
            const select = document.querySelector('select[name="restaurantId"]');
            select.innerHTML = '<option value="">가게를 선택하세요</option>' +
                restaurants.map(restaurant => 
                    `<option value="${restaurant.id}">${restaurant.name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('가게 목록 로드 오류:', error);
    }
}

// 가게 메뉴 로드
async function loadRestaurantMenus(restaurantId) {
    if (!restaurantId) return;
    
    try {
        const response = await fetch(`/api/restaurants/${restaurantId}/menus`);
        if (response.ok) {
            const menus = await response.json();
            const menuSelection = document.getElementById('menuSelection');
            menuSelection.innerHTML = menus.map(menu => `
                <div class="col-md-6 mb-2">
                    <div class="menu-card" onclick="toggleMenuSelection(this, ${menu.id})">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold">${menu.name}</div>
                                <div class="menu-price">${menu.price ? menu.price.toLocaleString() + '원' : '가격 미정'}</div>
                            </div>
                            <input type="checkbox" name="menuIds[]" value="${menu.id}" style="display: none;">
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('메뉴 목록 로드 오류:', error);
    }
}

// 메뉴 선택 토글
function toggleMenuSelection(card, menuId) {
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    card.classList.toggle('selected');
}

// Socket.IO 초기화
const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// 실시간 이벤트 리스너
socket.on('welcome', (data) => {
});

socket.on('voteCreated', (data) => {
    loadCurrentVote();
});

socket.on('voteUpdated', (data) => {
    loadCurrentVote();
    loadVoteHistory();
});

// 연결 상태 모니터링
socket.on('connect', () => {
});

socket.on('disconnect', () => {
});

socket.on('connect_error', (error) => {
});

socket.on('reconnect', (attemptNumber) => {
});

socket.on('reconnect_error', (error) => {
});

// Socket.IO 이벤트 리스너에 투표 마감 이벤트 추가
socket.on('voteEnded', (data) => {
    loadCurrentVote();
    loadVoteHistory();
});

// Service Worker 등록 및 푸시 구독 요청
async function registerPush() {
  console.log('Attempting to register service worker and subscribe to push.');

  // Service Worker 지원 확인
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers are not supported by this browser.');
    return;
  }

  // Push Manager 지원 확인
  if (!('PushManager' in window)) {
    console.log('Push notifications are not supported by this browser.');
    return;
  }

  try {
    // Service Worker 등록
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);

    // 현재 푸시 구독 상태 확인
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      console.log('Existing subscription found.');
      // 테스트를 위해 기존 구독이 있어도 서버에 다시 보냅니다.
      await sendSubscriptionToServer(existingSubscription); // <-- 이 부분을 무조건 실행하도록 합니다.
      console.log('Existing subscription resent to server.');
    } else {
      console.log('No existing subscription, requesting new one.');

      // 서버에서 VAPID 공개 키 가져오기
      const vapidPublicKeyResponse = await fetch('/api/votes/vapid-public-key');
      if (!vapidPublicKeyResponse.ok) {
          console.error('Failed to fetch VAPID public key.');
          return;
      }
      const { vapidPublicKey } = await vapidPublicKeyResponse.json();
      console.log('Fetched VAPID Public Key:', vapidPublicKey);

      // 푸시 구독 요청
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // 사용자가 볼 수 있는 알림만 구독
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey), // 가져온 VAPID 공개 키 사용
      });

      console.log('New push subscription:', subscription);

      // 서버에 구독 정보 전송
      await sendSubscriptionToServer(subscription);
    }

  } catch (error) {
    console.error('Service Worker registration or push subscription failed:', error);
  }
}

// base64 문자열을 Uint8Array로 변환하는 함수
// VAPID 공개 키를 구독 요청 시 사용하기 위해 필요
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 서버에 푸시 구독 정보 전송하는 함수 (구현 필요)
async function sendSubscriptionToServer(subscription) {
  try {
    const response = await fetch('/api/votes/subscribe', { // 구독 정보를 받을 서버 엔드포인트 경로 수정
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('Subscription sent to server successfully.');
    } else {
      console.error('Failed to send subscription to server.');
    }
  } catch (error) {
    console.error('Error sending subscription to server:', error);
  }
}

// 페이지 로드 시 Service Worker 등록 및 푸시 구독 요청 실행
// 필요한 경우 특정 사용자 액션 (버튼 클릭 등)에 따라 실행하도록 변경 가능
registerPush();

// 사용자에게 푸시 알림 상태를 표시하는 함수 (구현 필요)
function displayPushNotificationStatus(message) {
    console.log('Push Status:', message);
    // 실제 웹 페이지에 메시지를 표시하는 UI 로직을 여기에 추가하세요.
    // 예: 특정 HTML 요소에 메시지를 업데이트
    const statusElement = document.getElementById('pushStatusMessage'); // 예시 ID
    if (statusElement) {
        statusElement.textContent = message;
    }
} 