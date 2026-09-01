// project.html 편집기의 렌더링 / 자동저장 로직.
// 원칙: 서버에 저장되는 값은 항상 텍스트(innerText)만 다룬다. innerHTML로 사용자가
// 입력한 내용을 다시 그리지 않는다 (다른 사람이 같은 링크로 들어왔을 때 저장된
// 내용이 그대로 실행 가능한 HTML/스크립트가 되는 것을 막기 위함 - XSS 방지).

let currentProjectId = null;
let saveTimer = null;
let isHydrating = false;

// ---------- 작은 DOM 헬퍼 ----------
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function labelEl(text) {
  const span = el("span", "text-xs font-bold tracking-widest text-slate-400 uppercase mb-2");
  span.textContent = text;
  return span;
}

function arrowEl() {
  const i = el("i", "fa-solid fa-arrow-up text-slate-300 text-lg my-2 arrow-up");
  return i;
}

// def.label / def.icon 은 BADGE_DEFS(우리 코드에 정의된 고정 상수)에서만 오므로
// innerHTML에 꽂아도 사용자 입력이 섞이지 않아 안전합니다.
function iconButton(icon, title, dark) {
  const btn = el("button", dark ? "text-slate-400 hover:text-white transition" : "text-eco-600 hover:text-eco-800 transition");
  btn.type = "button";
  btn.title = title;
  btn.innerHTML = `<i class="fa-solid ${icon} ${dark ? "" : "text-lg"}"></i>`;
  return btn;
}

function createRemoveBtn(onRemove, posClasses, big) {
  const btn = el(
    "button",
    `hidden ${big ? "group-hover:flex" : "group-hover/item:flex"} absolute ${posClasses} bg-red-500 text-white rounded-full w-4 h-4 items-center justify-center text-[10px] shadow z-10`
  );
  btn.type = "button";
  btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  btn.addEventListener("click", onRemove);
  return btn;
}

// ---------- 지식의 구조: 기둥 / 개념 / 사실 ----------
function createConceptChip(text) {
  const wrap = el("div", "relative group/item inline-block");
  const span = el("span", "bg-white border border-slate-300 text-eco-700 px-2 py-1 rounded shadow-sm inline-block");
  span.contentEditable = "true";
  span.textContent = text;
  wrap.appendChild(span);
  wrap.appendChild(createRemoveBtn(() => wrap.remove(), "-top-2 -right-2"));
  return wrap;
}

function createFactItem(text) {
  const li = el("li", "relative group/item");
  const span = el("span", "block pr-4");
  span.contentEditable = "true";
  span.textContent = text;
  li.appendChild(span);
  li.appendChild(createRemoveBtn(() => li.remove(), "right-0 top-0"));
  return li;
}

function createPillarEl(pillar) {
  const wrap = el("div", "flex flex-col items-center pillar-wrapper relative group bg-white rounded-xl");

  const delBtn = el("button", "hidden group-hover:flex absolute -top-3 -right-3 bg-red-500 text-white px-2 py-1 rounded shadow-md text-xs font-bold z-20 items-center gap-1 transition-all");
  delBtn.type = "button";
  delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> 기둥 삭제';
  delBtn.addEventListener("click", () => wrap.remove());
  wrap.appendChild(delBtn);

  wrap.appendChild(labelEl("Sub-Generalization"));

  const subGenBox = el("div", "bg-white border-2 border-slate-200 p-4 rounded-xl text-center shadow-sm w-full min-h-[120px] flex items-center justify-center mb-4 transition hover:border-eco-300");
  const subGenP = el("p", "font-medium text-slate-700 leading-snug pillar-subgen");
  subGenP.contentEditable = "true";
  subGenP.style.whiteSpace = "pre-wrap";
  subGenP.textContent = pillar.subGen || "";
  subGenBox.appendChild(subGenP);
  wrap.appendChild(subGenBox);
  wrap.appendChild(arrowEl());

  const cHeader = el("div", "w-full flex items-center justify-between mb-2");
  cHeader.appendChild(labelEl("Concepts"));
  const addConceptBtn = iconButton("fa-circle-plus", "개념 추가");
  cHeader.appendChild(addConceptBtn);
  wrap.appendChild(cHeader);

  const conceptContainer = el("div", "bg-slate-50 border border-slate-200 p-3 rounded-lg w-full text-center text-sm font-semibold mb-4 min-h-[80px] flex items-center justify-center flex-wrap gap-2 concept-container");
  (pillar.concepts && pillar.concepts.length ? pillar.concepts : [""]).forEach((c) => conceptContainer.appendChild(createConceptChip(c)));
  wrap.appendChild(conceptContainer);
  addConceptBtn.addEventListener("click", () => conceptContainer.appendChild(createConceptChip("새 개념")));
  wrap.appendChild(arrowEl());

  const fHeader = el("div", "w-full flex items-center justify-between mb-2");
  fHeader.appendChild(labelEl("Facts"));
  const addFactBtn = iconButton("fa-circle-plus", "사실 추가");
  fHeader.appendChild(addFactBtn);
  wrap.appendChild(fHeader);

  const factBox = el("div", "bg-white border border-dashed border-slate-300 p-4 rounded-lg w-full text-sm text-slate-600 min-h-[100px] fact-container");
  const ul = el("ul", "list-disc text-left pl-4 space-y-2");
  (pillar.facts && pillar.facts.length ? pillar.facts : [""]).forEach((f) => ul.appendChild(createFactItem(f)));
  factBox.appendChild(ul);
  wrap.appendChild(factBox);
  addFactBtn.addEventListener("click", () => ul.appendChild(createFactItem("새로운 탐구 사실 입력")));

  return wrap;
}

// ---------- 도구 교과 투입 레이어 ----------
function createToolItem(item) {
  const li = el("li", "relative group/item flex gap-2");
  const subj = el("span", "bg-slate-600 text-xs px-2 py-1 rounded h-fit shrink-0 tool-subject");
  subj.contentEditable = "true";
  subj.textContent = item.subject || "";
  const text = el("span", "flex-1 block pr-4 tool-text");
  text.contentEditable = "true";
  text.style.whiteSpace = "pre-wrap";
  text.textContent = item.text || "";
  li.appendChild(subj);
  li.appendChild(text);
  li.appendChild(createRemoveBtn(() => li.remove(), "right-0 top-1"));
  return li;
}

function createToolColumnEl(col) {
  const box = el("div", "bg-slate-700/50 p-5 rounded-xl border border-slate-600 tool-col");
  const header = el("div", "flex justify-between items-center mb-3");
  const h3 = el("h3", "font-semibold text-emerald-400 flex items-center gap-2");
  h3.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
  const titleSpan = el("span", "tool-col-title");
  titleSpan.contentEditable = "true";
  titleSpan.textContent = col.title || "";
  h3.appendChild(titleSpan);
  header.appendChild(h3);
  const addBtn = iconButton("fa-circle-plus", "항목 추가", true);
  header.appendChild(addBtn);
  box.appendChild(header);

  const ul = el("ul", "space-y-3 text-sm text-slate-200 tool-list");
  (col.items && col.items.length ? col.items : [{ subject: "", text: "" }]).forEach((it) => ul.appendChild(createToolItem(it)));
  box.appendChild(ul);
  addBtn.addEventListener("click", () => ul.appendChild(createToolItem({ subject: "과목", text: "새로운 도구 투입 내용" })));
  return box;
}

// ---------- GRASPS 리스트 (Product / Standards) ----------
function createGraspsItem(text) {
  const li = el("li", "relative group/item");
  const span = el("span", "block pr-4");
  span.contentEditable = "true";
  span.style.whiteSpace = "pre-wrap";
  span.textContent = text;
  li.appendChild(span);
  li.appendChild(createRemoveBtn(() => li.remove(), "right-0 top-1"));
  return li;
}

// ---------- 차시별 지도 계획 표 ----------
function editableTd(value, field, extraClass, noBorder) {
  const td = el("td", `px-3 py-3 ${noBorder ? "" : "border-r border-slate-200"} ${extraClass || ""}`.trim());
  td.contentEditable = "true";
  td.dataset.field = field;
  td.style.whiteSpace = "pre-wrap";
  td.textContent = value || "";
  return td;
}

function createAtlBadge(key) {
  const def = BADGE_DEFS[key];
  if (!def) return null;
  const div = el("div", `cursor-pointer inline-block px-2 py-1 ${def.classes} text-[11px] rounded font-semibold hover:opacity-70 transition`);
  div.title = "클릭하여 삭제";
  div.dataset.badge = key;
  div.innerHTML = `<i class="fa-solid ${def.icon}"></i> ${def.label}`;
  div.addEventListener("click", () => div.remove());
  return div;
}

function createAtlDropzoneTd(atlKeys) {
  const td = el("td", "atl-dropzone px-3 py-3 border-r border-slate-200 flex flex-wrap gap-1 content-start min-h-[80px]");
  td.addEventListener("dragover", (e) => e.preventDefault());
  td.addEventListener("dragenter", (e) => {
    e.preventDefault();
    td.classList.add("drag-over");
  });
  td.addEventListener("dragleave", () => td.classList.remove("drag-over"));
  td.addEventListener("drop", (e) => {
    e.preventDefault();
    td.classList.remove("drag-over");
    const key = e.dataTransfer.getData("text/plain");
    const badge = createAtlBadge(key);
    if (badge) td.appendChild(badge);
  });
  (atlKeys || []).forEach((k) => {
    const badge = createAtlBadge(k);
    if (badge) td.appendChild(badge);
  });
  return td;
}

function renderAtlPalette() {
  const container = document.getElementById("atl-palette");
  container.innerHTML = "";
  Object.keys(BADGE_DEFS).forEach((key) => {
    const def = BADGE_DEFS[key];
    const div = el("div", `cursor-move inline-block px-2 py-1 ${def.classes} text-[11px] rounded font-semibold shadow-sm transition hover:scale-105`);
    div.draggable = true;
    div.dataset.badge = key;
    div.innerHTML = `<i class="fa-solid ${def.icon}"></i> ${def.label}`;
    div.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", key));
    container.appendChild(div);
  });
}

// 탐구 단계 칸: 원본은 같은 단계의 행들을 rowspan으로 병합했지만, 그러면 행을
// 추가/삭제할 때마다 병합 범위를 다시 계산해야 해서 훨씬 복잡해진다. 대신 매 행마다
// 독립된(직접 수정 가능한) 칸으로 두고, 바로 위 행과 단계가 같으면 구분선을 생략해서
// 시각적으로만 묶어 보여준다.
function createStageCell(rowData) {
  const td = el("td", "px-3 py-3 font-semibold text-eco-700 bg-white border-r border-slate-200");
  const stageSpan = el("span", "block");
  stageSpan.contentEditable = "true";
  stageSpan.dataset.field = "stage";
  stageSpan.textContent = rowData.stage || "";
  const subSpan = el("span", "block text-xs font-normal text-slate-500");
  subSpan.contentEditable = "true";
  subSpan.dataset.field = "sub";
  subSpan.textContent = rowData.sub || "";
  td.appendChild(stageSpan);
  td.appendChild(subSpan);
  return td;
}

function createCustomTd(value, colId) {
  const td = el("td", "px-3 py-3 border-r border-slate-200");
  td.contentEditable = "true";
  td.dataset.colId = colId;
  td.style.whiteSpace = "pre-wrap";
  td.textContent = value || "";
  return td;
}

function createColHeaderTh(col) {
  const th = el("th", "px-3 py-4 min-w-[150px] border-r border-slate-200 bg-slate-50 plan-custom-th relative group/col");
  th.dataset.colId = col.id;
  const label = el("span", "");
  label.contentEditable = "true";
  label.textContent = col.label || "새 항목";
  th.appendChild(label);
  const removeBtn = el("button", "no-print ml-1 text-red-400 hover:text-red-600 align-middle");
  removeBtn.type = "button";
  removeBtn.title = "이 열 삭제";
  removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  removeBtn.addEventListener("click", () => {
    const rows = readPlanRowsFromDom();
    const customColumns = readCustomColumnsFromDom().filter((c) => c.id !== col.id);
    rows.forEach((r) => delete r.custom[col.id]);
    renderPlanTable(rows, customColumns);
  });
  th.appendChild(removeBtn);
  return th;
}

function createPlanRowActionsTd(getTr) {
  const td = el("td", "px-2 py-3 no-print text-center align-top whitespace-nowrap");
  const addBtn = el("button", "text-eco-600 hover:text-eco-800 mr-2");
  addBtn.type = "button";
  addBtn.title = "이 아래에 행 추가";
  addBtn.innerHTML = '<i class="fa-solid fa-square-plus"></i>';
  addBtn.addEventListener("click", () => insertPlanRowAfter(getTr()));
  const delBtn = el("button", "text-red-400 hover:text-red-600");
  delBtn.type = "button";
  delBtn.title = "이 행 삭제";
  delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  delBtn.addEventListener("click", () => deletePlanRow(getTr()));
  td.appendChild(addBtn);
  td.appendChild(delBtn);
  return td;
}

function createPlanRow(rowData, customColumns, isNewGroup) {
  const tr = el("tr", `hover:bg-slate-50 transition-colors ${isNewGroup ? "border-t-2 border-t-eco-300" : ""}`);
  tr.appendChild(createStageCell(rowData));
  tr.appendChild(editableTd(rowData.session, "session", "font-medium text-slate-900 text-center"));
  tr.appendChild(editableTd(rowData.topic, "topic"));
  tr.appendChild(editableTd(rowData.details, "details"));
  tr.appendChild(createAtlDropzoneTd(rowData.atl));
  tr.appendChild(editableTd(rowData.aiDigital, "aidigital"));
  tr.appendChild(editableTd(rowData.concepts, "concepts"));
  customColumns.forEach((col) => tr.appendChild(createCustomTd((rowData.custom || {})[col.id] || "", col.id)));
  tr.appendChild(createPlanRowActionsTd(() => tr));
  return tr;
}

function renderPlanHead(customColumns) {
  const theadRow = document.getElementById("plan-thead-row");
  theadRow.querySelectorAll(".plan-custom-th").forEach((n) => n.remove());
  const addColTh = document.getElementById("plan-add-col-th");
  customColumns.forEach((col) => theadRow.insertBefore(createColHeaderTh(col), addColTh));
}

function renderPlanTable(rows, customColumns) {
  renderPlanHead(customColumns || []);
  const tbody = document.getElementById("plan-tbody");
  tbody.innerHTML = "";
  (rows || []).forEach((rowData, idx) => {
    const isNewGroup = idx > 0 && rowData.stage !== rows[idx - 1].stage;
    tbody.appendChild(createPlanRow(rowData, customColumns || [], isNewGroup));
  });
}

// 현재 화면(DOM)에 있는 표 내용을 그대로 읽어서 데이터 배열로 만든다.
// 저장(serialize)과, 행/열 추가·삭제 후 다시 그릴 때 공통으로 사용한다.
function readCustomColumnsFromDom() {
  return Array.from(document.querySelectorAll("#plan-thead-row .plan-custom-th")).map((th) => ({
    id: th.dataset.colId,
    label: innerTextOf(th.querySelector("[contenteditable]")),
  }));
}

function readPlanRowsFromDom() {
  const customColumns = readCustomColumnsFromDom();
  return Array.from(document.querySelectorAll("#plan-tbody tr")).map((tr) => {
    const get = (f) => innerTextOf(tr.querySelector(`[data-field="${f}"]`));
    const atl = Array.from(tr.querySelectorAll(".atl-dropzone [data-badge]")).map((b) => b.dataset.badge);
    const custom = {};
    customColumns.forEach((col) => {
      custom[col.id] = innerTextOf(tr.querySelector(`td[data-col-id="${col.id}"]`));
    });
    return {
      stage: get("stage"),
      sub: get("sub"),
      session: get("session"),
      topic: get("topic"),
      details: get("details"),
      atl,
      aiDigital: get("aidigital"),
      concepts: get("concepts"),
      custom,
    };
  });
}

function insertPlanRowAfter(tr) {
  const rows = readPlanRowsFromDom();
  const customColumns = readCustomColumnsFromDom();
  const idx = Array.from(tr.parentElement.children).indexOf(tr);
  const ref = rows[idx] || {};
  rows.splice(idx + 1, 0, { stage: ref.stage || "", sub: ref.sub || "", session: "", topic: "", details: "", atl: [], aiDigital: "", concepts: "", custom: {} });
  renderPlanTable(rows, customColumns);
}

function deletePlanRow(tr) {
  const rows = readPlanRowsFromDom();
  const customColumns = readCustomColumnsFromDom();
  const idx = Array.from(tr.parentElement.children).indexOf(tr);
  rows.splice(idx, 1);
  renderPlanTable(rows, customColumns);
}

function addPlanColumn() {
  const rows = readPlanRowsFromDom();
  const customColumns = readCustomColumnsFromDom();
  customColumns.push({ id: "col_" + Math.random().toString(36).slice(2, 9), label: "새 항목" });
  renderPlanTable(rows, customColumns);
}

// ---------- 평가 계획 표 ----------
function evalTd(value, field, cls, noBorder) {
  const td = el("td", `px-4 py-6 ${noBorder ? "" : "border-r border-slate-200"} ${cls}`);
  td.contentEditable = "true";
  td.dataset.field = field;
  td.style.whiteSpace = "pre-wrap";
  td.textContent = value || "";
  return td;
}

function renderEvalTable(rows) {
  const tbody = document.getElementById("eval-tbody");
  tbody.innerHTML = "";
  (rows || []).forEach((r) => {
    const tr = el("tr", "hover:bg-slate-50 transition-colors");
    tr.appendChild(evalTd(r.area, "area", "font-bold text-slate-800 text-center bg-slate-50 align-middle"));
    tr.appendChild(evalTd(r.good, "good", "text-slate-700 leading-relaxed align-top"));
    tr.appendChild(evalTd(r.normal, "normal", "text-slate-700 leading-relaxed align-top"));
    tr.appendChild(evalTd(r.needsWork, "needsWork", "text-slate-700 leading-relaxed align-top", true));
    tbody.appendChild(tr);
  });
}

// ---------- 전체 하이드레이션(불러오기 -> 화면) ----------
function textOf(id) {
  const target = document.getElementById(id);
  return target ? target.textContent.trim() : "";
}

function hydrate(data) {
  document.getElementById("proj-title").textContent = data.title || "";
  document.getElementById("proj-eq").textContent = data.eq || "";
  document.getElementById("main-lens").textContent = data.structure.mainLens || "";
  document.getElementById("sub-lens").textContent = data.structure.subLens || "";
  document.getElementById("macro-concept").textContent = data.structure.macroConcept || "";
  document.getElementById("final-generalization").textContent = data.structure.finalGeneralization || "";

  const pillarsContainer = document.getElementById("pillars-container");
  pillarsContainer.innerHTML = "";
  (data.structure.pillars || []).forEach((p) => pillarsContainer.appendChild(createPillarEl(p)));

  const toolContainer = document.getElementById("tool-layers-container");
  toolContainer.innerHTML = "";
  (data.structure.toolLayers || []).forEach((c) => toolContainer.appendChild(createToolColumnEl(c)));

  document.getElementById("grasps-goal").textContent = data.grasps.goal || "";
  document.getElementById("grasps-role").textContent = data.grasps.role || "";
  document.getElementById("grasps-audience").textContent = data.grasps.audience || "";
  document.getElementById("grasps-situation").textContent = data.grasps.situation || "";

  const productList = document.getElementById("product-list");
  productList.innerHTML = "";
  (data.grasps.product || []).forEach((t) => productList.appendChild(createGraspsItem(t)));

  const standardList = document.getElementById("standard-list");
  standardList.innerHTML = "";
  (data.grasps.standards || []).forEach((t) => standardList.appendChild(createGraspsItem(t)));

  renderPlanTable(data.plan.rows || [], data.plan.customColumns || []);
  renderEvalTable(data.eval.rows || []);

  document.title = (data.title || "프로젝트") + " · 프로젝트 설계";
}

// ---------- 직렬화(화면 -> 저장 데이터) : innerText만 읽는다 ----------
function innerTextOf(elm) {
  return elm ? elm.innerText.trim() : "";
}

function serialize() {
  const pillars = Array.from(document.querySelectorAll("#pillars-container .pillar-wrapper")).map((w) => ({
    subGen: innerTextOf(w.querySelector(".pillar-subgen")),
    concepts: Array.from(w.querySelectorAll(".concept-container span[contenteditable]")).map(innerTextOf).filter(Boolean),
    facts: Array.from(w.querySelectorAll(".fact-container li span[contenteditable]")).map(innerTextOf).filter(Boolean),
  }));

  const toolLayers = Array.from(document.querySelectorAll("#tool-layers-container .tool-col")).map((col) => ({
    title: innerTextOf(col.querySelector(".tool-col-title")),
    items: Array.from(col.querySelectorAll(".tool-list li")).map((li) => ({
      subject: innerTextOf(li.querySelector(".tool-subject")),
      text: innerTextOf(li.querySelector(".tool-text")),
    })),
  }));

  const product = Array.from(document.querySelectorAll("#product-list li span[contenteditable]")).map(innerTextOf).filter(Boolean);
  const standards = Array.from(document.querySelectorAll("#standard-list li span[contenteditable]")).map(innerTextOf).filter(Boolean);

  const planRows = readPlanRowsFromDom();
  const planCustomColumns = readCustomColumnsFromDom();

  const evalRows = Array.from(document.querySelectorAll("#eval-tbody tr")).map((tr) => {
    const get = (f) => innerTextOf(tr.querySelector(`td[data-field="${f}"]`));
    return { area: get("area"), good: get("good"), normal: get("normal"), needsWork: get("needsWork") };
  });

  return {
    title: textOf("proj-title") || "제목 없는 프로젝트",
    eq: textOf("proj-eq"),
    structure: {
      mainLens: textOf("main-lens"),
      subLens: textOf("sub-lens"),
      macroConcept: textOf("macro-concept"),
      finalGeneralization: textOf("final-generalization"),
      pillars,
      toolLayers,
    },
    grasps: {
      goal: textOf("grasps-goal"),
      role: textOf("grasps-role"),
      audience: textOf("grasps-audience"),
      situation: textOf("grasps-situation"),
      product,
      standards,
    },
    plan: { rows: planRows, customColumns: planCustomColumns },
    eval: { rows: evalRows },
  };
}

// ---------- 탭 전환 ----------
function switchTab(tabId, evt) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  if (evt && evt.currentTarget) evt.currentTarget.classList.add("active");
  document.getElementById(tabId).classList.add("active");
}

// ---------- 자동 저장 ----------
function setSaveStatus(text, isError) {
  const target = document.getElementById("save-status");
  target.textContent = text;
  target.className = "text-xs " + (isError ? "text-red-500 font-semibold" : "text-slate-400");
}

function scheduleSave() {
  if (isHydrating) return;
  setSaveStatus("수정됨 · 저장 대기 중...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 900);
}

function updateLocalProjectRecord(id, title) {
  try {
    const list = JSON.parse(localStorage.getItem("mgi_my_projects")) || [];
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) list[idx].title = title;
    else list.push({ id, title, createdAt: Date.now() });
    localStorage.setItem("mgi_my_projects", JSON.stringify(list));
  } catch (e) {
    /* localStorage 접근 불가(프라이빗 모드 등) - 저장 자체는 Supabase에 계속 됨 */
  }
}

async function flushSave() {
  if (!currentProjectId) return;
  clearTimeout(saveTimer);
  const data = serialize();
  setSaveStatus("저장 중...");
  try {
    await dbUpdateProject(currentProjectId, data.title, data);
    setSaveStatus("저장됨 · " + new Date().toLocaleTimeString());
    updateLocalProjectRecord(currentProjectId, data.title);
  } catch (err) {
    console.error(err);
    setSaveStatus("저장 실패 - 인터넷 연결을 확인하세요", true);
  }
}

function getProjectIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

async function init() {
  if (!isSupabaseConfigured()) {
    setSaveStatus("Supabase 설정 필요", true);
    alert("아직 Supabase 연결 정보가 설정되지 않았습니다.\njs/supabase-client.js 파일에 Project URL과 anon key를 입력해주세요.");
    return;
  }

  currentProjectId = getProjectIdFromUrl();
  if (!currentProjectId) {
    window.location.href = "index.html";
    return;
  }

  setSaveStatus("불러오는 중...");
  let row;
  try {
    row = await dbGetProject(currentProjectId);
  } catch (err) {
    console.error(err);
    setSaveStatus("불러오기 실패", true);
    alert("프로젝트를 불러오지 못했습니다. 인터넷 연결 또는 Supabase 설정을 확인하세요.");
    return;
  }
  if (!row) {
    alert("해당 프로젝트를 찾을 수 없습니다.");
    window.location.href = "index.html";
    return;
  }

  isHydrating = true;
  renderAtlPalette();
  hydrate(row.data);
  isHydrating = false;
  setSaveStatus("저장됨");

  document.getElementById("btn-add-pillar").addEventListener("click", () => {
    document.getElementById("pillars-container").appendChild(
      createPillarEl({ subGen: "새로운 하위 일반화를 입력하세요.", concepts: ["새 개념"], facts: ["새로운 구체적 사실을 입력하세요."] })
    );
  });
  document.getElementById("btn-add-product").addEventListener("click", () => {
    document.getElementById("product-list").appendChild(createGraspsItem("새로운 항목을 입력하세요."));
  });
  document.getElementById("btn-add-standard").addEventListener("click", () => {
    document.getElementById("standard-list").appendChild(createGraspsItem("새로운 항목을 입력하세요."));
  });
  document.getElementById("btn-add-plan-row").addEventListener("click", () => {
    const rows = readPlanRowsFromDom();
    const customColumns = readCustomColumnsFromDom();
    rows.push(blankPlanRow());
    renderPlanTable(rows, customColumns);
  });
  document.getElementById("btn-add-plan-column").addEventListener("click", addPlanColumn);
  document.getElementById("btn-share").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (e) {
      window.prompt("아래 링크를 복사하세요:", window.location.href);
      return;
    }
    const btn = document.getElementById("btn-share");
    const original = btn.innerHTML;
    btn.textContent = "링크 복사됨!";
    setTimeout(() => {
      btn.innerHTML = original;
    }, 1500);
  });

  // app-root 안에서 일어나는 모든 텍스트/구조 변경(직접 편집, 항목 추가/삭제, ATL 드래그앤드롭)을
  // 감지해서 자동 저장을 예약한다. save-status/공유버튼은 app-root 밖에 있어 무한루프가 나지 않는다.
  const observer = new MutationObserver(scheduleSave);
  observer.observe(document.getElementById("app-root"), { childList: true, subtree: true, characterData: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
}

document.addEventListener("DOMContentLoaded", init);
