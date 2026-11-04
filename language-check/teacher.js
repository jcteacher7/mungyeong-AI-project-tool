/* 선생님 페이지. 아이들 글은 항상 lcEsc 를 거쳐 화면에 넣습니다.
   자동 새로고침은 ① 반 요약과 ⑤ 다짐 모아보기에서만, 입력 칸을 쓰지 않을 때만 돕니다. */
(function () {
  const S = window.LC_SURVEY;
  const QUESTIONS = window.lcFlatQuestions();
  const esc = window.lcEsc;
  const $ = id => document.getElementById(id);
  const PW_KEY = "lc_teacher_pw";

  let pw = "";
  let data = null;
  let tab = "summary";
  let classId = null;
  let hideNames = false;
  let openKid = null;
  let wallNames = false;

  function rememberPw(v) {
    pw = v;
    try { v ? sessionStorage.setItem(PW_KEY, v) : sessionStorage.removeItem(PW_KEY); } catch (e) { /* 새로고침 때 다시 입력 */ }
  }
  function recallPw() {
    try { return sessionStorage.getItem(PW_KEY) || ""; } catch (e) { return ""; }
  }

  const LOGIN_ERRORS = {
    bad: "암호가 맞지 않아요.",
    locked: "여러 번 틀려서 10분 동안 잠겼어요. 잠시 뒤에 다시 해 주세요.",
    unset: "아직 암호를 정하지 않았어요. Supabase에서 암호 정하기를 먼저 해 주세요."
  };

  /* 암호가 틀렸거나 잠기면 로그인 화면으로 돌아갑니다. */
  async function call(fn, args) {
    const r = await window.lcCall(fn, Object.assign({ p_pw: pw }, args || {}));
    if (!r.ok && LOGIN_ERRORS[r.error]) {
      showLogin(LOGIN_ERRORS[r.error]);
      const e = new Error(r.error);
      e.handled = true;
      throw e;
    }
    return r;
  }

  function showLogin(msg) {
    rememberPw("");
    data = null;
    $("main-box").hidden = true;
    $("login-box").hidden = false;
    $("login-msg").innerHTML = msg ? '<div class="status warn">' + esc(msg) + "</div>" : "";
    $("pw").value = "";
    $("pw").focus();
  }

  function setMsg(text, cls) {
    $("load-msg").innerHTML = text ? '<div class="status ' + (cls || "warn") + '">' + esc(text) + "</div>" : "";
  }

  async function load(quiet) {
    if (!quiet) setMsg("불러오는 중이에요…", "info");
    let r;
    try {
      r = await call("lc_t_data");
    } catch (e) {
      if (!e.handled) setMsg("불러오지 못했어요. 인터넷 연결을 확인하고 새로고침을 눌러 주세요.");
      return false;
    }
    data = r;
    setMsg("");
    $("login-box").hidden = true;
    $("main-box").hidden = false;
    fillClassSelect();
    const now = new Date();
    $("refreshed").textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") + " 기준";
    render();
    return true;
  }

  function fillClassSelect() {
    const sel = $("class-select");
    if (!data.classes.some(c => c.id === classId)) classId = data.classes.length ? data.classes[0].id : null;
    sel.innerHTML = data.classes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>").join("");
    if (classId != null) sel.value = String(classId);
  }

  function currentClass() { return data.classes.find(c => c.id === classId) || null; }
  function classStudents() { return data.students.filter(s => s.class_id === classId); }
  function roster() { return classStudents().filter(s => s.active); }
  function responded() { return classStudents().filter(s => s.response); }

  function render() {
    document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"));
    const v = $("view");
    if (tab === "manage") { renderManage(v); return; }
    if (classId == null) {
      v.innerHTML = '<p>아직 반이 없어요. <b>④ 관리</b>에서 반과 명단을 넣어 주세요.</p>';
      return;
    }
    if (tab === "summary") renderSummary(v);
    if (tab === "items") renderItems(v);
    if (tab === "kids") renderKids(v);
    if (tab === "wall") renderWall(v);
  }

  function round1(x) { return (Math.round(x * 10) / 10).toFixed(1); }

  function barSegments(parts, total) {
    return parts.filter(p => p.count > 0).map(p => {
      const share = p.count / total * 100;
      const title = p.label + " " + p.count + "명 (" + Math.round(share) + "%)";
      return '<i class="' + p.cls + '" style="flex:' + p.count + ' 0 0" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + (share >= 8 ? p.count : "") + "</i>";
    }).join("");
  }

  /* ── ① 반 요약 ── */
  function renderSummary(v) {
    const done = responded();
    const notYet = roster().filter(s => !s.response);
    const count = done.length;
    const withText = done.filter(s => s.response.reflection).length;

    const areas = S.sections.map((sec, i) => {
      const scores = done.map(s => s.response.scores[i]);
      const avg = count ? scores.reduce((a, b) => a + b, 0) / count : 0;
      const lights = { green: 0, yellow: 0, red: 0 };
      scores.forEach(sc => { lights[window.lcLight(i, sc)]++; });
      return { sec, avg, perItem: avg / sec.questions.length, lights };
    });

    let html = '<div class="tiles">' +
      '<div class="tile"><div class="big">' + count + " <small>/ " + roster().length + "명</small></div><div class=\"lab\">응답한 아이</div></div>" +
      '<div class="tile"><div class="big">' + withText + " <small>명</small></div><div class=\"lab\">다짐을 남긴 아이</div></div>" +
      "</div>";

    html += '<details class="not-yet"><summary>아직 안 한 아이 ' + notYet.length + "명 (TV에 띄울 때는 접어 두세요)</summary><p style=\"margin:8px 0 0\">" +
      (notYet.length ? notYet.map(s => esc(s.name)).join(", ") : "모두 답했어요.") + "</p></details>";

    if (!count) {
      html += '<p class="muted">아직 응답이 없어요. 아이들이 답하면 여기에 나타납니다.</p>';
      v.innerHTML = html;
      return;
    }

    const top = Math.max(...areas.map(a => a.perItem));
    const worst = areas.filter(a => a.perItem === top);
    html += '<div class="callout">가장 약한 영역: <strong>' + worst.map(a => esc(a.sec.name)).join(", ") + "</strong>" +
      '<div class="note" style="margin:4px 0 0">영역마다 문항 수가 달라서 문항 하나당 평균 점수로 비교했어요 (' + round1(top) + "점 / 5점). 점수가 높을수록 고칠 점이 많아요.</div></div>";

    html += '<div class="panel"><h2>영역별 평균과 신호등 인원</h2>' +
      '<div class="legend"><span><i class="seg-green"></i>초록불</span><span><i class="seg-yellow"></i>노랑불</span><span><i class="seg-red"></i>빨간불</span></div>';
    areas.forEach(a => {
      const max = a.sec.limits.red[1];
      html += '<div class="area-row"><div class="area-name">' + esc(a.sec.name) + "</div>" +
        '<div class="area-avg"><b>' + round1(a.avg) + "</b> / " + max + "점</div>" +
        '<div class="bar">' + barSegments([
          { cls: "seg-green", count: a.lights.green, label: "초록불" },
          { cls: "seg-yellow", count: a.lights.yellow, label: "노랑불" },
          { cls: "seg-red", count: a.lights.red, label: "빨간불" }
        ], count) + "</div></div>";
    });
    html += '</div><p class="note">아이가 스스로 답한 결과예요. 빨간불이 곧 문제 학생이라는 뜻은 아니니, 대화의 출발점으로 봐 주세요.</p>';
    v.innerHTML = html;
  }

  /* ── ② 문항별 분석 ── */
  const ANSWER_CLS = { 5: "seg-a5", 4: "seg-a4", 3: "seg-a3", 2: "seg-a2", 1: "seg-a1" };

  function renderItems(v) {
    const done = responded();
    if (!done.length) { v.innerHTML = '<p class="muted">아직 응답이 없어요.</p>'; return; }
    const rows = QUESTIONS.map(q => {
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      done.forEach(s => { const a = s.response.answers[q.index]; counts[a]++; sum += a; });
      return { q, counts, mean: sum / done.length };
    }).sort((a, b) => b.mean - a.mean || a.q.index - b.q.index);

    let html = '<div class="callout">가장 많이 나타나는 언어 습관: <strong>' + esc(rows[0].q.text) + "</strong>" +
      '<div class="note" style="margin:4px 0 0">평균 ' + round1(rows[0].mean) + "점 / 5점 · " + done.length + "명 응답</div></div>";
    html += '<p class="note">점수 높은 순서예요. 높을수록 고칠 점이 많아요. 막대 위에 마우스를 올리면 인원이 보여요.</p>';
    html += '<div class="legend">' + S.choices.map(c => '<span><i class="' + ANSWER_CLS[c.value] + '"></i>' + esc(c.label) + "</span>").join("") + "</div>";
    rows.forEach((r, i) => {
      html += '<div class="qrow"><div class="qtext"><span class="rank">' + (i + 1) + "</span>" + esc(r.q.text) + "</div>" +
        '<div class="qmeta">' + esc(r.q.sectionName) + " " + r.q.number + "번 · 평균 " + round1(r.mean) + "점</div>" +
        '<div class="bar">' + barSegments(S.choices.map(c => ({ cls: ANSWER_CLS[c.value], count: r.counts[c.value], label: c.label })), done.length) + "</div></div>";
    });
    v.innerHTML = html;
  }

  /* ── ③ 아이별 보기 ── */
  function kidName(s, i) {
    return hideNames ? (i + 1) + "번" : esc(s.name);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function kidCell(i, score) {
    const light = window.lcLight(i, score);
    return '<td class="num"><span class="dot ' + light + '"></span>' + score + '<span class="tag">' + window.LC_LIGHT_NAMES[light] + "</span></td>";
  }

  function renderKids(v) {
    const kids = classStudents().filter(s => s.active || s.response);
    let html = '<div class="toolbar"><label><input type="checkbox" id="hide-names"' + (hideNames ? " checked" : "") +
      '> 이름 가리기 (TV에 띄울 때)</label></div>';
    html += '<div class="table-wrap"><table><thead><tr><th>이름</th>' +
      S.sections.map(sec => '<th class="num">' + esc(sec.short) + "</th>").join("") +
      "<th>다짐</th><th>답한 때</th><th></th></tr></thead><tbody>";
    kids.forEach((s, i) => {
      const tagOut = s.active ? "" : '<span class="tag">명단에서 빠짐</span>';
      if (!s.response) {
        html += "<tr><td>" + kidName(s, i) + tagOut + '</td><td colspan="5" class="muted">아직 안 함</td></tr>';
        return;
      }
      const r = s.response;
      html += "<tr><td>" + kidName(s, i) + tagOut + "</td>" + r.scores.map((sc, si) => kidCell(si, sc)).join("") +
        "<td>" + (r.reflection ? "남김" : '<span class="muted">없음</span>') + "</td>" +
        "<td>" + esc(formatTime(r.answered_at)) + "</td>" +
        '<td><button type="button" class="linkbtn" data-open="' + esc(s.id) + '" aria-expanded="' + (openKid === s.id) + '">' + (openKid === s.id ? "접기" : "자세히") + "</button></td></tr>";
      if (openKid === s.id) {
        html += '<tr class="detail"><td colspan="6"><h3>나의 반성 및 다짐</h3><div class="detail-reflect">' +
          (r.reflection ? esc(r.reflection) : "아직 남기지 않았어요.") + "</div><h3>문항별 답</h3><ul class=\"detail-list\">" +
          QUESTIONS.map(q => {
            const c = S.choices.find(x => x.value === r.answers[q.index]);
            return "<li><span>" + esc(q.text) + "</span><b>" + esc(c ? c.label : "") + "</b></li>";
          }).join("") + "</ul></td></tr>";
      }
    });
    html += "</tbody></table></div>";
    if (!kids.length) html = '<p class="muted">이 반에는 아직 명단이 없어요. <b>④ 관리</b>에서 넣어 주세요.</p>';
    v.innerHTML = html;
    const cb = $("hide-names");
    if (cb) cb.onchange = () => { hideNames = cb.checked; if (hideNames) openKid = null; render(); };
    v.querySelectorAll("[data-open]").forEach(b => {
      b.onclick = () => { openKid = openKid === b.dataset.open ? null : b.dataset.open; render(); };
    });
  }

  /* ── ⑤ 다짐 모아보기 ── 최근에 남긴 다짐이 위로 옵니다. 이름은 처음에 가려 둡니다. */
  function renderWall(v) {
    const notes = responded().filter(s => s.response.reflection).sort((a, b) =>
      String(b.response.reflected_at || "").localeCompare(String(a.response.reflected_at || "")));
    let html = '<div class="toolbar"><b>다짐 ' + notes.length + "개</b>" +
      '<span class="muted">응답 ' + responded().length + "명 중</span><span class=\"grow\"></span>" +
      '<button type="button" class="btn ghost small" id="wall-names">' + (wallNames ? "이름 가리기" : "이름 보이기") + "</button></div>";
    if (!notes.length) {
      html += '<p class="muted">아직 남긴 다짐이 없어요. 아이들이 남기면 여기에 나타납니다.</p>';
    } else {
      html += '<div class="wall">' + notes.map(s =>
        '<div class="wall-note"><p>' + esc(s.response.reflection) + "</p>" +
        (wallNames ? '<div class="wall-name">' + esc(s.name) + "</div>" : "") + "</div>").join("") + "</div>";
    }
    v.innerHTML = html;
    $("wall-names").onclick = () => { wallNames = !wallNames; render(); };
  }

  /* ── ④ 관리 ── */
  function renderManage(v) {
    const cls = currentClass();
    const names = cls ? roster().map(s => s.name).join("\n") : "";
    const left = cls ? classStudents().filter(s => !s.active) : [];
    const answered = cls ? responded().length : 0;

    let html = '<div class="manage-block"><h2>반 추가</h2><form id="add-class" class="row-inline">' +
      '<input type="text" id="new-class" placeholder="예) 2학년 1반" aria-label="새 반 이름" required>' +
      '<button class="btn small" type="submit">추가</button></form><div id="add-msg" role="status"></div></div>';

    if (cls) {
      html += '<div class="manage-block"><h2>' + esc(cls.name) + ' 명단</h2>' +
        '<p class="note">한 줄에 한 명씩 적어 주세요. 적은 순서대로 아이들 화면에 나와요. 이름을 고치거나 빼도 이전 기록은 지워지지 않고 "명단에서 빠짐"으로 남아요.</p>' +
        '<textarea id="roster" rows="10" aria-label="명단">' + esc(names) + "</textarea>" +
        '<div id="roster-msg" role="status"></div><div style="margin-top:8px"><button type="button" class="btn small" id="save-roster">명단 저장</button></div></div>';
    }

    html += '<div class="manage-block"><h2>아이들 화면 문구</h2>' +
      '<div class="field"><label for="set-intro">안내글</label><textarea id="set-intro" rows="5">' + esc(data.intro || S.intro) + "</textarea></div>" +
      '<div class="field"><label for="set-ph">다짐 칸 예시</label><input type="text" id="set-ph" value="' + esc(data.placeholder || S.placeholder) + '"></div>' +
      '<div id="settings-msg" role="status"></div><button type="button" class="btn small" id="save-settings">문구 저장</button></div>';

    if (cls) {
      html += '<div class="manage-block"><h2>' + esc(cls.name) + ' 기록 내려받기</h2>' +
        '<p class="note">엑셀에서 열리는 파일로 내려받아요. 응답 ' + answered + '명.</p>' +
        '<button type="button" class="btn ghost small" id="download"' + (answered ? "" : " disabled") + ">엑셀로 내려받기</button></div>";

      if (left.length) {
        html += '<div class="manage-block"><h2>명단에서 빠진 아이</h2><p class="note">지우면 그 아이의 기록도 함께 지워져요.</p><ul class="detail-list">' +
          left.map(s => "<li><span>" + esc(s.name) + (s.response ? ' <span class="tag">기록 있음</span>' : "") + '</span><button type="button" class="linkbtn" data-remove="' + esc(s.id) + '">지우기</button></li>').join("") +
          "</ul></div>";
      }

      html += '<div class="manage-block danger-block"><h2>기록 지우기</h2>' +
        '<p class="note">지운 기록은 되살릴 수 없어요. 먼저 엑셀로 내려받아 두세요. 학기가 끝나면 지우시길 권해요.</p>' +
        '<div class="row-inline"><button type="button" class="btn danger small" id="clear-class"' + (answered ? "" : " disabled") + ">" + esc(cls.name) + " 기록 지우기 (" + answered + "명)</button>" +
        '<button type="button" class="btn ghost small" id="delete-class">' + esc(cls.name) + " 반과 명단까지 없애기</button></div><div id=\"danger-msg\" role=\"status\"></div></div>";
    }
    v.innerHTML = html;

    $("add-class").onsubmit = async e => {
      e.preventDefault();
      const name = $("new-class").value.trim();
      if (!name) return;
      await guarded("add-msg", async () => {
        const r = await call("lc_t_add_class", { p_name: name });
        if (!r.ok) return flash("add-msg", r.error === "duplicate" ? "같은 이름의 반이 이미 있어요." : "반 이름을 적어 주세요.");
        classId = r.id;
        await load(true);
      });
    };
    if (!cls) { bindSettings(); return; }

    $("save-roster").onclick = () => guarded("roster-msg", async () => {
      const list = $("roster").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const dup = list.find((n, i) => list.indexOf(n) !== i);
      if (dup) return flash("roster-msg", '"' + dup + '" 이름이 두 번 있어요. 동명이인이면 "김지훈A", "김지훈B"처럼 구분해 주세요.');
      const r = await call("lc_t_set_roster", { p_class_id: classId, p_names: list });
      if (!r.ok) return flash("roster-msg", "명단을 저장하지 못했어요.");
      await load(true);
      flash("roster-msg", list.length + "명을 저장했어요.", "good");
    });
    bindSettings();
    $("download").onclick = downloadCsv;
    v.querySelectorAll("[data-remove]").forEach(b => {
      b.onclick = async () => {
        const st = data.students.find(s => s.id === b.dataset.remove);
        const yes = await confirmBox(st.name + " 지우기", "명단에서 빠진 이 아이를 기록까지 지울까요? 되살릴 수 없어요.", "지우기");
        if (!yes) return;
        await guarded("danger-msg", async () => {
          await call("lc_t_remove_student", { p_student_id: st.id });
          await load(true);
        });
      };
    });
    $("clear-class").onclick = async () => {
      const yes = await confirmBox(cls.name + " 기록 지우기", answered + "명의 답과 다짐을 지웁니다. 명단은 남아요. 되살릴 수 없어요.", answered + "명 기록 지우기");
      if (!yes) return;
      await guarded("danger-msg", async () => {
        const r = await call("lc_t_clear_class", { p_class_id: classId });
        await load(true);
        flash("danger-msg", r.deleted + "명의 기록을 지웠어요.", "good");
      });
    };
    $("delete-class").onclick = async () => {
      const yes = await confirmBox(cls.name + " 없애기", "반과 명단, 기록 " + answered + "명을 모두 지웁니다. 되살릴 수 없어요.", "모두 지우기");
      if (!yes) return;
      await guarded("danger-msg", async () => {
        await call("lc_t_delete_class", { p_class_id: classId });
        classId = null;
        await load(true);
      });
    };
  }

  function bindSettings() {
    $("save-settings").onclick = () => guarded("settings-msg", async () => {
      const r = await call("lc_t_save_settings", { p_intro: $("set-intro").value, p_placeholder: $("set-ph").value });
      if (!r.ok) return flash("settings-msg", "문구를 저장하지 못했어요.");
      await load(true);
      flash("settings-msg", "저장했어요.", "good");
    });
  }

  function flash(id, text, cls) {
    const el = $(id);
    if (el) el.innerHTML = '<div class="status ' + (cls || "warn") + '">' + esc(text) + "</div>";
  }

  async function guarded(msgId, fn) {
    try {
      await fn();
    } catch (e) {
      if (!e.handled) flash(msgId, "저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    }
  }

  function confirmBox(title, text, yes) {
    return new Promise(resolve => {
      const box = $("confirm-box");
      $("confirm-title").textContent = title;
      $("confirm-text").textContent = text;
      $("confirm-yes").textContent = yes;
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

  /* 엑셀이 한글을 깨뜨리지 않게 BOM 을 붙이고, 수식으로 읽힐 글은 작은따옴표로 막습니다. */
  function csvCell(v) {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadCsv() {
    const cls = currentClass();
    const head = ["반", "이름"].concat(
      S.sections.flatMap(sec => [sec.short + " 점수", sec.short + " 신호등"]),
      ["다짐", "답한 때"],
      QUESTIONS.map(q => q.sectionName + " " + q.number + "번")
    );
    const rows = responded().map(s => {
      const r = s.response;
      return [cls.name, s.name].concat(
        r.scores.flatMap((sc, i) => [sc, window.LC_LIGHT_NAMES[window.lcLight(i, sc)]]),
        [r.reflection || "", formatTime(r.answered_at)],
        r.answers
      );
    });
    const text = "﻿" + [head].concat(rows).map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "언어생활자가진단_" + cls.name + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ── 시작 ── */
  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const tried = $("pw").value;
    $("login-msg").innerHTML = '<div class="status info">확인하는 중이에요…</div>';
    let r;
    try {
      r = await window.lcCall("lc_t_login", { p_pw: tried });
    } catch (err) {
      $("login-msg").innerHTML = '<div class="status warn">연결하지 못했어요. 인터넷 연결을 확인해 주세요.</div>';
      return;
    }
    if (!r.ok) {
      $("login-msg").innerHTML = '<div class="status warn">' + esc(LOGIN_ERRORS[r.error] || "들어가지 못했어요.") + "</div>";
      return;
    }
    rememberPw(tried);
    $("pw").value = "";
    await load();
  });
  $("logout").addEventListener("click", () => showLogin());
  $("refresh").addEventListener("click", () => load());
  $("class-select").addEventListener("change", () => {
    classId = Number($("class-select").value);
    openKid = null;
    render();
  });
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    openKid = null;
    render();
  }));

  setInterval(() => {
    if ((tab !== "summary" && tab !== "wall") || !data || document.hidden) return;
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if ($("confirm-box").open) return;
    const open = document.querySelector("details.not-yet");
    const wasOpen = open && open.open;
    load(true).then(() => {
      const again = document.querySelector("details.not-yet");
      if (again && wasOpen) again.open = true;
    });
  }, 20000);

  pw = recallPw();
  if (pw) load(); else showLogin();
})();
