# 토스 결제경로 캡처 — 7장을 순서대로 받아 shots/ 에 저장한다.
#
#   powershell -ExecutionPolicy Bypass -File docs\toss-review\capture-run.ps1
#
# 각 단계에서 크롬을 해당 화면으로 맞춘 뒤 이 창에서 Enter 를 누르면,
# 3초 뒤(=크롬으로 전환할 시간) 전체화면을 찍는다.
#
# 캡처 규칙 (토스 가이드 4쪽)
#   · 북마크바 숨김            Ctrl+Shift+B
#   · 주소창 도메인 보이게      전체화면 캡처라 자동 충족
#   · 작업표시줄 시계 포함      전체화면 캡처라 자동 충족
#   · 창 최대화, 무관한 탭 닫기

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

$steps = @(
  @{ k = '02_footer';     t = '② 하단 사업자정보'; u = 'https://www.youstudyinkorea.com/'; n = '맨 아래까지 스크롤 — 상호명·대표자명·사업자등록번호·통신판매업신고번호·사업장주소·유선전화번호가 다 보이게' }
  @{ k = '03_refund';     t = '③ 환불규정';        u = 'https://www.youstudyinkorea.com/refund'; n = '환불 기준·비율이 보이는 위치까지 스크롤' }
  @{ k = '04_login';      t = '④ 로그인';          u = 'https://www.youstudyinkorea.com/student/login'; n = '로그아웃 상태여야 폼이 보인다. 찍은 뒤 toss@test.com 으로 로그인' }
  @{ k = '05a_products';  t = '⑤ 상품 목록';       u = 'https://www.youstudyinkorea.com/service'; n = '150,000원 / 600,000원 둘 다 보이게' }
  @{ k = '05b_detail';    t = '⑤ 상품 상세';       u = 'https://www.youstudyinkorea.com/service/full-consulting'; n = '상품명·금액·상세설명·서비스 제공기간이 한 화면에' }
  @{ k = '05c_order';     t = '⑤ 주문서';          u = 'https://www.youstudyinkorea.com/student/order/full-consulting'; n = '결제 금액·결제수단 선택·약관 동의가 보이게' }
  @{ k = '06_payment';    t = '⑥ 카드 결제창';     u = '(주문서에서 [600,000원 결제하기] 클릭)'; n = '결제창 안에 금액·상품명이 보이고, 카드사 선택 + 약관 전체 동의까지' }
)

$dir = Join-Path $PSScriptRoot 'shots'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

Write-Host ''
Write-Host '토스 결제경로 캡처 7장' -ForegroundColor Cyan
Write-Host '먼저 확인: 북마크바 숨김(Ctrl+Shift+B) · 무관한 탭 닫기 · 창 최대화' -ForegroundColor Yellow
Write-Host ''

foreach ($s in $steps) {
  Write-Host ('─' * 70)
  Write-Host $s.t -ForegroundColor Cyan
  Write-Host ('  주소 : ' + $s.u)
  Write-Host ('  확인 : ' + $s.n) -ForegroundColor DarkGray
  Read-Host '  준비되면 Enter (건너뛰려면 s 입력 후 Enter)' | ForEach-Object {
    if ($_ -eq 's') { Write-Host '  건너뜀' -ForegroundColor DarkYellow; return }

    Write-Host '  3초 뒤 촬영 — 크롬으로 전환하세요' -ForegroundColor Yellow
    Start-Sleep -Seconds 3

    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
    $out = Join-Path $dir ($s.k + '.png')
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host ('  저장 : ' + $s.k + '.png') -ForegroundColor Green
  }
}

Write-Host ''
Write-Host '끝났습니다. 이제 PPT 를 조립하세요:' -ForegroundColor Cyan
Write-Host '  node docs/toss-review/build.js'
Write-Host '표지에 테스트 계정까지 넣으려면:'
Write-Host '  $env:TOSS_TEST_ID="toss@test.com"; $env:TOSS_TEST_PW="비밀번호"; node docs/toss-review/build.js'
Write-Host ''
