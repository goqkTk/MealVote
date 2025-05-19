// Firebase 초기화
const firebaseConfig = {
    apiKey: "AIzaSyCphjd0WbG3XThUidhGWsf8W_ppgvZ2SGI",
    authDomain: "mealvote-f5008.firebaseapp.com",
    projectId: "mealvote-f5008",
    storageBucket: "mealvote-f5008.firebasestorage.app",
    messagingSenderId: "688912681650",
    appId: "1:688912681650:web:a055faa663e06cfb0457ab"
};

firebase.initializeApp(firebaseConfig);

// 모달 인스턴스
let loginModal, registerModal;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', () => {
    loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    registerModal = new bootstrap.Modal(document.getElementById('registerModal'));

    // 로그인 폼 제출
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password')
                })
            });

            const data = await response.json();
            if (response.ok) {
                loginModal.hide();
                updateUI(data.user);
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('로그인 중 오류가 발생했습니다.');
        }
    });

    // 회원가입 폼 제출
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    name: formData.get('name'),
                    userType: formData.get('userType')
                })
            });

            const data = await response.json();
            if (response.ok) {
                registerModal.hide();
                alert('회원가입이 완료되었습니다. 이메일 인증을 확인해주세요.');
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('회원가입 중 오류가 발생했습니다.');
        }
    });

    // 로그인 상태 확인
    checkAuthState();
});

// 로그인 모달 표시
function showLoginModal() {
    loginModal.show();
}

// 회원가입 모달 표시
function showRegisterModal() {
    registerModal.show();
}

// 로그아웃
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST'
        });
        updateUI(null);
    } catch (error) {
        alert('로그아웃 중 오류가 발생했습니다.');
    }
}

// UI 업데이트
function updateUI(user) {
    const beforeLogin = document.getElementById('beforeLogin');
    const afterLogin = document.getElementById('afterLogin');
    const userName = document.getElementById('userName');
    const studentView = document.getElementById('studentView');
    const teacherView = document.getElementById('teacherView');

    if (user) {
        beforeLogin.style.display = 'none';
        afterLogin.style.display = 'block';
        userName.textContent = user.name;

        if (user.userType === 'student') {
            studentView.style.display = 'block';
            teacherView.style.display = 'none';
            loadActiveVotes();
        } else {
            studentView.style.display = 'none';
            teacherView.style.display = 'block';
            loadRestaurants();
            loadVoteHistory();
        }
    } else {
        beforeLogin.style.display = 'block';
        afterLogin.style.display = 'none';
        studentView.style.display = 'none';
        teacherView.style.display = 'none';
    }
}

// 인증 상태 확인
function checkAuthState() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const response = await fetch(`/api/auth/user/${user.uid}`);
                const data = await response.json();
                if (response.ok) {
                    updateUI(data.user);
                }
            } catch (error) {
                console.error('사용자 정보를 가져오는 중 오류가 발생했습니다.');
            }
        } else {
            updateUI(null);
        }
    });
} 