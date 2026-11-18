# 혈압 노트

혈압을 기록하고 가족과 공유하는 개인용 PWA. 전부 무료(GitHub Pages + Convex 무료 플랜).

## 처음 설정 (1회)

1. `npm install`
2. `npx convex dev` — GitHub 로그인 후 새 프로젝트 생성 (`convex/_generated`가 만들어짐)
3. 접속 코드 설정 (12자 이상 권장, 서로 다르게):
   - `npx convex env set EDIT_CODE <기록용 코드>`
   - `npx convex env set VIEW_CODE <보기용 코드>`
4. `.env.local`의 `CONVEX_URL` 값을 GitHub 저장소 Variables에 `VITE_CONVEX_URL`로 등록
5. 저장소 Settings > Pages > Source를 **GitHub Actions**로 설정
6. `main`에 push하면 자동 배포

## 개발

- `npm run dev` — `VITE_CONVEX_URL`이 없으면 이 기기에만 저장하는 로컬 모드로 동작
- `npm run build`
