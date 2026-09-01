// ⚠️ Supabase 프로젝트를 만든 뒤, Project Settings > API 에서 확인한
// Project URL 과 anon(public) key 를 아래 두 줄에 붙여넣으세요.
// anon key는 브라우저 코드에 그대로 노출되어도 되는 "공개용" 키입니다
// (실제 접근 제어는 Supabase의 Row Level Security 정책으로 합니다. schema.sql 참고).
const SUPABASE_URL = "https://wigxlmwysuqxiuonucqq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kaxYJaj4pRlXP7fsCzsS5Q_Azzaf5Fb";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isSupabaseConfigured() {
  return !SUPABASE_URL.includes("YOUR-PROJECT-REF") && !SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY");
}

async function dbCreateProject(title, data) {
  const { data: row, error } = await supabaseClient
    .from("projects")
    .insert({ title, data })
    .select()
    .single();
  if (error) throw error;
  return row;
}

async function dbGetProject(id) {
  const { data: row, error } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return row;
}

async function dbUpdateProject(id, title, data) {
  const { error } = await supabaseClient.from("projects").update({ title, data }).eq("id", id);
  if (error) throw error;
}
