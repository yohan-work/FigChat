// Figma 플러그인 메인 코드
figma.showUI(__html__, { 
  width: 400, 
  height: 600,
  title: "프로젝트 채팅방"
});

// 고유한 방 ID 생성 함수
function generateRoomId() {
  // 방법 1: figma.fileKey 사용 (가능한 경우)
  if (figma.fileKey && figma.fileKey !== '') {
    return figma.fileKey;
  }
  
  // 방법 2: 파일명 + 노드 ID 조합 (대안)
  const fileName = figma.root.name || 'untitled';
  const rootId = figma.root.id;
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  
  return `${cleanFileName}_${rootId}`;
}

// 플러그인이 시작될 때 현재 파일 정보 전송
const roomId = generateRoomId();
console.log('🔍 Figma 파일 정보:', {
  fileName: figma.root.name,
  figmaFileKey: figma.fileKey,
  rootId: figma.root.id,
  generatedRoomId: roomId
});

figma.ui.postMessage({
  type: 'init',
  data: {
    fileName: figma.root.name,
    fileId: roomId,
    figmaFileKey: figma.fileKey, // 디버깅용
    rootId: figma.root.id, // 디버깅용
    user: figma.currentUser
  }
});

// UI로부터 메시지 수신
figma.ui.onmessage = (msg) => {
  switch (msg.type) {
    case 'get-file-info':
      const currentRoomId = generateRoomId();
      figma.ui.postMessage({
        type: 'file-info',
        data: {
          fileName: figma.root.name,
          fileId: currentRoomId,
          figmaFileKey: figma.fileKey, // 디버깅용
          rootId: figma.root.id, // 디버깅용
          user: figma.currentUser
        }
      });
      break;
    
    case 'close-plugin':
      figma.closePlugin();
      break;
  }
};

// 플러그인 종료 시 정리
figma.on('close', () => {
  // 필요한 정리 작업 수행
}); 