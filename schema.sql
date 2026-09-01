-- Supabase SQL Editor에서 이 파일 전체를 붙여넣고 "Run" 하세요.
-- 로그인 기능이 없는 도구이므로, 프로젝트 링크(uuid)를 아는 사람은
-- 누구나 읽고 쓸 수 있는 "링크 공유형" 모델입니다 (Padlet과 비슷).

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default '제목 없는 프로젝트',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 수정될 때마다 updated_at을 자동으로 갱신
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
before update on projects
for each row execute function set_updated_at();

-- Row Level Security 활성화 + 익명(anon) 사용자에게 select/insert/update만 허용.
-- delete 정책은 만들지 않아서, API를 통한 삭제는 막혀 있습니다.
alter table projects enable row level security;

drop policy if exists "Anyone can read a project" on projects;
create policy "Anyone can read a project"
  on projects for select
  using (true);

drop policy if exists "Anyone can create a project" on projects;
create policy "Anyone can create a project"
  on projects for insert
  with check (true);

drop policy if exists "Anyone can update a project" on projects;
create policy "Anyone can update a project"
  on projects for update
  using (true)
  with check (true);

-- "Automatically expose new tables"를 꺼둔 프로젝트에서는 RLS 정책만으로 부족하고
-- anon/authenticated 역할에 테이블 단위 권한을 직접 부여해야 API 접근이 열립니다.
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.projects to anon, authenticated;
