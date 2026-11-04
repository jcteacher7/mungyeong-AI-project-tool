/* 문항과 점수 기준은 고정입니다. 문구를 고치려면 아이들이 응답하기 전에 고치세요.
   영역별 문항 수를 바꾸면 schema.sql 의 lc_submit 도 함께 고쳐야 합니다. */
window.LC_SURVEY = {
  title: "언어생활 자가진단",
  intro: "여러분은 평소에 인터넷, 휴대전화를 사용하면서 어떤 언어를 어떻게 사용하고 있나요? 일상 대화 속에서 사용하는 언어와는 다른 형태의 언어를 사용하고 있지는 않나요? 이번 진단에서는 주로 컴퓨터와 휴대전화로 친구들과 나누는 '음성대화, 메신저 대화, 문자 대화, SNS(소셜 네트워크 서비스, 트위터, 페이스북), 인터넷 게시판 대화'를 중심으로 살펴보도록 하겠습니다.",
  placeholder: "줄임말과 반말 사용을 줄이고, 정중한 표현을 쓰겠습니다.",
  choices: [
    { value: 5, label: "매우 그렇다" },
    { value: 4, label: "그렇다" },
    { value: 3, label: "보통이다" },
    { value: 2, label: "그렇지 않다" },
    { value: 1, label: "전혀 그렇지 않다" }
  ],
  sections: [
    {
      name: "일상생활에의 영향",
      short: "일상생활 영향",
      limits: { green: [5, 10], yellow: [11, 18], red: [19, 25] },
      questions: [
        "새로운 말이나 줄임말, 유행어를 직접 만나서 대화하는 일상생활에서도 사용한다.",
        "학교 과제를 하거나 공식적인 글을 쓸 때에도(또는 쓸 때에) 이모티콘을 사용한다.",
        "실제 대화에서 자음이나 모음만을 사용해 표현한다. (예: ㅠㅠ, ㅋㅋ, ㅇㅇ, ㅈㅅ 등)",
        "문장의 끝을 '~함', '~임'과 같이 끝내거나 '~ 해쩌?', '~해용'과 같이 말한다.",
        "어른이 이해하지 못하는 인터넷 용어를 사용한 적이 있다."
      ]
    },
    {
      name: "언어사용규범",
      short: "언어사용규범",
      limits: { green: [10, 20], yellow: [21, 37], red: [38, 50] },
      questions: [
        "첫 글자만 따서 줄임말을 만들어 쓴다. (예: 문화상품권→문상, 버스카드충전→버카충, 멘탈붕괴→멘붕 등)",
        "새로운 말이 생기면 바로 사용한다.",
        "맞춤법과 상관없이 소리나는 대로 쓴다.",
        "문장의 끝을 '~함', '~임' 같이 표현한다.",
        "말끝을 바꿔서 귀엽거나 재미있게 표현한다.(예 : 해찡, 끊어용, 그래쩌?)",
        "모르는 사람에게도 쉽게 반말을 한다.",
        "어른을 직접 만나서 대화할 때보다 존댓말을 덜 사용한다.",
        "내가 누구인지 밝히지 않고 질문만 한 적이 있다.",
        "늦은 시간에 문자를 보내거나 전화를 한 적이 있다.",
        "띄어쓰기를 대충 하거나 하지 않는다."
      ]
    },
    {
      name: "사용 태도 및 습관",
      short: "사용 태도",
      limits: { green: [4, 9], yellow: [10, 15], red: [16, 20] },
      questions: [
        "누군가를 욕하거나 악성 댓글을 달아본 적이 있다.",
        "누군가를 놀리거나 따돌리는 말을 한 경험이 있다.",
        "대화의 주제와 상관없이 내가 하고 싶은 말만 썼던 적이 있다.",
        "잘 모르는 일이나 거짓말을 퍼뜨린 적이 있다."
      ]
    }
  ]
};

window.LC_LIGHT_NAMES = { green: "초록불", yellow: "노랑불", red: "빨간불" };

window.lcLight = function (sectionIndex, score) {
  const lim = window.LC_SURVEY.sections[sectionIndex].limits;
  if (score <= lim.green[1]) return "green";
  if (score <= lim.yellow[1]) return "yellow";
  return "red";
};

window.lcScores = function (answers) {
  let at = 0;
  return window.LC_SURVEY.sections.map(sec => {
    let sum = 0;
    sec.questions.forEach(() => { sum += answers[at++]; });
    return sum;
  });
};

/* 문항을 한 줄 목록으로 펼친 것: 답 배열의 순서와 같습니다. */
window.lcFlatQuestions = function () {
  const out = [];
  window.LC_SURVEY.sections.forEach((sec, si) => {
    sec.questions.forEach((text, qi) => {
      out.push({ index: out.length, section: si, number: qi + 1, text, sectionName: sec.name });
    });
  });
  return out;
};

/* 서버와 주고받는 길은 여기 하나입니다. 실패하면 Error 를 던집니다(인터넷 끊김 등). */
window.lcCall = async function (fn, args) {
  const res = await fetch(window.LC_CONFIG.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: window.LC_CONFIG.key },
    body: JSON.stringify(args || {})
  });
  if (!res.ok) throw new Error("서버 응답 " + res.status);
  return res.json();
};

window.lcEsc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};
