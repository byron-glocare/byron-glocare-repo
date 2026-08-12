# 전체화면 캡처 — 주소창 도메인 + 작업표시줄 시계가 함께 들어가야 하므로
# 브라우저 뷰포트가 아니라 화면 전체를 찍는다 (토스 가이드 4쪽 2·3항).
#   powershell -File shot.ps1 -Name 02_footer
param([Parameter(Mandatory=$true)][string]$Name)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($s.Width, $s.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($s.Left, $s.Top, 0, 0, $bmp.Size)

$dir = Join-Path $PSScriptRoot 'shots'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$out = Join-Path $dir ($Name + '.png')
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

"$Name -> $($s.Width)x$($s.Height), $((Get-Item $out).Length) bytes"
