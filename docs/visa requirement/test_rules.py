#!/usr/bin/env python3
"""index.html 의 JS 엔진과 동일한 매칭 규칙을 파이썬으로 재현해 회귀 검증한다."""
import json, pathlib, sys

D = json.loads(pathlib.Path(__file__).with_name("rules.json").read_text(encoding="utf-8"))

def cond(c, ctx):
    return all(ctx.get(k) in vals for k, vals in c.items())

def derive(inp):
    ctx = dict(inp)
    for key, spec in (D.get("derivedAxes") or {}).items():
        val = spec["default"]
        for c in spec["cases"]:
            if cond(c["if"], ctx):
                val = c["then"]; break
        ctx[key] = val
    return ctx

def matches(rule, ctx):
    if not cond(rule.get("when") or {}, ctx):
        return False
    for k, vals in (rule.get("whenNot") or {}).items():
        if ctx.get(k) in vals:
            return False
    return True

def resolve(inp):
    ctx = derive(inp)
    return [r["id"] for r in D["rules"] if matches(r, ctx)]

BASE = dict(track="new_d2", nationality="vn", applicantRegion="vn_south",
            univTier="certified", univRegion="nonmetro", statusCode="D-2-2",
            scholarship="none", sponsor="parents", parentJob="employee",
            stayMonths="ge12", gradCert="graduated", langTrack="ko", balanceCurrency="vnd")

def case(name, **over):
    inp = dict(BASE); inp.update(over)
    return name, inp, set(resolve(inp))

CASES = [
    ("① 베트남·지방·인증대·학사 (질문의 그 케이스)", {},
     {"FIN-021", "FIN-031", "FIN-040", "CHN-020", "DOC-020", "JUR-011", "PRC-014"},
     {"FIN-030", "FIN-033", "FIN-010", "FIN-020"}),
    ("② 동일 조건 · 우수인증대", dict(univTier="excellent"),
     {"FIN-010", "CHN-010"},
     {"FIN-031", "FIN-040", "FIN-021"}),
    ("③ 동일 조건 · 일반대 · 어학연수 D-4-1", dict(track="new_d4", statusCode="D-4-1", univTier="general"),
     {"FIN-033", "FIN-042", "FIN-070", "CHN-040", "FIN-023", "DUR-030"},
     {"FIN-031", "FIN-040"}),
    ("④ 수도권 · 인증대 · 석사", dict(univRegion="metro", statusCode="D-2-3"),
     {"FIN-030", "FIN-040", "LNG-021"},
     {"FIN-031"}),
    ("⑤ 비자정밀 심사대학", dict(univTier="restricted"),
     {"ELG-010", "LNG-010", "FIN-022"},
     {"CHN-020"}),
    ("⑥ 컨설팅대 · 교환학생", dict(univTier="consulting", statusCode="D-2-6"),
     {"CHN-060", "FIN-041", "ELG-020", "DOC-030", "FIN-034"},
     {"FIN-040", "CHN-050"}),
    ("⑦ 국내 D-4 → D-2 변경", dict(track="change_d4_d2"),
     {"CHN-070", "FIN-055", "FIN-080", "DOC-050"},
     {"FIN-031", "PRC-014", "DOC-010"}),
    ("⑧ 일반국가 · 인증대 (면제 경로)", dict(nationality="general", applicantRegion=None),
     {"FIN-020"},
     {"FIN-021", "FIN-031", "JUR-011", "PRC-014"}),
    ("⑨ 전액 장학생", dict(scholarship="full"),
     {"FIN-060"},
     {"FIN-031", "FIN-040"}),
    ("⑩ 농민 부모 · 졸업예정증명서", dict(parentJob="farmer", gradCert="expected"),
     {"DOC-023", "DUR-011", "PRC-013", "ADM-080"},
     {"DOC-020", "DUR-010"}),
    ("⑪ 대학 입학단계 조항 동시 적용", {},
     {"ADM-010", "ADM-020", "ADM-021", "ADM-030", "ADM-031", "ADM-040", "ADM-050", "ELG-060"},
     {"ADM-022", "ADM-051", "ADM-070", "FIN-036"}),
    ("⑫ 컨설팅대 · 어학 두 기준 충돌", dict(univTier="consulting"),
     {"LNG-060", "ADM-050", "LNG-021", "FIN-041"},
     {"FIN-040"}),
    ("⑬ 어학연수 · 단기 체류", dict(track="new_d4", statusCode="D-4-1", stayMonths="lt12", univTier="general"),
     {"ADM-022", "FIN-036", "ADM-070", "FIN-033"},
     {"FIN-035"}),  # ADM-040(표준입학허가서 소요경비)은 D-4에도 적용됨
]

fail = 0
for name, over, want, notwant in CASES:
    _, inp, got = case(name, **over)
    miss = want - got
    extra = notwant & got
    ok = not miss and not extra
    print(("  PASS  " if ok else "  FAIL  ") + name + f"  [{len(got)}건 적용]")
    if miss:  print("          누락:", ", ".join(sorted(miss)))
    if extra: print("          오적용:", ", ".join(sorted(extra)))
    if not ok: fail += 1

# 무결성 검사
ids = [r["id"] for r in D["rules"]]
assert len(ids) == len(set(ids)), "중복 조항 ID"
for r in D["rules"]:
    assert r["group"] in D["groups"], f'{r["id"]}: 알 수 없는 group'
    assert r["confidence"] in D["confidenceLevels"], f'{r["id"]}: 알 수 없는 confidence'
    for s in r.get("sources", []):
        assert s in D["sources"], f'{r["id"]}: 알 수 없는 source {s}'
    axis_ids = {a["id"] for a in D["axes"]} | set(D.get("derivedAxes") or {})
    for k in list((r.get("when") or {})) + list((r.get("whenNot") or {})):
        assert k in axis_ids, f'{r["id"]}: 알 수 없는 축 {k}'
# checks 무결성
rule_ids = set(ids)
for c in D.get("checks", []):
    for t in c["targets"]:
        assert t in rule_ids, f'{c["id"]}: 존재하지 않는 조항 {t}'
    assert c["severity"] in ("critical", "high", "medium"), f'{c["id"]}: 잘못된 severity'
    if c.get("source"):
        assert c["source"] in D["sources"], f'{c["id"]}: 알 수 없는 출처 {c["source"]}'
    assert c.get("onChange"), f'{c["id"]}: onChange 누락'

# 모든 조항이 최소 하나의 검증항목에 커버되는지 (커버리지)
covered = {t for c in D.get("checks", []) for t in c["targets"]}
uncovered = sorted(rule_ids - covered)
cov = 100 * len(covered) // len(rule_ids)

print("\n무결성 검사 통과 · 조항 %d건 · 검증항목 %d건" % (len(ids), len(D.get("checks", []))))
print("검증 커버리지 %d%% (%d/%d) · 미커버 %d건" % (cov, len(covered), len(rule_ids), len(uncovered)))
if uncovered:
    print("  미커버 조항:", ", ".join(uncovered[:12]) + (" ..." if len(uncovered) > 12 else ""))
sys.exit(1 if fail else 0)
