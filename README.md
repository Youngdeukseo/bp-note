# 혈압 노트

혈압을 기록하고 가족과 공유하는 개인용 PWA. 전부 무료(GitHub Pages + Convex 무료 플랜).

## 처음 설정 (1회)

1. Convex에서 프로젝트 생성 → Settings > Deploy Keys 에서 **Production** 키 생성
2. GitHub 저장소 Settings > Secrets and variables > Actions > Secrets 에 `CONVEX_DEPLOY_KEY` 등록
3. Convex 대시보드 > Production 배포 > Settings > Environment Variables 에 접속 코드 2개 등록 (12자 이상, 서로 다르게)
   - `EDIT_CODE` : 기록용
   - `VIEW_CODE` : 보기용
4. 저장소 Settings > Pages > Source를 **GitHub Actions**로 설정
5. `main`에 push하면 Convex 함수 배포 + 사이트 빌드/배포가 자동으로 진행됨

## 개발

- `npm run dev` — `VITE_CONVEX_URL`이 없으면 이 기기에만 저장하는 로컬 모드로 동작
- `npm run build`
