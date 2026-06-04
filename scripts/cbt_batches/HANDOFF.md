# CBT Batch 처리 — Claude Code 새 세션 인계 문서

이 문서를 새 Claude Code 채팅에 **그대로 붙여넣으면** 자동으로 진행돼.

---

## 작업 목적

요양보호사 CBT 1,688 문제의 해설을 AI 로 깔끔하게 재정리.

- **입력**: `scripts/cbt_batches/batch_001.txt` ~ `batch_057.txt` (57 개, 각 ~30 문제 프롬프트)
- **출력**: `scripts/cbt_batches/batch_NNN_response.json` (각 batch 마다 JSON array)
- **최종**: `python scripts/cbt_batch_to_sql.py scripts/cbt_batches --out supabase/migrations/0013_cbt_ai_all.sql`

---

## 처리 규칙 (중요)

### ❗ 반드시 sub-agent 로 처리

**컨텍스트 드리프트 방지를 위해 반드시 `Agent` 도구 (sub-agent) 사용**.
한 채팅에서 직접 57 batch 처리하면 도중에 출력 품질이 떨어짐.

각 batch 마다:
1. `Agent` 도구 호출 (subagent_type 은 `general-purpose` 또는 default)
2. agent 에게 파일 경로만 알려주고 → JSON array 만 만들어 파일로 저장하라고 지시
3. agent 가 짧게 "완료 / 실패" 만 보고

### 병렬 처리

성능 위해 **5-10 개 sub-agent 를 동시에 띄워서 batch 5-10 개 동시 처리**.
완료되면 다음 묶음 띄우기. 끝까지 반복.

### 재개 (idempotent)

이미 `batch_NNN_response.json` 이 있는 batch 는 skip — 중간에 끊겨도 다시 시작 가능.

---

## Sub-agent 별 지시 템플릿

각 sub-agent 호출할 때 이 형식으로 프롬프트 작성:

```
Process CBT batch {NNN}.

1. Read the file: scripts/cbt_batches/batch_{NNN:03d}.txt
   This contains the system prompt + ~30 questions to process.
2. Generate the JSON array response according to the format specified
   inside the file. The output must be a valid JSON array of objects,
   each with: id, intent_ko, intent_vi, choice_explanations (with ko/vi
   sub-objects), key_terms (with term_ko + def_vi).
3. CRITICAL rules from the file:
   - Mark the correct answer's explanation with ★ (both ko and vi)
   - Skip meaningless choices (key omitted entirely on both ko and vi)
   - key_terms only TOPIK 3-4 difficult medical/professional terms
   - Korean and Vietnamese must be in separate ko/vi blocks
4. Write the JSON array (and ONLY the JSON, no markdown fences) to:
   scripts/cbt_batches/batch_{NNN:03d}_response.json
5. Verify the file is valid JSON and contains all question IDs from the input.
6. Reply with just "DONE: {NNN} ({count} questions)" or "FAILED: {NNN} {reason}".

Use Sonnet 4.5 quality. Do not abbreviate or skip questions.
```

---

## 실행 흐름 (새 세션이 따라야 할)

```
1. ls scripts/cbt_batches/batch_*.txt → 57 개 확인
2. ls scripts/cbt_batches/batch_*_response.json → 이미 처리된 거 확인
3. 미처리 batch 들에 대해:
   - 5-10 개씩 묶어서 Agent 도구 병렬 호출
   - 각 Agent 가 위 템플릿 따라 작업
4. 모든 batch 완료 후:
   - python scripts/cbt_batch_to_sql.py scripts/cbt_batches \
       --out supabase/migrations/0013_cbt_ai_all.sql
   - 사용자에게 보고: "1,688 row UPDATE SQL 생성 완료"
5. 사용자가 SQL 파일을 split 해서 Supabase 에 적용해야 함을 안내
```

---

## 진행 상황 보고

처리 중간 중간 상태 짧게 보고 (예: `Processed batches 1-10 / 57. Remaining: 47`).

전체 진행 상황은 다음 명령으로 추적:
```bash
ls scripts/cbt_batches/batch_*_response.json | wc -l
```

---

## 새 채팅 시작 시 첫 명령

```
이 문서 (scripts/cbt_batches/HANDOFF.md) 를 따라 CBT batch 처리 진행해줘.
sub-agent 병렬로 띄워서 가능한 빨리 끝내고, 진행 상황 짧게 보고.
완료되면 SQL 파일 위치만 알려주면 돼.
```
