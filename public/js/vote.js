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

// 투표하기
async function vote(voteId, menuIndex) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        const response = await fetch(`/api/votes/${voteId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.uid,
                menuIndex: menuIndex
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert('투표가 완료되었습니다.');
            loadActiveVotes();
        } else {
            alert(data.error);
        }
    } catch (error) {
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

// 투표 기록 로드 (선생님용)
async function loadVoteHistory() {
    try {
        const response = await fetch('/api/votes/history');
        const votes = await response.json();
        
        const voteHistory = document.getElementById('voteHistory');
        voteHistory.innerHTML = '';

        votes.forEach(vote => {
            const voteCard = createVoteHistoryCard(vote);
            voteHistory.appendChild(voteCard);
        });
    } catch (error) {
        console.error('투표 기록을 불러오는 중 오류가 발생했습니다.');
    }
}

// 투표 기록 카드 생성
function createVoteHistoryCard(vote) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.innerHTML = `
        <div class="card-body">
            <h5 class="card-title">${vote.restaurantName}</h5>
            <p class="card-text">
                생성 시간: ${new Date(vote.createdAt).toLocaleString()}<br>
                종료 시간: ${new Date(vote.endTime).toLocaleString()}<br>
                상태: ${vote.status === 'active' ? '진행중' : '종료됨'}
            </p>
            <div class="list-group">
                ${vote.menus.map((menu, index) => {
                    const voteCount = Object.values(vote.votes).filter(v => v === index).length;
                    return `
                        <div class="list-group-item">
                            ${menu} - ${voteCount}표
                        </div>
                    `;
                }).join('')}
            </div>
            ${vote.status === 'active' ? `
                <button class="btn btn-danger btn-sm mt-3" onclick="endVote('${vote.id}')">
                    투표 종료
                </button>
            ` : ''}
        </div>
    `;
    return card;
}

// 투표 종료
async function endVote(voteId) {
    if (!confirm('정말로 이 투표를 종료하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/votes/${voteId}/end`, {
            method: 'POST'
        });

        if (response.ok) {
            alert('투표가 종료되었습니다.');
            loadVoteHistory();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        alert('투표 종료 중 오류가 발생했습니다.');
    }
} 