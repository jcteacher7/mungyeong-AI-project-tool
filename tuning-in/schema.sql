-- Supabase SQL Editor에 붙여넣고 Run 하세요. (기존 projects 테이블과 별개입니다)
-- 로그인 없이 링크만으로 쓰는 수업용 앱이라, 링크를 아는 사람은 읽고 쓸 수 있는 모델입니다.

create table if not exists entries (
  group_id   int  not null,
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (group_id, key)
);

alter table entries enable row level security;

drop policy if exists "Anyone can read entries" on entries;
create policy "Anyone can read entries" on entries for select using (true);

drop policy if exists "Anyone can add entries" on entries;
create policy "Anyone can add entries" on entries for insert with check (true);

drop policy if exists "Anyone can edit entries" on entries;
create policy "Anyone can edit entries" on entries for update using (true) with check (true);

drop policy if exists "Anyone can clear entries" on entries;
create policy "Anyone can clear entries" on entries for delete using (true);
