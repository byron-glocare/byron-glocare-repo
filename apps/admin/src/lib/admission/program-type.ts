/**
 * 모집요강 과정(program_type) 라벨.
 *
 * 0056 이후 program_type 은 모집요강 유일키의 일부다 —
 * 한 대학·학기에 어학연수(D-4) 요강과 학위과정 요강이 공존한다.
 * 운영자에게 "어느 요강인지" 알려야 하는 자리가 여럿이라 여기 모아둔다.
 */
export const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

/** 알 수 없는 값이면 원문 그대로 (라벨 없다고 화면이 비지 않게) */
export function programTypeLabel(value: string): string {
  return PROGRAM_TYPE_LABEL[value] ?? value;
}
