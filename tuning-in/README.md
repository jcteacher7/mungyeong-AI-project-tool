# 공간과 시간으로 읽는 우리 지역: Tuning in

4학년 사회 관심이끌기 모둠 활동 웹앱. 학생 로그인 없이 링크만으로 들어와서, 같은 모둠끼리 하나의 기록을 실시간으로 함께 씁니다.

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

## 수업 중 관리

화면 아래 **선생님 설정**에서:

- **짝을 미리 지어서 주기** — 1단계를 건너뛰고 정해 둔 6쌍으로 시작합니다.
- **모든 모둠 기록 지우기** — 다음 반 수업 전에 초기화합니다.

서버에 연결되지 않으면 앱은 멈추지 않고 그 기기에만 저장하는 모드로 돌아갑니다. 화면 오른쪽 위 점이 초록색이면 공유 중, 회색이면 이 기기에만 저장입니다.

## 사진 바꾸기

지금 사진은 코드로 그린 예시 그림입니다. 실제 사진으로 바꾸려면 `index.html` 안의 `PHOTOS` 배열에서 각 항목에 `src`를 넣으면 됩니다.

```js
{id:'s1a', set:'S1', scene:'terraces', alt:'산비탈에 층층이 만든 밭', src:'photos/s1a.jpg'},
```

`set`이 같은 두 장이 한 짝입니다. S1~S3은 장소가 다른 짝, T1~T3은 시간이 다른 짝이고, `old:true`가 붙은 사진은 옛날 사진처럼 색이 바랩니다.
