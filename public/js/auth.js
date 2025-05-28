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
        // 인증 상태 확인 오류:
    }
}

// 사용자 설정 불러오기 및 저장 기능
async function loadAndSaveUserSettings() {
    const voteHistoryCountInput = document.getElementById('voteHistoryCount');

    if (voteHistoryCountInput) {
        let lastValidVoteHistoryCount = parseInt(voteHistoryCountInput.value, 10) || 2; // 마지막으로 유효했던 값 저장 (초기값 설정)

        // 현재 사용자 설정 불러오기 (auth/me 엔드포인트를 활용)
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                if (data.user && data.user.voteHistoryCount !== undefined) {
                    const loadedValue = parseInt(data.user.voteHistoryCount, 10);
                     if (!isNaN(loadedValue) && loadedValue >= 0 && loadedValue <= 20) {
                        voteHistoryCountInput.value = loadedValue;
                        lastValidVoteHistoryCount = loadedValue; // 불러온 값이 유효하면 마지막 유효값 업데이트
                     } else {
                         // 불러온 값이 유효하지 않으면 기본값으로 표시하고 마지막 유효값 설정
                         voteHistoryCountInput.value = 2;
                         lastValidVoteHistoryCount = 2;
                     }
                } else {
                     // voteHistoryCount가 없으면 기본값으로 표시
                     voteHistoryCountInput.value = 2;
                     lastValidVoteHistoryCount = 2;
                }
            } else {
                // 사용자 설정 불러오기 실패:
                 // 불러오기 실패 시 기본값으로 표시
                 voteHistoryCountInput.value = 2;
                 lastValidVoteHistoryCount = 2;
            }
        } catch (error) {
            // 사용자 설정 불러오기 중 오류:
             // 오류 발생 시 기본값으로 표시
             voteHistoryCountInput.value = 2;
             lastValidVoteHistoryCount = 2;
        }

        // 입력 필드 값 변경 시 유효성 검사 및 값 되돌리기
        voteHistoryCountInput.addEventListener('input', (e) => {
            const currentValue = e.target.value;
            const numValue = parseInt(currentValue, 10);

            // 숫자가 아니거나 범위를 벗어나는 경우
            if (isNaN(numValue) || numValue < 0 || numValue > 20) {
                // 입력 필드 값을 마지막 유효한 값으로 되돌림
                e.target.value = lastValidVoteHistoryCount;
                // 선택 영역을 끝으로 이동 (사용자 경험 개선)
                e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
            } else {
                // 유효한 값이면 마지막 유효한 값 업데이트
                lastValidVoteHistoryCount = numValue;
            }
        });

        // 입력 필드 값 변경 완료 시 설정 저장 (change 이벤트 사용)
        voteHistoryCountInput.addEventListener('change', async (e) => {
            const newCount = parseInt(e.target.value, 10);
            // change 이벤트에서도 최종 유효성 검사 (input 이벤트로 대부분 걸러지지만)
            if (isNaN(newCount) || newCount < 0 || newCount > 20) {
                 // 이 경우는 input 이벤트에서 이미 처리되었거나 발생해서는 안 되지만, 방어 코드
                 return;
            }

            try {
                const response = await fetch('/api/auth/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ voteHistoryCount: newCount })
                });

                const data = await response.json();

                if (response.ok) {
                    // 투표 기록 표시 개수 설정 저장 완료:
                    if (typeof getVoteHistory === 'function') {
                        getVoteHistory();
                    } else {
                        // getVoteHistory 함수를 찾을 수 없습니다.
                    }
                    // 필요하다면 저장 성공 메시지를 사용자에게 표시할 수 있습니다.
                } else {
                    // 투표 기록 표시 개수 설정 저장 실패:
                    alert('설정 저장 중 오류가 발생했습니다: ' + data.error);
                    // 저장 실패 시에도 UI 값은 마지막 유효값 유지
                    e.target.value = lastValidVoteHistoryCount;
                }
            } catch (error) {
                // 투표 기록 표시 개수 설정 저장 중 오류:
                alert('설정 저장 중 오류가 발생했습니다.');
                 // 오류 발생 시에도 UI 값은 마지막 유효값 유지
                 e.target.value = lastValidVoteHistoryCount;
            }
        });
    }
}

// 설정 모달이 열릴 때 설정 값을 불러오도록 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('show.bs.modal', function () {
            loadAndSaveUserSettings();
        });
    }
});

// 페이지 로드 시 인증 상태 확인
// 로그인 페이지가 아닐 때만 인증 상태 확인 함수 호출
if (!isAuthPage) {
    checkAuthState();
    // 페이지 로드 시 설정 값도 함께 불러오려면 여기서 loadAndSaveUserSettings() 호출
    // 현재는 모달 열릴 때만 불러오도록 되어 있습니다.
}

// 로그인 폼 제출
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAllMessages();
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
                showAuthError(data.error);
            }
        } catch (error) {
            // 로그인 중 오류:
            showAuthError('로그인 중 오류가 발생했습니다.');
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

        // 이메일 도메인 검증
        if (!email.endsWith('@sonline20.sen.go.kr')) {
            showAuthError('(@sonline20.sen.go.kr)만 사용 가능합니다');
            return;
        }

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
                
                showAuthSuccess('회원가입이 완료되었습니다. 이메일로 발송된 인증 링크를 확인해주세요.'); // alert 대신 성공 메시지 표시
            } else {
                showAuthError(data.error); // alert 대신 에러 메시지 표시
            }
        } catch (error) {
            // 회원가입 중 오류:
            showAuthError('회원가입 중 오류가 발생했습니다.'); // alert 대신 에러 메시지 표시
        }
    });
}

// 로그아웃
window.logout = async function() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert('로그아웃 중 오류가 발생했습니다.');
        }
    } catch (error) {
        // 로그아웃 오류:
        alert('로그아웃 중 오류가 발생했습니다.');
    }
}

// URL 쿼리 파라미터 확인 및 메시지 표시
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');

    if (error === 'invalid_token') {
        showAuthError('유효하지 않거나 만료된 인증 링크입니다.');
    } else if (error === 'verification_failed') {
        showAuthError('이메일 인증 중 오류가 발생했습니다.');
    } else if (success === 'verified') {
        showAuthSuccess('이메일 인증이 완료되었습니다. 로그인해주세요.');
    }
});

// 비밀번호 변경 폼 토글 기능
document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('togglePasswordChangeForm');
    const formContainer = document.getElementById('passwordChangeFormContainer');
    
    if (toggleButton && formContainer) {
        toggleButton.addEventListener('click', function() {
            formContainer.classList.toggle('d-none');
            // 폼이 나타날 때 현재 비밀번호 필드에 포커스
            if (!formContainer.classList.contains('d-none')) {
                document.getElementById('currentPassword').focus();
            }
        });
    }
});

// 비밀번호 변경 폼 제출
if (document.getElementById('changePasswordForm')) {
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('passwordChangeError');
        const successElement = document.getElementById('passwordChangeSuccess');

        // 에러 메시지 초기화
        errorElement.classList.add('d-none');
        errorElement.textContent = '';
        successElement.classList.add('d-none');
        successElement.textContent = '';

        // 새 비밀번호 확인
        if (newPassword !== confirmPassword) {
            errorElement.textContent = '새 비밀번호가 일치하지 않습니다.';
            errorElement.classList.remove('d-none');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();
            
            if (response.ok) {
                successElement.textContent = data.message;
                successElement.classList.remove('d-none');
                // 폼 초기화
                e.target.reset();
            } else {
                // HTTP 상태 코드가 400이면 유효성 검사 오류이므로 콘솔에 로깅하지 않음
                if (response.status !== 400) {
                    // 비밀번호 변경 중 오류:
                }
                errorElement.textContent = data.error || '비밀번호 변경 중 오류가 발생했습니다.';
                errorElement.classList.remove('d-none');
            }
        } catch (error) {
            // 네트워크 오류 등 예상치 못한 오류
            // 비밀번호 변경 중 네트워크 오류:
            errorElement.textContent = '비밀번호 변경 중 네트워크 오류가 발생했습니다.';
            errorElement.classList.remove('d-none');
        }
    });
} 