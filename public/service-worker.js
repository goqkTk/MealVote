self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : '새 알림이 도착했습니다.',
    icon: '/images/smcicon.png', // 알림에 표시될 아이콘 경로 (적절히 수정)
    badge: '/images/smcicon.png', // 모바일 등에서 사용될 뱃지 아이콘 경로 (적절히 수정)
    vibrate: [200, 100, 200],
    data: { url: 'http://localhost:3000/' } // 알림 클릭 시 열릴 URL 등 데이터
  };

  event.waitUntil(
    self.registration.showNotification('MealVote 알림', options)
  );
});

// 알림 클릭 시 동작 정의 (선택 사항)
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();

  // 알림에 데이터가 있다면 해당 URL로 이동
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// 서비스 워커 활성화 시 캐시 정리 등 작업 수행 (선택 사항)
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activate');
  // event.waitUntil(clients.claim()); // 서비스 워커가 즉시 제어하도록 함
}); 