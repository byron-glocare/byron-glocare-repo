# 특정 크롬 창만 캡처한다 (포커스 불필요).
#
# 화면 전체(CopyFromScreen)를 찍으면 그 순간 앞에 있는 창이 찍힌다. 운영자가
# 컴퓨터를 쓰고 있으면 엉뚱한 화면이 들어가고, 백그라운드 프로세스는 창을 앞으로
# 끌어올 수도 없다(Windows 가 SetForegroundWindow 를 막는다).
#
# 그래서 PrintWindow + PW_RENDERFULLCONTENT 로 대상 창의 픽셀을 직접 받는다.
# 가려져 있어도, 다른 작업을 하고 있어도 그 창만 찍힌다.
#
#   powershell -File shot-window.ps1 -Name 02_footer -ProfileMark glocare-toss-capture
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$ProfileMark = 'glocare-toss-capture'
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCap {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

# 1) 전용 프로필로 띄운 크롬의 브라우저 프로세스를 찾는다
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileMark*" -and $_.CommandLine -notlike '*--type=*' }
if (-not $procs) { throw "전용 프로필($ProfileMark) 크롬을 찾지 못했습니다" }
$pids = @($procs.ProcessId)

# 2) 그 프로세스의 보이는 최상위 창 중 가장 큰 것
$found = @()
$cb = [WinCap+EnumProc] {
  param($h, $p)
  $wpid = 0
  [WinCap]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  if ($pids -contains $wpid -and [WinCap]::IsWindowVisible($h)) {
    $len = [WinCap]::GetWindowTextLength($h)
    if ($len -gt 0) {
      $sb = New-Object System.Text.StringBuilder ($len + 1)
      [WinCap]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
      $r = New-Object WinCap+RECT
      [WinCap]::GetWindowRect($h, [ref]$r) | Out-Null
      $script:found += [pscustomobject]@{
        H = $h; Title = $sb.ToString()
        W = $r.Right - $r.Left; Hgt = $r.Bottom - $r.Top
      }
    }
  }
  return $true
}
[WinCap]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null

$win = $found | Sort-Object { $_.W * $_.Hgt } -Descending | Select-Object -First 1
if (-not $win) { throw '대상 창을 찾지 못했습니다' }

# 3) PW_RENDERFULLCONTENT(2) — 가려져 있어도 창 내용을 받아온다
$bmp = New-Object System.Drawing.Bitmap($win.W, $win.Hgt)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [WinCap]::PrintWindow($win.H, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()

$dir = Join-Path $PSScriptRoot 'shots'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$out = Join-Path $dir ($Name + '.png')
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

"$Name -> $($win.W)x$($win.Hgt) ok=$ok  [$($win.Title)]  $((Get-Item $out).Length) bytes"
