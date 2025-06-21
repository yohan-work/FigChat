// Figma 플러그인 메인 코드
figma.showUI(__html__, {
  width: 400,
  height: 650,
  title: "컴포넌트별 채팅방",
});

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

  // 현재 페이지의 모든 컴포넌트 찾기
  function findComponents(node) {
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      components.push({
        id: node.id,
        name: node.name,
        type: "component",
      });
    }

    if ("children" in node) {
      node.children.forEach(findComponents);
    }
  }

  findComponents(figma.currentPage);

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

    case "close-plugin":
      figma.closePlugin();
      break;
  }
};

// 플러그인 종료 시 정리
figma.on("close", () => {
  // 필요한 정리 작업 수행
});
