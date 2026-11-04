-- 언어생활 자가진단 — Supabase SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.
-- 기존 projects, entries 표는 건드리지 않습니다. 여러 번 실행해도 안전합니다.
--
-- 아이의 실명과 답이 함께 저장되므로, 표를 공개하지 않습니다.
--   아이들: 명단 보기, 답 넣기, 다짐 넣기만 할 수 있습니다.
--   선생님: 암호를 맞혀야 답을 읽고 고치고 지울 수 있습니다.
-- 암호 정하기는 이 파일 맨 아래 안내를 따로 실행합니다.

create extension if not exists pgcrypto with schema extensions;

create table if not exists lc_classes (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists lc_students (
  id       uuid primary key default gen_random_uuid(),
  class_id bigint not null references lc_classes(id) on delete cascade,
  name     text not null,
  seat     int  not null default 0,
  active   boolean not null default true,
  unique (class_id, name)
);

create table if not exists lc_responses (
  student_id   uuid primary key references lc_students(id) on delete cascade,
  answers      jsonb not null,
  score1       int not null,
  score2       int not null,
  score3       int not null,
  reflection   text,
  answered_at  timestamptz not null default now(),
  reflected_at timestamptz
);

create table if not exists lc_settings (
  id          int primary key default 1 check (id = 1),
  intro       text,
  placeholder text
);
insert into lc_settings (id) values (1) on conflict (id) do nothing;

create table if not exists lc_admin (
  id            int primary key default 1 check (id = 1),
  password_hash text,
  failed        int not null default 0,
  locked_until  timestamptz
);
insert into lc_admin (id) values (1) on conflict (id) do nothing;

-- 표를 직접 읽고 쓰는 길을 모두 닫습니다. 정책을 만들지 않으므로 RLS가 전부 막습니다.
alter table lc_classes   enable row level security;
alter table lc_students  enable row level security;
alter table lc_responses enable row level security;
alter table lc_settings  enable row level security;
alter table lc_admin     enable row level security;
revoke all on lc_classes, lc_students, lc_responses, lc_settings, lc_admin from public, anon, authenticated;


-- ── 내부 함수: 암호 확인 ─────────────────────────────────
-- 'ok' | 'bad' | 'locked' | 'unset'. 10번 틀리면 10분 동안 잠급니다.
create or replace function lc_pw_check(p_pw text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a lc_admin%rowtype;
begin
  select * into a from lc_admin where id = 1 for update;
  if a.password_hash is null then return 'unset'; end if;
  if a.locked_until is not null and a.locked_until > now() then return 'locked'; end if;
  if extensions.crypt(coalesce(p_pw, ''), a.password_hash) = a.password_hash then
    update lc_admin set failed = 0, locked_until = null where id = 1;
    return 'ok';
  end if;
  if a.failed + 1 >= 10 then
    update lc_admin set failed = 0, locked_until = now() + interval '10 minutes' where id = 1;
  else
    update lc_admin set failed = a.failed + 1 where id = 1;
  end if;
  return 'bad';
end $$;

-- 암호 정하기: SQL Editor에서만 실행할 수 있습니다.
create or replace function lc_set_password(p_new text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_new, '')) < 8 then raise exception '암호는 8자 이상으로 정해 주세요.'; end if;
  update lc_admin
     set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf')), failed = 0, locked_until = null
   where id = 1;
  return '암호를 정했습니다.';
end $$;


-- ── 아이들이 쓰는 함수 ───────────────────────────────────
create or replace function lc_public_start() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ok', true,
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name) from lc_classes c), '[]'::jsonb),
    'intro', (select intro from lc_settings where id = 1),
    'placeholder', (select placeholder from lc_settings where id = 1)
  )
$$;

create or replace function lc_class_roster(p_class_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'students', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name,
      'answered', exists (select 1 from lc_responses r where r.student_id = s.id)
    ) order by s.seat, s.name)
    from lc_students s where s.class_id = p_class_id and s.active
  ), '[]'::jsonb))
$$;

-- 점수는 서버에서 다시 계산합니다. 다시 하면 마지막 답만 남고 이전 다짐은 비웁니다.
create or replace function lc_submit(p_student_id uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v int; i int := 0;
  s1 int := 0; s2 int := 0; s3 int := 0;
begin
  if not exists (select 1 from lc_students where id = p_student_id) then
    return jsonb_build_object('ok', false, 'error', 'no_student');
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 19 then
    return jsonb_build_object('ok', false, 'error', 'bad_answers');
  end if;
  for i in 0..18 loop
    if jsonb_typeof(p_answers -> i) <> 'number' then
      return jsonb_build_object('ok', false, 'error', 'bad_answers');
    end if;
    v := (p_answers ->> i)::numeric;
    if v < 1 or v > 5 or (p_answers ->> i)::numeric <> v then
      return jsonb_build_object('ok', false, 'error', 'bad_answers');
    end if;
    if i < 5 then s1 := s1 + v; elsif i < 15 then s2 := s2 + v; else s3 := s3 + v; end if;
  end loop;
  insert into lc_responses (student_id, answers, score1, score2, score3, reflection, answered_at, reflected_at)
  values (p_student_id, p_answers, s1, s2, s3, null, now(), null)
  on conflict (student_id) do update
    set answers = excluded.answers, score1 = s1, score2 = s2, score3 = s3,
        reflection = null, answered_at = now(), reflected_at = null;
  return jsonb_build_object('ok', true, 'scores', jsonb_build_array(s1, s2, s3));
end $$;

create or replace function lc_save_reflection(p_student_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if length(btrim(coalesce(p_text, ''))) = 0 or length(p_text) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'bad_text');
  end if;
  update lc_responses set reflection = p_text, reflected_at = now() where student_id = p_student_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_response'); end if;
  return jsonb_build_object('ok', true);
end $$;


-- ── 선생님이 쓰는 함수: 모두 암호를 먼저 확인합니다 ──────
create or replace function lc_t_login(p_pw text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function lc_t_data(p_pw text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  return jsonb_build_object(
    'ok', true,
    'intro', (select intro from lc_settings where id = 1),
    'placeholder', (select placeholder from lc_settings where id = 1),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name) from lc_classes c), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'class_id', s.class_id, 'name', s.name, 'seat', s.seat, 'active', s.active,
        'response', case when r.student_id is null then null else jsonb_build_object(
          'answers', r.answers, 'scores', jsonb_build_array(r.score1, r.score2, r.score3),
          'reflection', r.reflection, 'answered_at', r.answered_at, 'reflected_at', r.reflected_at
        ) end
      ) order by s.seat, s.name)
      from lc_students s left join lc_responses r on r.student_id = s.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function lc_t_add_class(p_pw text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw); v_id bigint; v_name text := btrim(coalesce(p_name, ''));
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  if exists (select 1 from lc_classes where name = v_name) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  insert into lc_classes (name) values (v_name) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- 명단에서 빠진 아이는 숨기기만 하고 기록은 남겨 둡니다.
create or replace function lc_t_set_roster(p_pw text, p_class_id bigint, p_names text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw); v_names text[]; i int;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  select coalesce(array_agg(btrim(n) order by o), '{}') into v_names
    from unnest(p_names) with ordinality as t(n, o) where btrim(n) <> '';
  if (select count(distinct n) from unnest(v_names) n) <> coalesce(array_length(v_names, 1), 0) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  update lc_students set active = false where class_id = p_class_id and not (name = any(v_names));
  if array_length(v_names, 1) is not null then
    for i in 1..array_length(v_names, 1) loop
      insert into lc_students (class_id, name, seat, active) values (p_class_id, v_names[i], i, true)
      on conflict (class_id, name) do update set seat = i, active = true;
    end loop;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function lc_t_save_settings(p_pw text, p_intro text, p_placeholder text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  update lc_settings set intro = nullif(btrim(p_intro), ''), placeholder = nullif(btrim(p_placeholder), '') where id = 1;
  return jsonb_build_object('ok', true);
end $$;

create or replace function lc_t_clear_class(p_pw text, p_class_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw); v_count int;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  delete from lc_responses r using lc_students s where r.student_id = s.id and s.class_id = p_class_id;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_count);
end $$;

-- 명단에서 빠진 아이 한 명을 기록째 지웁니다. 명단에 있는 아이는 지우지 않습니다.
create or replace function lc_t_remove_student(p_pw text, p_student_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  delete from lc_students where id = p_student_id and not active;
  return jsonb_build_object('ok', true);
end $$;

create or replace function lc_t_delete_class(p_pw text, p_class_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := lc_pw_check(p_pw);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  delete from lc_classes where id = p_class_id;
  return jsonb_build_object('ok', true);
end $$;


-- ── 함수 실행 권한 ───────────────────────────────────────
revoke all on function lc_pw_check(text)                     from public, anon, authenticated;
revoke all on function lc_set_password(text)                 from public, anon, authenticated;
revoke all on function lc_public_start()                     from public, anon, authenticated;
revoke all on function lc_class_roster(bigint)               from public, anon, authenticated;
revoke all on function lc_submit(uuid, jsonb)                from public, anon, authenticated;
revoke all on function lc_save_reflection(uuid, text)        from public, anon, authenticated;
revoke all on function lc_t_login(text)                      from public, anon, authenticated;
revoke all on function lc_t_data(text)                       from public, anon, authenticated;
revoke all on function lc_t_add_class(text, text)            from public, anon, authenticated;
revoke all on function lc_t_set_roster(text, bigint, text[]) from public, anon, authenticated;
revoke all on function lc_t_save_settings(text, text, text)  from public, anon, authenticated;
revoke all on function lc_t_clear_class(text, bigint)        from public, anon, authenticated;
revoke all on function lc_t_remove_student(text, uuid)       from public, anon, authenticated;
revoke all on function lc_t_delete_class(text, bigint)       from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function lc_public_start()                     to anon, authenticated;
grant execute on function lc_class_roster(bigint)               to anon, authenticated;
grant execute on function lc_submit(uuid, jsonb)                to anon, authenticated;
grant execute on function lc_save_reflection(uuid, text)        to anon, authenticated;
grant execute on function lc_t_login(text)                      to anon, authenticated;
grant execute on function lc_t_data(text)                       to anon, authenticated;
grant execute on function lc_t_add_class(text, text)            to anon, authenticated;
grant execute on function lc_t_set_roster(text, bigint, text[]) to anon, authenticated;
grant execute on function lc_t_save_settings(text, text, text)  to anon, authenticated;
grant execute on function lc_t_clear_class(text, bigint)        to anon, authenticated;
grant execute on function lc_t_remove_student(text, uuid)       to anon, authenticated;
grant execute on function lc_t_delete_class(text, bigint)       to anon, authenticated;


-- ── 암호 정하기 ──────────────────────────────────────────
-- 위 내용을 실행한 뒤, 새 쿼리(New query)에 아래 한 줄만 붙여넣고
-- 따옴표 안을 선생님의 암호(8자 이상)로 바꿔서 Run 하세요.
--
--   select lc_set_password('여기에-암호를-적으세요');
