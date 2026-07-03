# TFC Osmium Finder

GitHub Pages에서 바로 실행되는 정적 웹페이지입니다.

## 배포 방법

1. GitHub에서 새 Public Repository를 만듭니다.
2. 아래 파일 4개를 업로드합니다.
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
3. Repository의 **Settings → Pages**로 이동합니다.
4. **Build and deployment**에서:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. Save를 누릅니다.
6. 잠시 기다린 뒤 표시되는 `https://아이디.github.io/저장소명/` 주소로 접속합니다.

## 사용법

Seed, Center X, Center Z, Search Radius, Maximum Results를 입력하고 **Find Osmium**을 누르면 됩니다.
결과는 거리순으로 정렬되며 CSV로 다운로드할 수 있습니다.
