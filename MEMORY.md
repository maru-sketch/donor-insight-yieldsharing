# 🍊 만들기 기록 — 후원자 데이터 인사이트 대시보드

## 한눈에 보기
- 무엇을: 민감한 원본 데이터를 브라우저 밖으로 보내지 않고 후원 흐름을 시각화해 수정 가능한 전략 초안을 만드는 웹앱
- 결과물 유형: web_app
- 결과: https://donor-insight-yieldsharing.csmerry.chatgpt.site

## 기록

### 2026-07-22 GitHub·운영 대시보드 공개
- **한 것**: 후원자 유지율과 1회 이상 실제 납입률을 포함한 전체 구현·검증 이력을 `maru-sketch/donor-insight-yieldsharing` 저장소의 `main` 브랜치에 push했다.
- **검증 상태**: REQ 12/12 PASS, TEST 3/3 TESTED, 자동검사 7/7, 제공 CSV 운영 업로드와 390px 모바일 화면 및 브라우저 오류 0건을 확인했다.
- **공개 결정과 보호 범위**: 사용자의 명시적 요청으로 GitHub 저장소와 운영 대시보드를 모두 공개했다. 원본 후원자 CSV는 포함하지 않았고, 업로드 데이터는 서버에 저장하지 않으며 브라우저 안에서만 처리한다.
- **결과**: GitHub https://github.com/maru-sketch/donor-insight-yieldsharing · 운영 앱 https://donor-insight-yieldsharing.csmerry.chatgpt.site

<!-- orange-build:final-verification -->
### 2026-07-22 최종 검증
- **최종 판정**: 완료 — REQ 12/12 PASS · TEST 3/3 TESTED
- **확인한 결과**: UTF-8·한글 CSV(CP949)에서 필수 열을 자동 연결해 요약·차트·전략 문구와 월별 × 인입채널 교차표를 표시한다. 납부일·납부항목·인입채널·납부금액 중 보고 싶은 열만 고를 수 있고, 회원번호·시작년월·납부종료일이 있으면 평균 후원 유지율·평균 후원기간·중단 후원자 수를, 회원번호·납부여부가 있으면 1회 이상 납입률·실제 납입자 수·미납입 인입 수도 보여 준다. 회원번호와 납부여부는 이 계산에만 휘발성으로 사용한다.
- **검증 근거**: 제공 한글 CSV 138건에서 2026.07.22 기준 고유 후원자 133명 중 116명 유지·17명 중단으로 유지율 87.2%, 평균 후원기간 3.1개월을 독립 집계와 화면에서 대조했다. 같은 파일의 납부여부 Y 121건·N 17건을 후원자별로 묶어 116명이 1회 이상 납입, 17명이 아직 미납입한 인입으로 납입률 87.2%임을 화면에서 확인했다. 계산 열이 없는 CSV는 필요한 열을 안내하면서 기존 분석을 유지했다. 자동검사 7/7, 390px 반응형 및 콘솔 오류 0건 확인. 기존 TEST-02 TXT 오류·재시도와 TEST-03 문구 수정·기기 저장 증거 유지
- **저장·배포**: GitHub PUBLIC 저장소 `main` push 확인 · https://github.com/maru-sketch/donor-insight-yieldsharing · Sites 운영 버전 8 공개 접근 및 로그인 없는 HTTP 200·핵심 화면 확인 · https://donor-insight-yieldsharing.csmerry.chatgpt.site
- **아직 증명하지 못한 것**: 실제 업무 시간 50% 단축은 운영 도입 전후 측정이 필요한 P3 후속 지표
<!-- /orange-build:final-verification -->
