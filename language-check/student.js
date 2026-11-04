/* 아이들 화면: 반·이름 고르기 → 설문 → 결과와 다짐.
   화면은 처음에 한 번만 그리고 값만 바꿉니다. 다짐 칸은 절대 다시 그리지 않습니다(한글 조합 보호). */
(function () {
  const S = window.LC_SURVEY;
  const QUESTIONS = window.lcFlatQuestions();
  const DRAFT_KEY = "lc_draft_v1";
  const $ = id => document.getElementById(id);

  let intro = S.intro;
  let placeholder = S.placeholder;
  let draft = null; // { classId, className, studentId, studentName, answers, reflection, stage, sent, reflectionSent }
  let sending = false;

  function saveDraft() {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* 저장을 못 하는 기기에서는 새로고침 때 이어 하기만 안 됩니다 */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      return d && d.studentId && Array.isArray(d.answers) && d.answers.length === QUESTIONS.length ? d : null;
    } catch (e) { return null; }
  }

  function show(name) {
    ["pick", "survey", "result"].forEach(s => { $("screen-" + s).hidden = s !== name; });
    window.scrollTo(0, 0);
  }

  function ask(title, text, yes, no) {
    return new Promise(resolve => {
      const box = $("confirm-box");
      $("confirm-title").textContent = title;
      $("confirm-text").textContent = text;
      $("confirm-yes").textContent = yes;
      $("confirm-no").textContent = no;
      const done = v => {
        $("confirm-yes").onclick = $("confirm-no").onclick = null;
        box.oncancel = null;
        box.close();
        resolve(v);
      };
      $("confirm-yes").onclick = () => done(true);
      $("confirm-no").onclick = () => done(false);
      box.oncancel = e => { e.preventDefault(); done(false); };
      box.showModal();
    });
  }

  /* ── 1. 반·이름 고르기 ── */
  function pickStatus(text, retry) {
    const box = $("pick-status");
    box.innerHTML = "";
    if (!text) return;
    const p = document.createElement("div");
    p.className = "status warn";
    p.textContent = text;
    box.appendChild(p);
    if (retry) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn small"; b.textContent = "다시 시도";
      b.onclick = retry;
      box.appendChild(b);
    }
  }

  async function startPick() {
    show("pick");
    $("pick-class").hidden = true;
    $("pick-name").hidden = true;
    pickStatus("");
    $("pick-status").innerHTML = '<div class="status info">불러오는 중이에요…</div>';
    let data;
    try {
      data = await window.lcCall("lc_public_start");
    } catch (e) {
      pickStatus("반 목록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", startPick);
      return;
    }
    pickStatus("");
    if (data.intro) intro = data.intro;
    if (data.placeholder) placeholder = data.placeholder;
    if (!data.classes.length) {
      pickStatus("아직 반이 없어요. 선생님께 알려 주세요.", startPick);
      return;
    }
    const list = $("class-list");
    list.innerHTML = "";
    data.classes.forEach(c => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pick"; b.textContent = c.name;
      b.onclick = () => {
        list.querySelectorAll(".pick").forEach(x => x.classList.remove("chosen"));
        b.classList.add("chosen");
        loadRoster(c);
      };
      list.appendChild(b);
    });
    $("pick-class").hidden = false;
  }

  async function loadRoster(cls) {
    const list = $("name-list");
    list.innerHTML = "";
    $("pick-name").hidden = true;
    pickStatus("");
    let data;
    try {
      data = await window.lcCall("lc_class_roster", { p_class_id: cls.id });
    } catch (e) {
      pickStatus("명단을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.", () => loadRoster(cls));
      return;
    }
    if (!data.students.length) {
      pickStatus("이 반에는 아직 명단이 없어요. 선생님께 알려 주세요.");
      return;
    }
    $("name-title").textContent = cls.name + "에서 내 이름을 눌러 주세요";
    data.students.forEach(st => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pick"; b.textContent = st.name;
      b.onclick = () => chooseStudent(cls, st);
      list.appendChild(b);
    });
    $("pick-name").hidden = false;
    $("pick-name").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function chooseStudent(cls, st) {
    if (st.answered) {
      const again = await ask(
        st.name + " 맞나요?",
        "이미 답한 기록이 있어요. 다시 하면 새로 낸 답만 남아요. 다시 할까요?",
        "다시 할게요", "이름 다시 고르기"
      );
      if (!again) return;
    }
    draft = {
      classId: cls.id, className: cls.name, studentId: st.id, studentName: st.name,
      answers: new Array(QUESTIONS.length).fill(null),
      reflection: "", stage: "survey", sent: false, reflectionSent: false
    };
    saveDraft();
    openSurvey();
  }

  /* ── 2. 설문 ── */
  function buildSurvey() {
    const root = $("sections");
    let at = 0;
    S.sections.forEach(sec => {
      const wrap = document.createElement("div");
      wrap.className = "section";
      const h = document.createElement("header");
      h.textContent = sec.name;
      wrap.appendChild(h);
      const body = document.createElement("div");
      body.className = "body";
      sec.questions.forEach((text, qi) => {
        const idx = at++;
        const fs = document.createElement("fieldset");
        fs.className = "q"; fs.id = "q-" + idx;
        const lg = document.createElement("legend");
        const span = document.createElement("span");
        span.className = "q-text";
        span.textContent = (qi + 1) + ". " + text;
        lg.appendChild(span);
        fs.appendChild(lg);
        const row = document.createElement("div");
        row.className = "choices";
        S.choices.forEach(ch => {
          const lb = document.createElement("label");
          lb.className = "choice";
          const inp = document.createElement("input");
          inp.type = "radio"; inp.name = "a" + idx; inp.value = ch.value;
          inp.addEventListener("change", () => setAnswer(idx, ch.value));
          lb.appendChild(inp);
          lb.appendChild(document.createTextNode(ch.label));
          row.appendChild(lb);
        });
        fs.appendChild(row);
        body.appendChild(fs);
      });
      wrap.appendChild(body);
      root.appendChild(wrap);
    });
  }

  function setAnswer(idx, value) {
    draft.answers[idx] = value;
    draft.sent = false;
    $("q-" + idx).classList.remove("missing");
    saveDraft();
    updateProgress();
  }

  function updateProgress() {
    const done = draft.answers.filter(a => a != null).length;
    $("progress-text").textContent = done + "/" + QUESTIONS.length + " 답했어요";
    $("progress-fill").style.width = (done / QUESTIONS.length * 100) + "%";
    if (done === QUESTIONS.length) $("survey-msg").hidden = true;
  }

  function openSurvey() {
    $("who-text").textContent = draft.className + " " + draft.studentName;
    $("intro-text").textContent = intro;
    QUESTIONS.forEach(q => {
      $("q-" + q.index).classList.remove("missing");
      document.querySelectorAll('input[name="a' + q.index + '"]').forEach(inp => {
        inp.checked = Number(inp.value) === draft.answers[q.index];
      });
    });
    $("survey-msg").hidden = true;
    updateProgress();
    show("survey");
  }

  function questionLabel(q) {
    return S.sections[q.section].short + " " + q.number + "번";
  }

  function seeResult() {
    const missing = QUESTIONS.filter(q => draft.answers[q.index] == null);
    QUESTIONS.forEach(q => $("q-" + q.index).classList.toggle("missing", draft.answers[q.index] == null));
    if (missing.length) {
      const names = missing.slice(0, 5).map(questionLabel).join(", ");
      $("survey-msg").textContent = "아직 답하지 않은 문항이 " + missing.length + "개 있어요: " + names + (missing.length > 5 ? " 등" : "");
      $("survey-msg").hidden = false;
      $("q-" + missing[0].index).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    draft.stage = "result";
    draft.reflection = "";
    draft.reflectionSent = false;
    saveDraft();
    openResult();
    sendAll();
  }

  /* ── 3. 결과와 다짐 ── */
  function buildLights() {
    const box = $("lights");
    S.sections.forEach((sec, i) => {
      const card = document.createElement("div");
      card.className = "light-card";
      const lim = sec.limits;
      card.innerHTML =
        "<div>" + window.lcEsc(sec.name) + "</div>" +
        '<div class="lamps" aria-hidden="true"><div class="lamp green" id="lamp-' + i + '-green"></div><div class="lamp yellow" id="lamp-' + i + '-yellow"></div><div class="lamp red" id="lamp-' + i + '-red"></div></div>' +
        '<div class="light-word" id="word-' + i + '"></div>' +
        '<div class="light-range">' + lim.green[0] + "~" + lim.green[1] + "점 → 초록불<br>" + lim.yellow[0] + "~" + lim.yellow[1] + "점 → 노랑불<br>" + lim.red[0] + "~" + lim.red[1] + "점 → 빨간불</div>" +
        '<div><b>현재 점수: <span id="score-' + i + '"></span>점</b></div>';
      box.appendChild(card);
    });
    const row = $("sum-row");
    S.sections.forEach((sec, i) => {
      const d = document.createElement("div");
      d.innerHTML = window.lcEsc(sec.short) + ': <b><span id="sum-' + i + '"></span>점</b>';
      row.appendChild(d);
    });
  }

  function openResult() {
    const scores = window.lcScores(draft.answers);
    scores.forEach((score, i) => {
      const light = window.lcLight(i, score);
      ["green", "yellow", "red"].forEach(c => $("lamp-" + i + "-" + c).classList.toggle("on", c === light));
      const word = $("word-" + i);
      word.className = "light-word " + light;
      word.textContent = window.LC_LIGHT_NAMES[light] + "입니다!!";
      $("score-" + i).textContent = score;
      $("sum-" + i).textContent = score;
    });
    const ta = $("reflection");
    ta.placeholder = "예) " + placeholder;
    if (ta.value !== draft.reflection) ta.value = draft.reflection;
    show("result");
    renderSend();
    renderReflectState();
  }

  function renderSend(state) {
    const box = $("send-status");
    box.innerHTML = "";
    const add = (cls, text) => {
      const d = document.createElement("div");
      d.className = "status " + cls;
      d.textContent = text;
      box.appendChild(d);
      return d;
    };
    if (draft.sent) return; // 저장되면 조용히 둡니다. 다짐을 남기면 "남겼어요"가 보입니다.
    if (state === "sending" || sending) { add("info", "선생님께 보내는 중이에요…"); return; }
    if (state === "gone") { add("warn", "명단에서 내 이름을 찾지 못했어요. 선생님께 알려 주세요."); return; }
    const d = add("warn", "아직 선생님께 전달되지 않았어요. 답은 이 기기에만 남아 있어요.");
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn small"; b.textContent = "다시 보내기";
    b.style.display = "block"; b.style.marginTop = "8px";
    b.onclick = sendAll;
    d.appendChild(b);
  }

  function renderReflectState() {
    const text = $("reflection").value.trim();
    const btn = $("save-reflection");
    const reason = $("save-reason");
    const status = $("reflect-status");
    btn.disabled = !text || sending;
    reason.textContent = !text ? "다짐을 한 줄이라도 쓰면 누를 수 있어요." : "";
    status.innerHTML = "";
    if (draft.reflectionSent) {
      status.innerHTML = '<div class="status good">남겼어요. 선생님께 전달되었어요.</div>';
    } else if (draft.reflectionTried && text) {
      status.innerHTML = '<div class="status warn">아직 전달되지 않았어요. 쓴 글은 이 기기에 남아 있으니 "다짐 남기기"를 다시 눌러 주세요.</div>';
    } else if (draft.reflectionWasSent && text) {
      status.innerHTML = '<div class="status info">고친 내용은 아직 남기지 않았어요.</div>';
    }
  }

  /* 답 → 다짐 순서로 보냅니다. 답을 이미 보냈으면 다시 보내지 않습니다(다짐이 지워지지 않게). */
  async function sendAll(withReflection) {
    if (sending) return;
    sending = true;
    renderSend("sending");
    renderReflectState();
    try {
      if (!draft.sent) {
        const r = await window.lcCall("lc_submit", { p_student_id: draft.studentId, p_answers: draft.answers });
        if (!r.ok) {
          sending = false;
          renderSend(r.error === "no_student" ? "gone" : undefined);
          renderReflectState();
          return;
        }
        draft.sent = true;
        saveDraft();
      }
      if (withReflection === true) {
        const r = await window.lcCall("lc_save_reflection", { p_student_id: draft.studentId, p_text: $("reflection").value });
        if (!r.ok) throw new Error(r.error);
        draft.reflectionSent = true;
        draft.reflectionWasSent = true;
        draft.reflectionTried = false;
        saveDraft();
      }
    } catch (e) {
      if (withReflection === true) draft.reflectionTried = true;
      saveDraft();
    }
    sending = false;
    renderSend();
    renderReflectState();
  }

  async function restart() {
    if (!draft.sent) {
      const leave = await ask("아직 전달되지 않았어요", "지금 나가면 답이 선생님께 가지 않아요. 그래도 처음으로 갈까요?", "그래도 나가기", "돌아가기");
      if (!leave) return;
    } else if ($("reflection").value.trim() && !draft.reflectionSent) {
      const leave = await ask("다짐을 아직 남기지 않았어요", "지금 나가면 쓴 다짐이 지워져요. 그래도 처음으로 갈까요?", "그래도 나가기", "돌아가기");
      if (!leave) return;
    }
    reset();
  }

  function reset() {
    draft = null;
    saveDraft();
    $("reflection").value = "";
    startPick();
  }

  /* ── 시작 ── */
  buildSurvey();
  buildLights();
  $("see-result").addEventListener("click", seeResult);
  $("change-name").addEventListener("click", reset);
  $("restart").addEventListener("click", restart);
  $("save-reflection").addEventListener("click", () => sendAll(true));
  $("reflection").addEventListener("input", () => {
    draft.reflection = $("reflection").value;
    draft.reflectionSent = false;
    saveDraft();
    renderReflectState();
  });

  draft = loadDraft();
  if (draft && draft.stage === "result") {
    openResult();
    if (!draft.sent) sendAll();
  } else if (draft) {
    openSurvey();
  } else {
    startPick();
  }
})();
