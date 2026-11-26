/**
 * 브라우저에서 사진 줄이기 — 서버 액션 요청 본문 한도(Vercel 4.5MB) 안에 넣기 위해.
 *   이미지가 아니거나 이미 작으면 그대로 돌려준다. 긴 변 2000px · JPEG 0.85.
 */
const LIMIT_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= LIMIT_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
