// 현재 페이지가 로그인 페이지인지 확인
const isAuthPage = window.location.pathname === '/login';

// 에러 메시지 표시 요소
const authError = document.getElementById('authError');
// 성공 메시지 표시 요소
const authSuccess = document.getElementById('authSuccess');

// 모든 메시지 숨김 함수
function hideAllMessages() {
    authError.classList.add('d-none');
    authError.textContent = '';
    authSuccess.classList.add('d-none');
    authSuccess.textContent = '';
}

// 에러 메시지 표시 함수
function showAuthError(message) {
    hideAllMessages(); // 다른 메시지 모두 숨김
    authError.textContent = message;
    authError.classList.remove('d-none');
}

// 성공 메시지 표시 함수
function showAuthSuccess(message) {
    hideAllMessages(); // 다른 메시지 모두 숨김
    authSuccess.textContent = message;
    authSuccess.classList.remove('d-none');
}

// 로그인 상태 확인
async function checkAuthState() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (isAuthPage) {
                window.location.href = '/';
            } else {
                document.getElementById('userName').textContent = data.user.name;
            }
        } else {
            if (!isAuthPage) {
                window.location.href = '/login';
            }
        }
    } catch (error) {
        console.error('인증 상태 확인 오류:', error);
    }
}

// 페이지 로드 시 인증 상태 확인
// 로그인 페이지가 아닐 때만 인증 상태 확인 함수 호출
if (!isAuthPage) {
    checkAuthState();
}

// 로그인 폼 제출
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAllMessages(); // 새로운 요청 전에 모든 메시지 숨김
        const email = e.target.email.value;
        const password = e.target.password.value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (response.ok) {
                window.location.href = '/';
            } else {
                showAuthError(data.error); // alert 대신 에러 메시지 표시
            }
        } catch (error) {
            console.error('로그인 중 오류:', error);
            showAuthError('로그인 중 오류가 발생했습니다.'); // alert 대신 에러 메시지 표시
        }
    });
}

// 회원가입 폼 제출
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAllMessages(); // 새로운 요청 전에 모든 메시지 숨김
        const email = e.target.email.value;
        const password = e.target.password.value;
        const name = e.target.name.value;
        const userType = e.target.userType.value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, name, userType })
            });

            const data = await response.json();
            if (response.ok) {
                // 회원가입 성공 후 로그인 탭으로 전환
                const loginTab = document.getElementById('login-tab');
                const loginTabInstance = new bootstrap.Tab(loginTab);
                loginTabInstance.show();
                
                // 폼 초기화
                e.target.reset();
                
                showAuthSuccess('회원가입이 완료되었습니다. 로그인해주세요.'); // alert 대신 성공 메시지 표시
            } else {
                showAuthError(data.error); // alert 대신 에러 메시지 표시
            }
        } catch (error) {
            console.error('회원가입 중 오류:', error);
            showAuthError('회원가입 중 오류가 발생했습니다.'); // alert 대신 에러 메시지 표시
        }
    });
}

// 로그아웃
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert('로그아웃 중 오류가 발생했습니다.');
        }
    } catch (error) {
        alert('로그아웃 중 오류가 발생했습니다.');
    }
} 