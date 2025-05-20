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

// 현재 진행 중인 투표 표시
function displayCurrentVote(vote) {
    const currentVoteDiv = document.getElementById('currentVote');
    if (!vote) {
        currentVoteDiv.innerHTML = '<p class="text-muted">현재 진행 중인 투표가 없습니다.</p>';
        return;
    }

    currentVoteDiv.innerHTML = `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">${escapeHTML(vote.title)}</h5>
                <p class="card-text">${escapeHTML(vote.description)}</p>
                <div class="list-group">
                    ${vote.items.map(item => `
                        <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                                onclick="vote('${vote.id}', '${item.id}')">
                            ${escapeHTML(item.name)}
                            <span class="badge bg-primary rounded-pill">${item.votes}표</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
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
                <h6 class="card-title">${escapeHTML(vote.title)}</h6>
                <p class="card-text small text-muted">
                    ${new Date(vote.createdAt).toLocaleDateString()}
                </p>
                <div class="list-group list-group-flush">
                    ${vote.items.map(item => `
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            ${escapeHTML(item.name)}
                            <span class="badge bg-primary rounded-pill">${item.votes}표</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
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
    // TODO: 가게 추가 모달 구현
}

// 가게 수정 모달 표시
function showEditRestaurantModal(restaurantId) {
    // TODO: 가게 수정 모달 구현
}

// 가게 삭제
async function deleteRestaurant(restaurantId) {
    if (!confirm('정말로 이 가게를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/votes/restaurants/${restaurantId}`, {
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
        alert('가게 삭제 중 오류가 발생했습니다.');
    }
}

// 투표 생성 모달 표시
function showCreateVoteModal() {
    // TODO: 투표 생성 모달 구현
}

// 페이지 로드 시 투표 정보 가져오기
document.addEventListener('DOMContentLoaded', () => {
    getCurrentVote();
    getVoteHistory();
}); 