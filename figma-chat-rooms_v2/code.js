// Figma 플러그인 메인 코드
let isUIVisible = false;

// 채팅 배지 관리
const CHAT_BADGE_PREFIX = "figma-chat-badge-";
const chatBadges = new Map(); // componentId -> badgeNode

// 채팅 배지 생성 함수
async function createChatBadge(component, messageCount = 0) {
  try {
    console.log("🏷️ 배지 생성 시작:", {
      componentName: component.name,
      componentId: component.id,
      messageCount: messageCount,
      componentType: component.type,
      hasParent: !!component.parent,
    });

    // 이미 배지가 있는지 확인
    const existingBadgeId = component.getPluginData("chatBadgeId");
    if (existingBadgeId) {
      const existingBadge = await figma.getNodeByIdAsync(existingBadgeId);
      if (existingBadge) {
        console.log("🔄 기존 배지 업데이트:", existingBadgeId);
        await updateChatBadge(existingBadge, messageCount);
        return existingBadge;
      }
    }

    // 새로운 배지 생성
    const badge = figma.createEllipse();
    badge.name = `${CHAT_BADGE_PREFIX}${component.name}`;

    // 배지 스타일링
    const badgeSize = messageCount > 0 ? 16 : 12;
    badge.resize(badgeSize, badgeSize);

    // 색상 설정 (메시지가 있으면 활성 색상, 없으면 비활성 색상)
    if (messageCount > 0) {
      badge.fills = [{ type: "SOLID", color: { r: 0.29, g: 0.56, b: 0.89 } }]; // 파란색
    } else {
      badge.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }]; // 회색
    }

    // 배지를 컴포넌트 근처에 배치
    const componentBounds = component.absoluteBoundingBox;
    console.log("📐 컴포넌트 경계:", componentBounds);

    if (componentBounds) {
      badge.x = componentBounds.x + componentBounds.width - badgeSize / 2;
      badge.y = componentBounds.y - badgeSize / 2;
      console.log("📍 배지 위치 설정:", { x: badge.x, y: badge.y });
    } else {
      // 경계 정보가 없는 경우 컴포넌트 위치 사용
      badge.x = component.x + 20;
      badge.y = component.y - 10;
      console.log("📍 배지 위치 설정 (기본):", { x: badge.x, y: badge.y });
    }

    // 텍스트 추가 (메시지 개수) - 간단한 방식
    if (messageCount > 0) {
      badge.name = `💬 ${component.name} (${messageCount}개)`;
    } else {
      badge.name = `💬 ${component.name} (빈 채팅방)`;
    }

    // 플러그인 데이터 저장
    component.setPluginData("chatBadgeId", badge.id);
    component.setPluginData("chatMessageCount", String(messageCount));
    badge.setPluginData("isChatBadge", "true");
    badge.setPluginData("componentId", component.id);

    // 배지를 컴포넌트와 같은 부모에 추가
    component.parent.appendChild(badge);

    // 배지의 위치를 컴포넌트에 상대적으로 설정
    // 배지가 컴포넌트를 따라 이동하도록 컴포넌트 내부에 배치
    try {
      // 컴포넌트가 프레임이거나 그룹인 경우, 배지를 내부에 추가
      if (
        component.type === "FRAME" ||
        component.type === "GROUP" ||
        component.type === "COMPONENT"
      ) {
        // 배지를 컴포넌트 내부로 이동
        component.appendChild(badge);

        // 컴포넌트 내부에서의 상대적 위치 설정 (우상단)
        badge.x = component.width - badgeSize / 2;
        badge.y = -badgeSize / 2;

        console.log("📍 배지를 컴포넌트 내부로 이동:", {
          x: badge.x,
          y: badge.y,
          componentWidth: component.width,
          componentHeight: component.height,
        });
      }
    } catch (error) {
      console.log("⚠️ 컴포넌트 내부 배치 실패, 외부 배치 유지:", error);
    }

    console.log("✅ 채팅 배지 생성 완료:", {
      componentName: component.name,
      badgeId: badge.id,
      messageCount: messageCount,
      position: { x: badge.x, y: badge.y },
      parent: badge.parent.name,
      isInsideComponent: badge.parent.id === component.id,
    });

    return badge;
  } catch (error) {
    console.error("❌ 채팅 배지 생성 오류:", error);
    return null;
  }
}

// 채팅 배지 업데이트 함수
async function updateChatBadge(badge, messageCount) {
  try {
    if (!badge) return;

    // 배지 크기 및 색상 업데이트
    const badgeSize = messageCount > 0 ? 16 : 12;

    if (badge.type === "GROUP") {
      // 그룹인 경우 (텍스트 포함)
      const circle = badge.children.find((child) => child.type === "ELLIPSE");
      const text = badge.children.find((child) => child.type === "TEXT");

      if (circle) {
        circle.resize(badgeSize, badgeSize);
        if (messageCount > 0) {
          circle.fills = [
            { type: "SOLID", color: { r: 0.29, g: 0.56, b: 0.89 } },
          ];
        } else {
          circle.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
        }
      }

      if (text) {
        text.characters = messageCount > 99 ? "99+" : String(messageCount);
      }

      // 배지 이름에서 컴포넌트 이름 추출 (안전한 방식)
      const badgeParts = badge.name.split("💬 ");
      const componentNamePart =
        badgeParts.length > 1 ? badgeParts[1] : "Component";
      const componentName = componentNamePart.split(" (")[0] || "Component";
      badge.name = `💬 ${componentName} (${messageCount}개)`;
    } else {
      // 단순 원형인 경우
      badge.resize(badgeSize, badgeSize);
      if (messageCount > 0) {
        badge.fills = [{ type: "SOLID", color: { r: 0.29, g: 0.56, b: 0.89 } }];
      } else {
        badge.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
      }
    }

    console.log("✅ 채팅 배지 업데이트:", {
      badgeId: badge.id,
      messageCount: messageCount,
      badgeType: badge.type,
    });
  } catch (error) {
    console.error("❌ 채팅 배지 업데이트 오류:", error);
  }
}

// 모든 채팅 배지 제거 함수
function removeAllChatBadges() {
  try {
    function findAndRemoveBadges(node) {
      // 채팅 배지 그룹인지 확인
      if (node.name && node.name.includes("(with chat badge)")) {
        // 그룹 내의 컴포넌트를 찾아서 그룹 밖으로 이동
        const componentInGroup = node.children.find(
          (child) =>
            child.type === "COMPONENT" ||
            child.type === "COMPONENT_SET" ||
            child.type === "FRAME"
        );
        if (componentInGroup) {
          // 컴포넌트를 그룹 밖으로 이동
          const originalParent = node.parent;
          originalParent.appendChild(componentInGroup);

          // 컴포넌트의 위치를 그룹의 위치로 조정
          componentInGroup.x = node.x;
          componentInGroup.y = node.y;

          // 플러그인 데이터 정리
          componentInGroup.setPluginData("chatBadgeId", "");
          componentInGroup.setPluginData("chatGroupId", "");
          componentInGroup.setPluginData("chatMessageCount", "");
        }

        // 그룹 제거
        node.remove();
        return;
      }

      // 개별 배지 제거 (그룹이 아닌 경우)
      if (node.getPluginData && node.getPluginData("isChatBadge") === "true") {
        node.remove();
        return;
      }

      if (node.name && node.name.startsWith(CHAT_BADGE_PREFIX)) {
        node.remove();
        return;
      }

      if ("children" in node) {
        // 역순으로 순회하여 제거 중 인덱스 문제 방지
        for (let i = node.children.length - 1; i >= 0; i--) {
          findAndRemoveBadges(node.children[i]);
        }
      }
    }

    findAndRemoveBadges(figma.currentPage);
    chatBadges.clear();

    console.log("✅ 모든 채팅 배지 제거 완료");
  } catch (error) {
    console.error("❌ 채팅 배지 제거 오류:", error);
  }
}

// 채팅 배지 상태 업데이트 함수
async function updateChatBadgesForComponents(componentMessageCounts) {
  console.log("🔄 채팅 배지 업데이트 시작:", componentMessageCounts);

  try {
    const availableComponents = getAvailableComponents();
    console.log(
      "📋 사용 가능한 컴포넌트:",
      availableComponents.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }))
    );

    for (const component of availableComponents) {
      if (component.id === "general") {
        console.log("⏭️ 전체 프로젝트 건너뛰기");
        continue; // 전체 프로젝트는 제외
      }

      const componentNode = await figma.getNodeByIdAsync(component.id);
      if (!componentNode) {
        console.log("❌ 컴포넌트 노드를 찾을 수 없음:", component.id);
        continue;
      }

      console.log("🔍 컴포넌트 처리 중:", {
        name: component.name,
        id: component.id,
        nodeFound: !!componentNode,
      });

      const messageCount = componentMessageCounts[component.id] || 0;

      // 기존 배지 확인
      const existingBadgeId = componentNode.getPluginData("chatBadgeId");
      let badge = null;

      if (existingBadgeId) {
        badge = await figma.getNodeByIdAsync(existingBadgeId);
        console.log("🔍 기존 배지 확인:", {
          badgeId: existingBadgeId,
          found: !!badge,
        });
      }

      if (badge) {
        // 기존 배지 업데이트
        console.log("🔄 기존 배지 업데이트 중:", component.name);
        await updateChatBadge(badge, messageCount);
      } else {
        // 새 배지 생성
        console.log("🆕 새 배지 생성 중:", component.name);
        await createChatBadge(componentNode, messageCount);
      }
    }

    console.log("✅ 채팅 배지 업데이트 완료");
  } catch (error) {
    console.error("❌ 채팅 배지 업데이트 오류:", error);
  }
}

// 플러그인 UI 표시/숨김 토글 함수
function toggleUI() {
  if (isUIVisible) {
    // UI가 열려있다면 닫기
    figma.closePlugin();
  } else {
    // UI가 닫혀있다면 열기
    figma.showUI(__html__, {
      width: 400,
      height: 650,
      title: "컴포넌트별 채팅방",
    });
    isUIVisible = true;

    // 초기 데이터 전송
    sendInitialData();
  }
}

// 명령어 처리
if (figma.command === "open-chat") {
  console.log("🎹 단축키 명령어 실행: open-chat");
  toggleUI();
} else {
  // 기본 실행 (메뉴에서 선택했을 때)
  figma.showUI(__html__, {
    width: 400,
    height: 650,
    title: "컴포넌트별 채팅방",
  });
  isUIVisible = true;
}

// 고유한 방 ID 생성 함수
function generateRoomId(componentId = null, componentName = null) {
  // 방법 1: figma.fileKey 사용 (가능한 경우)
  let baseId = "";
  if (figma.fileKey && figma.fileKey !== "") {
    baseId = figma.fileKey;
  } else {
    // 방법 2: 파일명 + 노드 ID 조합 (대안)
    const fileName = figma.root.name || "untitled";
    const rootId = figma.root.id;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    baseId = `${cleanFileName}_${rootId}`;
  }

  // 컴포넌트별 채팅방을 위한 추가 ID
  if (componentId) {
    return `${baseId}_component_${componentId}`;
  }

  return `${baseId}_general`;
}

// 현재 선택된 노드 정보 가져오기
function getSelectedComponentInfo() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return {
      id: "general",
      name: "전체 프로젝트",
      type: "general",
    };
  }

  const selectedNode = selection[0];

  // 컴포넌트나 인스턴스인지 확인
  if (
    selectedNode.type === "COMPONENT" ||
    selectedNode.type === "COMPONENT_SET"
  ) {
    return {
      id: selectedNode.id,
      name: selectedNode.name,
      type: "component",
    };
  } else if (selectedNode.type === "INSTANCE") {
    return {
      id: selectedNode.mainComponent
        ? selectedNode.mainComponent.id
        : selectedNode.id,
      name: selectedNode.mainComponent
        ? selectedNode.mainComponent.name
        : selectedNode.name,
      type: "instance",
    };
  } else {
    // 일반 레이어의 경우 가장 가까운 컴포넌트 찾기
    let parent = selectedNode.parent;
    while (
      parent &&
      parent.type !== "COMPONENT" &&
      parent.type !== "COMPONENT_SET"
    ) {
      parent = parent.parent;
    }

    if (
      parent &&
      (parent.type === "COMPONENT" || parent.type === "COMPONENT_SET")
    ) {
      return {
        id: parent.id,
        name: `${parent.name} > ${selectedNode.name}`,
        type: "nested",
      };
    }

    return {
      id: selectedNode.id,
      name: selectedNode.name,
      type: "layer",
    };
  }
}

// 사용 가능한 컴포넌트 목록 가져오기
function getAvailableComponents() {
  const components = [];

  // 전체 프로젝트 채팅방 추가
  components.push({
    id: "general",
    name: "전체 프로젝트",
    type: "general",
  });

  // 현재 페이지의 모든 컴포넌트 및 프레임 찾기
  function findComponents(node) {
    // 컴포넌트 추가
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      components.push({
        id: node.id,
        name: node.name,
        type: "component",
      });
    }
    // 프레임도 추가 (컴포넌트가 없는 경우를 위해)
    else if (node.type === "FRAME" && node.parent.type === "PAGE") {
      components.push({
        id: node.id,
        name: node.name,
        type: "frame",
      });
    }

    if ("children" in node) {
      node.children.forEach(findComponents);
    }
  }

  findComponents(figma.currentPage);

  console.log("📋 발견된 요소들:", components);
  return components;
}

// 초기 데이터 전송
function sendInitialData() {
  const selectedComponent = getSelectedComponentInfo();
  const availableComponents = getAvailableComponents();
  const roomId = generateRoomId(
    selectedComponent.id === "general" ? null : selectedComponent.id,
    selectedComponent.name
  );

  console.log("🔍 Figma 파일 정보:", {
    fileName: figma.root.name,
    figmaFileKey: figma.fileKey,
    rootId: figma.root.id,
    selectedComponent,
    generatedRoomId: roomId,
    availableComponents,
  });

  figma.ui.postMessage({
    type: "init",
    data: {
      fileName: figma.root.name,
      fileId: roomId,
      figmaFileKey: figma.fileKey,
      rootId: figma.root.id,
      user: figma.currentUser,
      selectedComponent,
      availableComponents,
    },
  });
}

// 선택 변경 감지
figma.on("selectionchange", () => {
  const selectedComponent = getSelectedComponentInfo();
  const roomId = generateRoomId(
    selectedComponent.id === "general" ? null : selectedComponent.id,
    selectedComponent.name
  );

  console.log("🎯 선택 변경 감지:", {
    selection: figma.currentPage.selection.map((node) => ({
      name: node.name,
      type: node.type,
      id: node.id,
    })),
    selectedComponent,
    roomId,
  });

  figma.ui.postMessage({
    type: "selection-changed",
    data: {
      selectedComponent,
      roomId,
    },
  });
});

// 플러그인이 시작될 때 초기 데이터 전송
sendInitialData();

// 즉시 배지 생성 테스트 (디버깅용)
console.log("🚀 플러그인 시작 - 즉시 배지 생성 테스트");
const testComponents = getAvailableComponents();
console.log("📋 테스트용 컴포넌트 목록:", testComponents);

// 첫 번째 실제 컴포넌트에 테스트 배지 생성
const realComponents = testComponents.filter((c) => c.id !== "general");
if (realComponents.length > 0) {
  const firstComponent = realComponents[0];
  figma.getNodeByIdAsync(firstComponent.id).then(async (componentNode) => {
    if (componentNode) {
      console.log("🧪 테스트 배지 생성:", firstComponent.name);
      await createChatBadge(componentNode, 0);
    }
  });
}

// UI로부터 메시지 수신
figma.ui.onmessage = (msg) => {
  switch (msg.type) {
    case "get-file-info":
      sendInitialData();
      break;

    case "switch-room":
      const componentId = msg.componentId;
      const componentName = msg.componentName;
      const roomId = generateRoomId(
        componentId === "general" ? null : componentId,
        componentName
      );

      figma.ui.postMessage({
        type: "room-switched",
        data: {
          roomId,
          componentId,
          componentName,
        },
      });
      break;

    case "update-chat-badges":
      // UI로부터 메시지 개수 정보를 받아서 배지 업데이트
      console.log("🏷️ 채팅 배지 업데이트 요청:", msg.data);
      if (msg.data && msg.data.componentMessageCounts) {
        updateChatBadgesForComponents(msg.data.componentMessageCounts).catch(
          (error) => {
            console.error("❌ 배지 업데이트 오류:", error);
          }
        );
      }
      break;

    case "remove-all-badges":
      // 모든 채팅 배지 제거
      removeAllChatBadges();
      break;

    case "close-plugin":
      // 플러그인 종료 시 배지 제거 (선택사항)
      // removeAllChatBadges(); // 필요시 주석 해제
      figma.closePlugin();
      break;
  }
};

// 플러그인 종료 시 정리
figma.on("close", () => {
  console.log("🔌 플러그인 종료");
  isUIVisible = false;
  // 필요한 정리 작업 수행
});

// 초기 배지 설정 (잠시 후 기본 배지 생성)
setTimeout(async () => {
  const availableComponents = getAvailableComponents();
  const initialCounts = {};

  availableComponents.forEach((component) => {
    if (component.id !== "general") {
      initialCounts[component.id] = 0; // 초기값은 0 (빈 배지)
    }
  });

  console.log("🏷️ 초기 배지 설정:", initialCounts);
  try {
    await updateChatBadgesForComponents(initialCounts);
  } catch (error) {
    console.error("❌ 초기 배지 설정 오류:", error);
  }
}, 1000);
