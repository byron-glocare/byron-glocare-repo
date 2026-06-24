"""
양식 docx 의 구조 (table layout, style) 만 가져와서 cell text 를
docxtemplater placeholder 로 교체한 template 을 생성한다.

원본 sample (실제 고객 이력서) 의 PII 는 들어가지 않음.

사용법:
  python build-resume-template.py <원본 sample.docx>
  → 같은 폴더에 resume-template.docx 생성
"""

import sys
import os
from copy import deepcopy
from docx import Document


def replace_cell_text(cell, new_text):
    """셀 안의 모든 paragraph/run 을 비우고 새 텍스트 1개로 교체."""
    # 첫 paragraph 만 유지, 나머지 제거
    for p in cell.paragraphs[1:]:
        p._element.getparent().remove(p._element)
    p = cell.paragraphs[0]
    # run 모두 제거
    for r in list(p.runs):
        r._element.getparent().remove(r._element)
    # 새 run 1개 추가
    run = p.add_run(new_text)
    return run


def main():
    if len(sys.argv) < 2:
        print("usage: python build-resume-template.py <sample.docx>")
        sys.exit(1)
    src = sys.argv[1]
    dst = os.path.join(os.path.dirname(__file__), "resume-template.docx")

    doc = Document(src)
    tables = doc.tables

    # ===== 헤더 (table 0) =====
    # [0,0] = 사진 자리 (이미지는 docxtemplater image module 로 추후 채움 — Phase 2)
    # [0,1] = 이름·생년월일·전화·이메일·주소·한 줄 자기소개
    h = tables[0]
    # [0,0] PII 제거 (사진은 Phase 2 에서)
    replace_cell_text(h.rows[0].cells[0], "")
    replace_cell_text(
        h.rows[0].cells[1],
        "{name_vi} / {name_kr} | {birth_date}\n{phone} | {email}\n{address}\n{one_liner}",
    )

    # ===== 학력 (table 2) =====
    # row0 = 헤더, row1+ = 데이터 → 데이터 행은 1개만 남기고 docxtemplater loop 로
    edu = tables[2]
    # 데이터 row 모두 제거 후 1개만 추가
    for r in list(edu.rows[1:]):
        edu._element.remove(r._element)
    # 1개 row 추가 (4 columns)
    new_row = edu.add_row()
    # docxtemplater table loop: 첫 셀에 `{#educations}` 마지막 셀에 `{/educations}`
    replace_cell_text(new_row.cells[0], "{#educations}{school}")
    replace_cell_text(new_row.cells[1], "{major}")
    replace_cell_text(new_row.cells[2], "{period}")
    replace_cell_text(new_row.cells[3], "{status}{/educations}")

    # ===== 경력 (table 4) =====
    car = tables[4]
    for r in list(car.rows[1:]):
        car._element.remove(r._element)
    new_row = car.add_row()
    replace_cell_text(new_row.cells[0], "{#careers}{workplace}")
    replace_cell_text(new_row.cells[1], "{period}")
    replace_cell_text(new_row.cells[2], "{role}")
    replace_cell_text(new_row.cells[3], "{detail}")
    replace_cell_text(new_row.cells[4], "{status}{/careers}")

    # ===== 자격증·수상 (table 6) =====
    cert = tables[6]
    for r in list(cert.rows[1:]):
        cert._element.remove(r._element)
    new_row = cert.add_row()
    replace_cell_text(new_row.cells[0], "{#certifications}{name}")
    replace_cell_text(new_row.cells[1], "{issuer}")
    replace_cell_text(new_row.cells[2], "{date}{/certifications}")

    # ===== 기술·어학 (table 8) =====
    skill = tables[8]
    for r in list(skill.rows[1:]):
        skill._element.remove(r._element)
    new_row = skill.add_row()
    replace_cell_text(new_row.cells[0], "{#skills}{name}")
    replace_cell_text(new_row.cells[1], "{detail}")
    replace_cell_text(new_row.cells[2], "{level}{/skills}")

    # ===== 기타 활동 (table 10) =====
    other = tables[10]
    for r in list(other.rows[1:]):
        other._element.remove(r._element)
    new_row = other.add_row()
    replace_cell_text(new_row.cells[0], "{#activities}{name}")
    replace_cell_text(new_row.cells[1], "{period}")
    replace_cell_text(new_row.cells[2], "{org}")
    replace_cell_text(new_row.cells[3], "{detail}{/activities}")

    # ===== 자기소개 본문 (table 12) =====
    intro = tables[12]
    replace_cell_text(intro.rows[0].cells[0], "{narrative}")

    doc.save(dst)
    print(f"saved: {dst}")


if __name__ == "__main__":
    main()
