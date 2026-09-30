-- 문자로 보내는 파일 다운로드 단축 링크 (정산서 PDF 등).
--   https://go.glocare.co.kr/d/<code>  →  만료·취소 확인 후 비공개 버킷의 60초 서명 URL 로 리다이렉트.
--
--   - code: 10자 무작위(base62, ~59bit) — 추측 불가. 유일키.
--   - 파일은 비공개 버킷 share-files 에만 저장 (공개 URL 없음).
--   - 테이블/버킷 모두 정책 없음 = anon/authenticated 접근 불가, service_role(서버)만 사용.

create table if not exists public.file_share_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null default 'settlement',
  storage_path text not null,
  file_name text not null,
  training_center_id uuid references public.training_centers(id) on delete set null,
  settlement_month date,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  download_count integer not null default 0,
  last_downloaded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists file_share_links_center_idx
  on public.file_share_links (training_center_id, settlement_month);

alter table public.file_share_links enable row level security;
-- 정책을 만들지 않는다 → service_role 외 전부 차단.

comment on table public.file_share_links is
  '문자 발송용 파일 다운로드 단축 링크(/d/<code>). 만료·취소·열람횟수. service_role 전용.';

-- 비공개 버킷 (5MB 제한, PDF 만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-files', 'share-files', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
