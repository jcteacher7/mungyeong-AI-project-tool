// 일반화 탐구 챗봇 — 제미나이 중계 함수 (Supabase Edge Function, 이름: gen-chat)
//
// 아이 태블릿 → 이 함수 → 제미나이. 제미나이 키는 이 함수의 비밀 값(Secrets)에만 있습니다.
// (경북 자원 지도의 gemini-chat 과 같은 GEMINI_API_KEY 를 같이 씁니다.)
// 이 함수는:
//   1) 반·모둠·글 길이를 확인하고, 선생님이 그 반의 챗봇을 열었는지 확인합니다.
//   2) 너무 자주·너무 많이 보내지 못하게 막습니다.
//   3) 모둠의 앞선 대화, 모둠이 남긴 칸, 취재 노트의 비교 카드를 붙여 제미나이에 묻습니다.
//   4) 질문·답·모둠·시각을 entries 표(group_id 920, key 'm:<반>:<모둠>:<번호>')에 저장합니다.
//
// 표: 취재 노트와 같은 public.entries (group_id, key, value, updated_at)
//   921 / 'cfg'                 이 앱 설정(반별 단계·챗봇 열림·문장 틀, 문구)
//   920 / 'k:<반>:<모둠>:<단계>'   모둠이 남긴 칸
//   920 / 'm:<반>:<모둠>:<번호>'   챗봇 대화
//   911 / 'cfg'                 취재 노트 설정(모둠 편성) — 읽기만
//   910 / 'c:<반>:<모둠>:cmp:…'   취재 노트 비교 카드 — 읽기만

const MAX_Q = 200;          // 한 번에 보낼 수 있는 글자 수
const PER_MIN = 6;          // 한 모둠이 1분에 보낼 수 있는 횟수
const PER_DAY_GROUP = 120;  // 한 모둠이 하루에 보낼 수 있는 횟수
const PER_DAY_ALL = 900;    // 이 앱 전체가 하루에 보낼 수 있는 횟수
const HISTORY = 16;         // 함께 보내는 앞선 대화 쌍 수

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
let SB_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MODELS: string[] = [...new Set([Deno.env.get('GEMINI_MODEL') ?? '', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'])]
  .filter((m) => m !== '');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const G_DATA = 920, G_CFG = 921, G_NOTE_CFG = 911, G_NOTE = 910;

const DEFAULT_SUBS = {
  space: '사람들이 사는 공간(자연환경 및 인문환경)의 특징에 따라 서로 다른 생활 모습으로 변화한다.',
  time: '사람들이 환경을 이용하는 방식이 달라지면, 시간의 흐름에 따라 사람들의 생활 모습도 변화한다.',
};
const DEFAULT_STAGES = [
  { name: '예상하기', question: '두 문장을 모둠이 함께 소리 내어 읽어 봐요. 두 문장이 똑같이 말하고 있는 것은 무엇인가요?' },
  { name: '따져 보기', question: '우리 모둠의 예상 문장이 맞다는 걸 보여 주는 우리 조사 내용이 있나요? 문경의 옛날과 지금, 다른 고장의 모습을 떠올려 봐요.' },
  { name: '결론 내리기', question: '예상 문장을 다듬어서, 어느 곳에 사는 누구에게나 맞는 한 문장으로 만들어 봐요. 어떤 말을 바꾸면 더 넓게 말할 수 있을까요?' },
];
const FINAL = '우리가 살고 있는 장소와 시간은 우리가 살아가는 방식을 변화시킨다.';

const STEP_GOAL = [
  '예상하기: 두 문장(공간, 시간)에서 같은 점을 찾게 해요. 둘 다 "사는 곳(환경)이나 때가 다르면 생활 모습이 달라진다"는 이야기라는 것을 아이들이 스스로 말하게 해요. 궁금한 점을 하나 묻게 하거나, "~은 ~과 같아요" 같은 비유로 말해 보게 해도 좋아요. 그다음 두 문장을 하나로 이어 보는 "우리 모둠 예상 문장"을 말해 보게 해요. 예상 문장은 "아마 이럴 거야" 하고 짐작해 보는 문장이고, 아직 맞는지 모르는 문장이에요.',
  '따져 보기: 모둠의 예상 문장이 맞는지 증거로 따지게 해요. (가) 우리가 조사한 실제 이야기(문경의 탄광 시절과 지금, 다른 고장의 생활 모습)에서 예상 문장을 뒷받침하는 증거를 하나 이상 말하게 해요. (나) 그다음 "예상과 다른 경우는 없을까요?", "사는 곳이나 때가 아닌 다른 까닭으로 생활이 바뀐 적은 없을까요?"처럼 아닐 수도 있는 경우를 생각하게 해요. (가)가 나오면 (나)를, (나)가 먼저 나오면 (가)를 물어요.',
  '결론 내리기: 예상 문장을 더 넓고 분명하게 다듬어 최종 결론 한 문장을 만들게 해요. 문경 사람만이 아니라 "우리 모두"에게 맞는 말인지, 사는 곳과 때가 둘 다 들어 있는지, 무엇이 바뀌는지가 분명한지 물어요. 결론을 뒷받침하는 증거 두 가지(하나는 사는 곳에 따른 것, 하나는 때에 따른 것)를 고르게 해요. 반박("그렇지 않은 경우도 있어요")에 어떻게 답할지도 물어볼 수 있어요.',
];
const STEP_BAN = [
  '아직 증거를 따지거나 최종 결론을 다듬는 이야기는 하지 마. 두 문장의 같은 점과 예상 문장만 다뤄.',
  '아직 최종 결론 문장을 다듬는 이야기는 하지 마. 증거와 아닐 수도 있는 경우만 물어.',
  '',
];
const PASS_RULE = [
  '모둠이 (1) 두 문장의 같은 점(사는 곳·환경이나 때에 따라 생활 모습이 달라진다는 점)을 자기 말로 말했고, (2) 두 문장을 하나로 이은 예상 문장을 말했다. 둘 중 하나만 했으면 false.',
  '모둠이 (가) 예상 문장을 뒷받침하는 실제 조사 내용(구체적인 지역이나 옛날·지금의 모습)을 하나 이상 말했고, (나) 예상과 다를 수 있는 경우나 다른 까닭을 하나 생각해 말했다. 둘 중 하나만 했으면 false.',
  '모둠이 사는 곳(장소·공간·환경)과 때(시간)를 둘 다 담고, 그 때문에 사람들의 생활이나 살아가는 방식이 바뀐다는 최종 결론 한 문장을 자기 말로 말했고, 그 결론을 뒷받침하는 증거를 두 가지 말했다.',
];
// 아이들이 스스로 만들어야 하는 최종 문장의 말입니다. 아이가 먼저 쓰기 전에 AI 답에 나오면 다시 쓰게 합니다.
const SECRET = ['장소와 시간', '살아가는 방식', '장소와 시간은'];
const SAFE_REPLY = [
  '좋은 생각이에요. 두 문장에서 똑같이 나오는 말을 하나 찾아볼래요? 그 말이 무엇을 뜻하는지도 이야기해 봐요.',
  '잘 따져 보고 있어요. 우리 조사에서 본 실제 모습 가운데 예상 문장과 꼭 맞는 장면 하나를 더 말해 볼래요?',
  '스스로 다듬으면 훨씬 멋진 문장이 될 거예요. 예상 문장에서 문경에만 맞는 말을 찾아, 누구에게나 맞는 말로 바꿔 볼래요?',
];
const DEFAULT_PASS_TEXT = '미션 성공이에요! 오른쪽 칸에 우리 모둠 생각을 정리해 남기고, 선생님이 다음 단계를 열어 줄 때까지 모둠끼리 한 번 더 이야기해 봐요.';
const LAST_PASS_TEXT = '미션 성공이에요! 오른쪽 칸에 최종 결론과 증거 두 개를 남기고, 우리 모둠 결론을 발표할 준비를 해요.';
const DEFAULT_PRAISE = '모둠이 함께 생각해서 까닭까지 잘 말해 주었어요.';

type Row = { group_id: number; key: string; value: Record<string, unknown> };

async function db(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      ...(SB_KEY.split('.').length === 3 ? { Authorization: `Bearer ${SB_KEY}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}
async function rowsOf(path: string): Promise<Row[]> {
  const r = await db(path);
  if (!r.ok) throw new Error('db ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return await r.json();
}
async function countOf(path: string): Promise<number> {
  const r = await db(path, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') ?? '*/0';
  return Number(cr.split('/')[1]) || 0;
}

function systemPrompt(step: number, stages: { name: string; question: string }[], subs: { space: string; time: string }, saved: string, notes: string) {
  return [
    '너는 초등학교 4학년 사회 수업의 "생각 짝꿍" 대화 친구야. 한 모둠이 태블릿 하나로 함께 의논해서 말을 걸어.',
    '아이들은 두 문장을 이어서 더 큰 한 문장(일반화)을 스스로 만들어 가는 중이야.',
    `공간 문장: "${subs.space}"`,
    `시간 문장: "${subs.time}"`,
    `아이들이 마지막에 스스로 닿기를 바라는 문장(너만 알고 있어, 절대 먼저 말하지 마): "${FINAL}"`,
    '이 문장이나 그와 거의 같은 문장을 너가 먼저 말하거나 정답처럼 알려 주면 안 돼. 질문과 짧은 되짚기로 아이들이 스스로 말하게 도와.',
    '',
    '말하는 규칙:',
    '- 4학년이 바로 알아듣는 쉬운 말로, 3문장 이내로 짧게 말해.',
    '- 모든 문장을 "~요"로 끝나는 존댓말로 써. 반말은 절대 쓰지 마.',
    '- "가설"이라는 말은 쓰지 말고 "예상", "예상 문장"이라고 말해. "일반화", "논증" 같은 어려운 말도 쓰지 마.',
    '- 아이들이 한 말에서 좋은 점을 먼저 한마디 짚어 주고, 질문은 한 번에 하나만 해.',
    '- 틀린 생각도 바로 틀렸다고 하지 말고 다시 생각해 볼 질문을 해. 다만 엉뚱한 대답을 "맞아요", "똑똑해요"라고 칭찬하지는 마.',
    '- 아이들 이름이나 개인 정보는 묻지 마. 수업과 상관없는 이야기, 장난, 위험한 이야기는 부드럽게 지금 단계 질문으로 돌아오게 해.',
    '- 이모지, 표, 목록 기호는 쓰지 마.',
    '',
    `지금은 ${step}단계 "${stages[step - 1].name}"야. 이 단계의 첫 질문: "${stages[step - 1].question}"`,
    `이 단계의 목표: ${STEP_GOAL[step - 1]}`,
    STEP_BAN[step - 1] ? `이 단계에서 지킬 것: ${STEP_BAN[step - 1]}` : '',
    saved ? `이 모둠이 지금까지 오른쪽 칸에 남긴 것: ${saved}` : '',
    notes ? `이 모둠이 앞 시간(취재 노트, 비교하기)에 쓴 카드: ${notes}\n증거를 물을 때는 이 카드의 내용을 예로 들어 구체적으로 물어봐.` : '',
    '',
    '답하는 형식: JSON 하나만 써. {"reply": "아이들에게 할 말", "pass": true 또는 false, "praise": "칭찬 한 문장"}',
    'praise 쓰는 법: 모둠이 이 단계에서 말한 생각을 한 문장으로 되짚으며 칭찬해. 질문이나 물음표는 넣지 마.',
    `pass 정하는 법: 이 단계에서 모둠이 지금까지 한 말(방금 한 말 포함)을 모두 보고, 기준을 채웠으면 true, 아니면 false. 기준: ${PASS_RULE[step - 1]} 장난, 한두 낱말뿐인 대답, 까닭이 없는 대답, 질문만 한 경우는 false.`,
    'pass가 true여도 reply에 "통과", "성공", "다음 단계" 같은 말은 쓰지 마.',
  ].filter(Boolean).join('\n');
}

const THINK: (string | null)[] = [...new Set([Deno.env.get('GEMINI_THINKING') ?? 'minimal', 'low'])].filter((x) => x !== '');
THINK.push(null);

async function askGemini(system: string, contents: unknown[]) {
  let lastErr = '';
  for (const model of MODELS) {
    for (const think of THINK) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 25000);
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
              responseSchema: { type: 'OBJECT', properties: { reply: { type: 'STRING' }, pass: { type: 'BOOLEAN' }, praise: { type: 'STRING' } }, required: ['reply', 'pass', 'praise'] },
              ...(think ? { thinkingConfig: { thinkingLevel: think } } : {}),
            },
          }),
        });
        if (r.status === 400) { lastErr = `${model}/${think} 400 ${(await r.text()).slice(0, 200)}`; continue; }
        if (r.status === 404) { lastErr = `${model} 404`; break; }
        if (r.status === 429) { lastErr = `${model} 429 ${(await r.text()).slice(0, 400)}`; break; }
        if (!r.ok) throw new Error(`${model} ${r.status} ${(await r.text()).slice(0, 200)}`);
        const data = await r.json();
        const text = (data?.candidates?.[0]?.content?.parts ?? [])
          .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
          .map((p: { text: string }) => p.text).join('').trim();
        if (!text) throw new Error(`${model} empty ${data?.candidates?.[0]?.finishReason ?? ''}`);
        let answer = text, pass = false, praise = '';
        try {
          const j = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
          if (j && typeof j.reply === 'string' && j.reply.trim()) {
            answer = j.reply.trim(); pass = j.pass === true; praise = typeof j.praise === 'string' ? j.praise.trim() : '';
          }
        } catch { /* 글 그대로 씀 */ }
        return { text: answer, pass, praise, model };
      } finally {
        clearTimeout(t);
      }
    }
  }
  throw new Error(lastErr || 'no model');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ ok: false, error: 'method' }, 405);
  if (!GEMINI_KEY) return reply({ ok: false, error: 'nokey' }, 500);
  SB_KEY = req.headers.get('apikey') || SB_KEY;

  let body: { cls?: unknown; g?: unknown; text?: unknown };
  try { body = await req.json(); } catch { return reply({ ok: false, error: 'bad' }, 400); }
  const cls = Number(body.cls), g = Number(body.g);
  const text = String(body.text ?? '').trim();
  if (!Number.isInteger(cls) || cls < 1 || cls > 50 || !Number.isInteger(g) || g < 1 || g > 20 || !text || text.length > MAX_Q) {
    return reply({ ok: false, error: 'bad' }, 400);
  }

  try {
    const now = Date.now();
    const minAgo = new Date(now - 60_000).toISOString();
    const dayAgo = new Date(now - 86_400_000).toISOString();
    const pre = `m:${cls}:${g}:`;
    const [cfgRows, noteCfgRows, nMin, nDay, nAll, pastRows, keepRows, noteRows] = await Promise.all([
      rowsOf(`entries?group_id=eq.${G_CFG}&key=eq.cfg&select=group_id,key,value`),
      rowsOf(`entries?group_id=eq.${G_NOTE_CFG}&key=eq.cfg&select=group_id,key,value`),
      countOf(`entries?group_id=eq.${G_DATA}&key=like.${encodeURIComponent(pre)}*&updated_at=gt.${minAgo}&select=key`),
      countOf(`entries?group_id=eq.${G_DATA}&key=like.${encodeURIComponent(pre)}*&updated_at=gt.${dayAgo}&select=key`),
      countOf(`entries?group_id=eq.${G_DATA}&key=like.m:*&updated_at=gt.${dayAgo}&select=key`),
      rowsOf(`entries?group_id=eq.${G_DATA}&key=like.${encodeURIComponent(pre)}*&select=group_id,key,value&order=updated_at.desc&limit=40`),
      rowsOf(`entries?group_id=eq.${G_DATA}&key=like.${encodeURIComponent(`k:${cls}:${g}:`)}*&select=group_id,key,value`),
      rowsOf(`entries?group_id=eq.${G_NOTE}&key=like.${encodeURIComponent(`c:${cls}:${g}:cmp:`)}*&select=group_id,key,value&limit=20`),
    ]);
    const cfg = (cfgRows[0]?.value ?? {}) as {
      classes?: { id: number; step?: number; chat?: boolean }[];
      subs?: { space?: string; time?: string };
      stages?: { name?: string; question?: string }[];
      passText?: string;
    };
    const k = (cfg.classes ?? []).find((c) => c.id === cls);
    if (!k || !k.chat) return reply({ ok: false, error: 'closed' }, 403);
    // 모둠 편성은 취재 노트 설정을 따릅니다(그 반에 그 모둠 아이가 있어야 함).
    const noteCfg = (noteCfgRows[0]?.value ?? {}) as { classes?: { id: number; students?: { g?: number }[] }[] };
    const nk = (noteCfg.classes ?? []).find((c) => c.id === cls);
    if (nk && nk.students?.length && !nk.students.some((s) => s.g === g)) return reply({ ok: false, error: 'roster' }, 403);

    const step = [1, 2, 3].includes(Number(k.step)) ? Number(k.step) : 1;
    const stages = DEFAULT_STAGES.map((d, i) => ({ name: cfg.stages?.[i]?.name || d.name, question: cfg.stages?.[i]?.question || d.question }));
    const subs = { space: cfg.subs?.space || DEFAULT_SUBS.space, time: cfg.subs?.time || DEFAULT_SUBS.time };

    if (nMin >= PER_MIN) return reply({ ok: false, error: 'rate' }, 429);
    if (nDay >= PER_DAY_GROUP || nAll >= PER_DAY_ALL) return reply({ ok: false, error: 'limit' }, 429);

    const past = pastRows.map((r) => r.value as { q: string; a?: string; step?: number; pass?: boolean })
      .filter((v) => v.a).slice(0, HISTORY).reverse();
    const contents: unknown[] = [];
    let lastStep = 0;
    for (const v of past) {
      const s = v.step ?? 1;
      contents.push({ role: 'user', parts: [{ text: `${s !== lastStep ? `(${s}단계) ` : ''}모둠: ${v.q}` }] });
      contents.push({ role: 'model', parts: [{ text: v.a }] });
      lastStep = s;
    }
    contents.push({ role: 'user', parts: [{ text: `${step !== lastStep ? `(${step}단계) ` : ''}모둠: ${text}` }] });

    const saved = keepRows.map((r) => {
      const v = r.value as { f?: Record<string, string> };
      return Object.values(v.f ?? {}).filter(Boolean).join(' / ');
    }).filter(Boolean).join(' | ').slice(0, 600);
    const notes = noteRows.map((r) => String((r.value as { t?: string }).t ?? '')).filter(Boolean).join(' / ').slice(0, 800);

    const key = pre + now.toString(36) + Math.random().toString(36).slice(2, 6);
    const base = { cls, g, step, q: text, at: now };
    let value: Record<string, unknown>;
    try {
      const system = systemPrompt(step, stages, subs, saved, notes);
      const kidsSaid = past.map((v) => v.q).join(' ') + ' ' + text;
      const leaked = (a: string) => SECRET.filter((w) => a.replace(/\s/g, '').includes(w.replace(/\s/g, '')) && !kidsSaid.replace(/\s/g, '').includes(w.replace(/\s/g, '')));
      let out = await askGemini(system, contents);
      let guard = '';
      if (leaked(out.text).length) {
        guard = 'retry';
        const again = await askGemini(system, [...contents, { role: 'model', parts: [{ text: out.text }] },
          { role: 'user', parts: [{ text: '(선생님) 방금 답에 아이들이 스스로 만들어야 할 문장의 말이 먼저 나왔어요. 그 말을 쓰지 말고 질문 하나로 다시 써 주세요.' }] }]);
        if (leaked(again.text).length) { guard = 'safe'; out = { ...again, text: SAFE_REPLY[step - 1] }; } else out = again;
      }
      const pass = out.pass || past.some((v) => (v.step ?? 1) === step && v.pass === true);
      if (pass) {
        let praise = out.praise.split(/(?<=[.!?。])\s+/).filter((x) => x && !x.includes('?')).join(' ').trim();
        if (!praise || praise.length > 120 || leaked(praise).length) praise = DEFAULT_PRAISE;
        out = { ...out, text: `${praise} ${step === 3 ? LAST_PASS_TEXT : (cfg.passText || DEFAULT_PASS_TEXT)}` };
      }
      value = { ...base, a: out.text, pass, model: out.model, ...(guard ? { guard } : {}) };
    } catch (e) {
      if (String(e).includes(' 429')) return reply({ ok: false, error: 'busy' }, 503);
      await db('entries', { method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{ group_id: G_DATA, key, value: { ...base, a: null, err: String(e).slice(0, 600) }, updated_at: new Date().toISOString() }]) });
      return reply({ ok: false, error: 'ai', detail: String(e).slice(0, 300) }, 502);
    }
    const w = await db('entries', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{ group_id: G_DATA, key, value, updated_at: new Date().toISOString() }]) });
    if (!w.ok) return reply({ ok: false, error: 'save' }, 500);
    return reply({ ok: true, key, value });
  } catch (e) {
    console.error(e);
    return reply({ ok: false, error: 'server', detail: String(e).slice(0, 300) }, 500);
  }
});
