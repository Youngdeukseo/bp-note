// 접속 코드는 Convex 환경변수(EDIT_CODE, VIEW_CODE)로만 관리합니다.
// 두 값이 같으면 같은 코드로 들어온 사람은 모두 기록 권한을 가집니다.
export function roleOf(code: string): "edit" | "view" | null {
  const edit = process.env.EDIT_CODE;
  const view = process.env.VIEW_CODE;
  if (edit && code === edit) return "edit";
  if (view && code === view) return "view";
  return null;
}
