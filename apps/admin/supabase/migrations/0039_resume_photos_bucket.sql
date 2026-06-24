-- 0039: 이력서 사진 — Supabase Storage bucket
-- private bucket. 학생 공개 폼은 service_role 로 업로드, 관리자는 signed URL 로 조회.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resume-photos',
  'resume-photos',
  false,
  5 * 1024 * 1024,            -- 5MB 제한
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS: bucket 자체는 private, server (service_role) 만 접근. 학생/관리자 모두 server 경유.
-- 별도 policy 불필요 (service_role 은 모든 policy 우회).
