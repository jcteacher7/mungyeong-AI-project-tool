// 탐구 기능 배지 정의: 색상/아이콘/라벨을 한 곳에서 관리합니다.
// 저장된 프로젝트에는 라벨이 아니라 키(thinking, comm ...)만 들어 있으므로,
// 여기 라벨을 바꾸면 이미 입력된 프로젝트에도 새 이름으로 보입니다. 키는 바꾸지 마세요.
const BADGE_DEFS = {
  thinking: { icon: "fa-head-side-virus", label: "생각기능", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  comm: { icon: "fa-bullhorn", label: "소통기능", classes: "bg-red-100 text-red-800 border-red-200" },
  social: { icon: "fa-users", label: "협력기능", classes: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  self: { icon: "fa-list-check", label: "자기기능", classes: "bg-green-100 text-green-800 border-green-200" },
  research: { icon: "fa-magnifying-glass", label: "질문기능", classes: "bg-teal-100 text-teal-800 border-teal-200" },
};

// 예전 버전이 평가 계획 표에 기본으로 넣어 둔 "[ATL-AI·디지털]" 같은 태그 이름을
// 화면에 그릴 때 새 이름으로 바꿔 보여준다 (저장된 다른 내용은 건드리지 않음).
function renameLegacyTag(text) {
  return String(text || "").replace(/ATL/g, "탐구 기능");
}

// 차시별 지도 계획 표의 기본 행. 각 행이 단계(stage)/소제목(sub)을 직접 들고 있어서
// 행 단위로 자유롭게 추가/삭제할 수 있고, "탐구 단계" 텍스트도 행마다 수정할 수 있다.
// (원본은 같은 단계의 행을 셀 병합으로 묶었지만, 그러면 행을 추가/삭제할 때마다
// 병합 범위를 다시 계산해야 해서 훨씬 복잡해진다. 대신 화면에서는 같은 단계가
// 연속되면 구분선을 넣어 시각적으로 묶어 보여준다.)
function blankPlanRows() {
  const defs = [
    ["1. Tuning in", "(준비하기)", "1~2"],
    ["1. Tuning in", "(준비하기)", "3~4"],
    ["2. Investigate", "(조사하기)", "5~6"],
    ["2. Investigate", "(조사하기)", "7~8"],
    ["2. Investigate", "(조사하기)", "9~10"],
    ["3. Organize", "(조직하기)", "11~12"],
    ["3. Organize", "(조직하기)", "13~14"],
    ["4. Generalize", "(일반화하기)", "15"],
    ["4. Generalize", "(일반화하기)", "16"],
    ["5. Transfer", "(전이하기)", "17~18"],
    ["5. Transfer", "(전이하기)", "19"],
    ["6. Reflect", "(성찰하기)", "20"],
  ];
  return defs.map(([stage, sub, session]) => ({
    stage,
    sub,
    question: "",
    session,
    topic: "",
    details: "",
    atl: [],
    aiDigital: "",
    concepts: "",
    custom: {},
  }));
}

function blankPlanRow() {
  return { stage: "새 단계", sub: "", question: "", session: "", topic: "", details: "", atl: [], aiDigital: "", concepts: "", custom: {} };
}

// 새 프로젝트를 만들 때 채워지는 빈 템플릿입니다.
function defaultProjectData() {
  return {
    title: "제목 없는 프로젝트",
    eq: "본질적 질문을 입력하세요.",
    structure: {
      mainLens: "주 렌즈",
      subLens: "보조 렌즈",
      macroConcept: "매크로 개념을 입력하세요",
      finalGeneralization: "최종 일반화 문장을 입력하세요.",
      pillars: [
        { subGen: "하위 일반화 문장을 입력하세요.", concepts: ["개념"], facts: ["구체적 사실을 입력하세요."] },
      ],
      toolLayers: [
        { title: "1. 사실 탐구 단계", items: [{ subject: "과목", text: "도구 교과 투입 내용을 입력하세요." }] },
        { title: "2. 개념화 및 일반화 도출", items: [{ subject: "과목", text: "도구 교과 투입 내용을 입력하세요." }] },
        { title: "3. 최종 일반화 및 실천", items: [{ subject: "과목", text: "도구 교과 투입 내용을 입력하세요." }] },
      ],
    },
    grasps: {
      goal: "",
      role: "",
      audience: "",
      situation: "",
      product: ["산출물을 입력하세요."],
      standards: ["평가 기준을 입력하세요."],
    },
    plan: { rows: blankPlanRows(), customColumns: [] },
    eval: {
      rows: [
        { area: "[이해]", criterion: "", good: "", normal: "", needsWork: "" },
        { area: "[과정]", criterion: "", good: "", normal: "", needsWork: "" },
        { area: "[탐구 기능-AI·디지털]", criterion: "", good: "", normal: "", needsWork: "" },
      ],
    },
  };
}
