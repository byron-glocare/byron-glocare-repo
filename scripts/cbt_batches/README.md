# CBT Batch Workflow (Claude Max 채팅용)

## 흐름
1. 각 batch_NNN.txt 파일을 메모장/VSCode 로 연다
2. 전체 선택 (Ctrl+A) → 복사 → Claude.ai (Max) 채팅창에 붙여넣기 → 전송
3. Claude 가 JSON array 로 응답
4. 응답 JSON 만 복사해서 batch_NNN_response.json 으로 저장
5. 모든 batch 완료 후 cbt_batch_to_sql.py 로 SQL 변환

## 진행 상황
- 총 1688 문제, 57 배치
- 배치당 약 30 문제

## 다음 단계
모든 batch_NNN_response.json 저장 완료 후:
```
python scripts/cbt_batch_to_sql.py scripts/cbt_batches --out supabase/migrations/0013_cbt_ai_all.sql
```
