self.addEventListener('push', function(event) {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/images/smcicon.png', // 사용자가 제공한 경로로 수정
  });
});

// 서비스 워커 활성화 시 기존 캐시 삭제 등의 작업이 필요할 수 있습니다.
// 현재는 푸시 알림 수신 로직만 포함합니다.
self.addEventListener('activate', function(event) {
  console.log('Service Worker activated.');
});

self.addEventListener('install', function(event) {
  console.log('Service Worker installed.');
}); 