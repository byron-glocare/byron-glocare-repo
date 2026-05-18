-- =============================================================================
-- 0016: 교육생 '챙길 일정' (customer_reminders)
--
-- 기존 customers.is_waiting / recontact_date / waiting_memo 는 "대기중" 단계
-- 진입용 — 한 명당 단일. 이 테이블은 별도로, 특정 시점에 챙겨야 할 항목을
-- 여러 건 등록 가능. remind_date 가 지나면 대시보드 [연락 필요] 카드에 포함.
--
-- AI 상담 분석 (analyze-consultation) 의 suggestion 도 이 테이블로 흘러갈 수
-- 있게 설계.
-- =============================================================================

begin;

create table public.customer_reminders (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  remind_date date not null,
  content     text not null check (length(trim(content)) > 0),
  /** true = 처리 완료. 대시보드 [연락 필요] 에서 제외. */
  completed   boolean not null default false,
  /** 생성자 — 누가 등록했는지 (현재는 표시만, 향후 권한 분리에 활용 가능) */
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

comment on table public.customer_reminders is
  '교육생별 챙길 일정 / 후속 알림. remind_date 도래 시 대시보드 [연락 필요] 에 포함.';

create index idx_customer_reminders_customer
  on public.customer_reminders(customer_id);

create index idx_customer_reminders_remind_date
  on public.customer_reminders(remind_date)
  where completed = false;

create trigger trg_customer_reminders_updated_at
  before update on public.customer_reminders
  for each row execute function public.set_updated_at();

-- RLS — 다른 테이블과 동일 패턴 (authenticated 전체 CRUD)
alter table public.customer_reminders enable row level security;

create policy "authenticated_full_access"
  on public.customer_reminders
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

commit;
