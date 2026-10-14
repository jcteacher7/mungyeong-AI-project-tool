# 공간과 시간으로 읽는 우리 지역: Tuning in

4학년 사회 관심이끌기 모둠 활동 웹앱. 다른 앱(취재 노트·생각 잇기)처럼 **반 고르기 → 내 이름 누르기**로 들어오고, 같은 모둠끼리 하나의 기록을 실시간으로 함께 씁니다. 반·이름·모둠은 취재 노트(911) 명단을 그대로 읽습니다.

## 활동 흐름

1. **짝 짓기** — 사진 12장 중 관련 있다고 생각하는 두 장씩 짝을 짓습니다(6쌍).
2. **이유 쓰기** — 짝마다 "두 사진은 왜 다를까요?"를 적습니다. 칸은 사람마다 따로라 서로 지워지지 않고, 친구가 쓴 줄은 이름과 함께 아래에 보입니다.
3. **무리 나누기** — 비슷한 이유끼리 두 무리로 나누고, 무리 이름을 직접 붙입니다.
4. **발표하기** — 네 모둠의 결과를 한 화면에서 봅니다. 교실 TV에 띄워 두면 모둠이 끝낼 때마다 채워집니다.

화면 이동은 기기마다 따로입니다. 기록만 모둠끼리 공유됩니다.

## 설치

### 1. Supabase 테이블 만들기

Supabase 프로젝트 → SQL Editor에 아래를 붙여넣고 실행합니다.

```sql
create table if not exists entries (
  group_id   int  not null,
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (group_id, key)
);

alter table entries enable row level security;

-- 수업용: 링크를 아는 사람은 누구나 읽고 쓸 수 있게 함
drop policy if exists "classroom access" on entries;
create policy "classroom access" on entries
  for all to anon using (true) with check (true);
```

### 2. config.js 채우기

Supabase → Project Settings → API 에서 두 값을 복사해 넣습니다.

```js
window.TUNING_IN = {
  url: "https://xxxxxxxx.supabase.co",
  key: "eyJhbGciOi..."        // anon public 키
};
```

anon 키는 브라우저에 공개되는 키라서 이 파일에 넣어도 됩니다. 다만 위 정책은 링크를 아는 사람이면 누구나 쓸 수 있게 열어 둔 것이니, 수업이 끝나면 정책을 지우거나 테이블을 비워 두는 편이 좋습니다.

### 3. GitHub Pages 켜기

저장소 → Settings → Pages → Source를 `main` 브랜치로 지정합니다. 잠시 뒤 `https://<계정>.github.io/<저장소>/` 로 열립니다.

## 수업 중 관리 (선생님 화면)

다른 앱과 같이 **맨 위 제목을 1초쯤 꾹 누르면** 암호 화면이 나옵니다(취재 노트 암호, 기본 1234).

- **수업 기록** — 반마다 어느 기록으로 들어갈지 고릅니다(`0 / __classmap`). 새 기록을 만들어 바로 그 반에 쓸 수도 있어요.
- **짝을 미리 지어서 주기 / 이 반 기록 지우기 / 되돌리기** — 지우기 전 기록은 보관되어 되돌릴 수 있습니다.
- **발표 화면 열기** — 네 모둠 결과를 한 화면에서 봅니다.
- **보기 모드** — 아래 '전시용 보기 모드' 참고.

서버에 연결되지 않으면 앱은 멈추지 않고 그 기기에만 저장하는 모드로 돌아갑니다. 화면 오른쪽 위 점이 초록색이면 공유 중, 회색이면 이 기기에만 저장입니다.

## 사진 바꾸기

지금 사진은 코드로 그린 예시 그림입니다. 실제 사진으로 바꾸려면 `index.html` 안의 `PHOTOS` 배열에서 각 항목에 `src`를 넣으면 됩니다.

```js
{id:'s1a', set:'S1', scene:'terraces', alt:'산비탈에 층층이 만든 밭', src:'photos/s1a.jpg'},
```

`set`이 같은 두 장이 한 짝입니다. S1~S3은 장소가 다른 짝, T1~T3은 시간이 다른 짝이고, `old:true`가 붙은 사진은 옛날 사진처럼 색이 바랩니다.

## 전시용 보기 모드
- 선생님 화면 → "이 태블릿을 보기 모드로". **그 기기에서만** 켜지고 다른 기기는 그대로입니다.
- 켜지면 탭 넘기기·반/이름 고르기·크게 보기만 되고, 짝·이유·무리 이름은 고칠 수 없어요(서버에 쓰기도 막힘).
- 새로 고침해도 유지됩니다. 끄려면 맨 위 검은 '보기 모드' 띠를 2초 꾹 누르고 PIN(1234)을 넣으세요.
