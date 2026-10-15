# 생각 잇기 (일반화 탐구 챗봇)

4학년 문경 단원 일반화하기 40분. 모둠(태블릿 한 대)이 AI 챗봇 "생각 짝꿍"과 함께
**예상하기 → 따져 보기 → 결론 내리기**를 지나, 두 하위 일반화(공간·시간)를 이어 최종 결론 한 문장과 증거 두 개를 남깁니다.

- 학생용: https://jcteacher7.github.io/mungyeong-AI-project-tool/generalize/?start=1
- 선생님용: https://jcteacher7.github.io/mungyeong-AI-project-tool/generalize/?t=1 (암호 1234, 설정에서 바꿈)
- 학생 화면에서 제목 **생각 잇기**를 1초쯤 누르고 있어도 선생님 화면이 열립니다.

## 저장
취재 노트와 같은 Supabase `entries` 표. 새 SQL 없음.
- 921 / `cfg` 이 앱 설정(반별 단계·챗봇 켜짐·문장 틀·발표 열림, 문구)
- 920 / `k:<반>:<모둠>:<단계>` 모둠이 남긴 칸
- 920 / `m:<반>:<모둠>:<번호>` 챗봇 대화(중계 함수가 저장)
- 911 / `cfg` 취재 노트 설정에서 반 이름과 모둠 편성을 읽기만 합니다.

## 챗봇 중계 함수 만들기 (선생님이 한 번)
코드: `supabase/functions/gen-chat/index.ts`. 제미나이 키는 자원 지도 때 넣은 `GEMINI_API_KEY`를 같이 씁니다.
1. https://supabase.com/dashboard/project/wigxlmwysuqxiuonucqq → 왼쪽 **Edge Functions**
2. **Deploy a new function** → **Via Editor**
3. 함수 이름 `gen-chat` (꼭 이 이름)
4. 편집 칸 내용을 모두 지우고 `index.ts` 전체를 붙여넣기 → **Deploy function**
5. 함수 화면 **Details**(또는 Settings) → **Verify JWT with legacy secret** 끄고 저장
함수가 없거나 고장 나도 남길 칸은 그대로 쓸 수 있고, 챗봇만 "지금은 AI를 쓸 수 없어요"가 나옵니다.

## 수업 뒤
선생님 화면 → **지우기** → 반 기록 지우기(이 앱 기록만 지움).

## 전시용 보기 모드
- 선생님 화면 위쪽 **보기 모드** → 그 태블릿에서만 켜집니다.
- 손님은 반·모둠을 골라 AI와 나눈 대화, 단계별 칸, 모둠 결론을 둘러볼 수 있어요. 글쓰기·남기기·AI에게 보내기는 막혀요(서버 쓰기도 막힘, AI 한도도 쓰지 않음).
- 새로 고침해도 유지. 끄려면 맨 위 검은 띠를 2초 꾹 누르고 암호를 넣으세요.
