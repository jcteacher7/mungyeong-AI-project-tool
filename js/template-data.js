// ATL 배지 정의: 색상/아이콘/라벨을 한 곳에서 관리합니다.
const BADGE_DEFS = {
  thinking: { icon: "fa-head-side-virus", label: "Thinking (사고)", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  comm: { icon: "fa-bullhorn", label: "Communication (의사소통)", classes: "bg-red-100 text-red-800 border-red-200" },
  social: { icon: "fa-users", label: "Social (사회적)", classes: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  self: { icon: "fa-list-check", label: "Self-Mgt (자기관리)", classes: "bg-green-100 text-green-800 border-green-200" },
  research: { icon: "fa-magnifying-glass", label: "Research (조사)", classes: "bg-teal-100 text-teal-800 border-teal-200" },
};

// 개념기반 탐구 7단계와, 각 단계에 속한 행(rowspan) 개수.
// 총 행 개수는 12개로 고정되어 있습니다 (원본 예시안과 동일한 구조).
const PLAN_STAGE_GROUPS = [
  { stage: "1. Engage", sub: "(관계 맺기)", rows: 1 },
  { stage: "2. Focus", sub: "(집중하기)", rows: 1 },
  { stage: "3. Investigate", sub: "(조사하기)", rows: 3 },
  { stage: "4. Organize", sub: "(조직하기)", rows: 2 },
  { stage: "5. Generalize", sub: "(일반화하기)", rows: 2 },
  { stage: "6. Transfer", sub: "(전이하기)", rows: 2 },
  { stage: "7. Reflect", sub: "(성찰하기)", rows: 1 },
];

function blankPlanRows() {
  const sessions = ["1~2", "3~4", "5~6", "7~8", "9~10", "11~12", "13~14", "15", "16", "17~18", "19", "20"];
  return sessions.map((s) => ({ session: s, topic: "", details: "", atl: [], aiDigital: "", concepts: "" }));
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
    plan: { rows: blankPlanRows() },
    eval: {
      rows: [
        { area: "지식·이해", good: "", normal: "", needsWork: "" },
        { area: "과정·기능", good: "", normal: "", needsWork: "" },
        { area: "AI·디지털 활용", good: "", normal: "", needsWork: "" },
      ],
    },
  };
}
