// ATL 배지 정의: 색상/아이콘/라벨을 한 곳에서 관리합니다.
const BADGE_DEFS = {
  thinking: { icon: "fa-head-side-virus", label: "Thinking (사고)", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  comm: { icon: "fa-bullhorn", label: "Communication (의사소통)", classes: "bg-red-100 text-red-800 border-red-200" },
  social: { icon: "fa-users", label: "Social (사회적)", classes: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  self: { icon: "fa-list-check", label: "Self-Mgt (자기관리)", classes: "bg-green-100 text-green-800 border-green-200" },
  research: { icon: "fa-magnifying-glass", label: "Research (조사)", classes: "bg-teal-100 text-teal-800 border-teal-200" },
};

// 차시별 지도 계획 표의 기본 행. 각 행이 단계(stage)/소제목(sub)을 직접 들고 있어서
// 행 단위로 자유롭게 추가/삭제할 수 있고, "탐구 단계" 텍스트도 행마다 수정할 수 있다.
// (원본은 같은 단계의 행을 셀 병합으로 묶었지만, 그러면 행을 추가/삭제할 때마다
// 병합 범위를 다시 계산해야 해서 훨씬 복잡해진다. 대신 화면에서는 같은 단계가
// 연속되면 구분선을 넣어 시각적으로 묶어 보여준다.)
function blankPlanRows() {
  const defs = [
    ["1. Engage", "(관계 맺기)", "1~2"],
    ["2. Focus", "(집중하기)", "3~4"],
    ["3. Investigate", "(조사하기)", "5~6"],
    ["3. Investigate", "(조사하기)", "7~8"],
    ["3. Investigate", "(조사하기)", "9~10"],
    ["4. Organize", "(조직하기)", "11~12"],
    ["4. Organize", "(조직하기)", "13~14"],
    ["5. Generalize", "(일반화하기)", "15"],
    ["5. Generalize", "(일반화하기)", "16"],
    ["6. Transfer", "(전이하기)", "17~18"],
    ["6. Transfer", "(전이하기)", "19"],
    ["7. Reflect", "(성찰하기)", "20"],
  ];
  return defs.map(([stage, sub, session]) => ({
    stage,
    sub,
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
  return { stage: "새 단계", sub: "", session: "", topic: "", details: "", atl: [], aiDigital: "", concepts: "", custom: {} };
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
        { area: "지식·이해", good: "", normal: "", needsWork: "" },
        { area: "과정·기능", good: "", normal: "", needsWork: "" },
        { area: "AI·디지털 활용", good: "", normal: "", needsWork: "" },
      ],
    },
  };
}
