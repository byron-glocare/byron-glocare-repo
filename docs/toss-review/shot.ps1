# 전체화면 캡처 — 대상 크롬 창을 맨 위로 올린 뒤 찍는다.
#
# 토스 가이드 4쪽 2·3항이 "주소창 도메인"과 "PC 시계"를 함께 요구한다.
# 시계는 작업표시줄에 있으므로 창만 찍어선 안 되고 화면 전체를 찍어야 한다.
#
# 문제: 백그라운드에서 실행되는 스크립트는 SetForegroundWindow 로 창을 못 올린다
#       (Windows 가 막는다). 그래서 운영자가 다른 일을 하고 있으면 그 화면이 찍힌다.
# 해결: SetWindowPos(HWND_TOPMOST) 는 포커스를 뺏지 않고도 창을 시각적으로 올린다.
#       찍은 뒤 NOTOPMOST 로 되돌린다.
#
#   powershell -File shot.ps1 -Name 02_footer
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$ProfileMark = 'glocare-toss-capture'
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Shot {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$HWND_TOPMOST = [IntPtr]::new(-1)
$HWND_NOTOPMOST = [IntPtr]::new(-2)
$SWP = 0x0010 -bor 0x0001 -bor 0x0002   # NOACTIVATE | NOSIZE | NOMOVE

# 전용 프로필 크롬의 브라우저 프로세스
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileMark*" -and $_.CommandLine -notlike '*--type=*' }
if (-not $procs) { throw ("dedicated chrome not found: " + $ProfileMark) }
$pids = @($procs.ProcessId)

$script:found = @()
$cb = [Shot+EnumProc] {
  param($h, $p)
  $wpid = 0
  [Shot]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  if ($pids -contains $wpid -and [Shot]::IsWindowVisible($h)) {
    $len = [Shot]::GetWindowTextLength($h)
    if ($len -gt 0) {
      $sb = New-Object System.Text.StringBuilder ($len + 1)
      [Shot]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
      $r = New-Object Shot+RECT
      [Shot]::GetWindowRect($h, [ref]$r) | Out-Null
      $script:found += [pscustomobject]@{
        H = $h; Title = $sb.ToString(); W = $r.Right - $r.Left; Hgt = $r.Bottom - $r.Top
      }
    }
  }
  return $true
}
[Shot]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
$win = $script:found | Sort-Object { $_.W * $_.Hgt } -Descending | Select-Object -First 1
if (-not $win) { throw 'target window not found' }

# 맨 위로 올린다 (포커스는 뺏지 않는다)
[Shot]::ShowWindow($win.H, 3) | Out-Null        # 3 = maximize
[Shot]::SetWindowPos($win.H, $HWND_TOPMOST, 0, 0, 0, 0, $SWP) | Out-Null
Start-Sleep -Milliseconds 600

$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)

# 원래대로
[Shot]::SetWindowPos($win.H, $HWND_NOTOPMOST, 0, 0, 0, 0, $SWP) | Out-Null

$dir = Join-Path $PSScriptRoot 'shots'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$out = Join-Path $dir ($Name + '.png')
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

($Name + ' -> ' + $b.Width + 'x' + $b.Height + ', ' + (Get-Item $out).Length + ' bytes')
