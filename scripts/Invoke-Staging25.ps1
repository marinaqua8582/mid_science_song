#requires -Version 7.2
[CmdletBinding()]
param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
# This immutable Preview is the only permitted network destination.
$origin = 'https://mid-science-song-git-fix-classroom-concurrency-202610-jeonghee.vercel.app'
$expectedCommit = '122c6a0'
# Disabled until the reviewed lock strategy is deployed to a new test Preview.
$deploymentReady = $false
$expectedCommitFull = '122c6a071169c30f49499fb84f8e8d25a84be19f'
$runStarted = [DateTimeOffset]::UtcNow
$runStamp = $runStarted.ToOffset([TimeSpan]::FromHours(9)).ToString('yyyyMMdd-HHmmss-fff')
$runId = "$runStamp-KST-$([guid]::NewGuid().ToString('N').Substring(0,8))"
# Each invocation owns a new report. Never read, reuse or overwrite an older result.
$reportPath = Join-Path $PSScriptRoot "staging-host-results-$expectedCommit-$runId.json"
$reportCreated = $false
if ($ValidateOnly) {
    $tokens=$null; $parseErrors=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
    if ($parseErrors.Count) { throw 'PowerShell parse validation failed' }
    Write-Host 'Syntax valid. No requests or credential input performed.'
    return
}
Add-Type -AssemblyName System.Net.Http
# The helper is compiled in memory. It does not use jobs, child processes, files or automatic redirects.
Add-Type -TypeDefinition @'
using System;
using System.Net.Http;
using System.Diagnostics;
using System.Threading.Tasks;
public sealed class StagingReply {
 public int Status; public double Ms; public string Body; public string Cookie; public string Error;
 public StagingLocation Location;
 public string SafeCode; public double RetryAfterMs;
 public StagingAttempt[] Attempts; public StagingTiming Timing;
}
public sealed class StagingAttempt {
 public int Attempt; public int Status; public double Ms; public string ErrorCode; public StagingLocation Location; public StagingTiming Timing;
}
public sealed class StagingTiming {
 public int LockWaitMs; public int LockHoldMs; public int ReleaseMs; public string FailureLocation;
}
public sealed class StagingLocation {
 public string Scheme; public string Host; public string Path;
}
public static class StagingHttp {
 public static async Task<StagingReply> Send(HttpClient client, string origin, string method, string path, string body, string cookie, bool retry=false) {
  var total=Stopwatch.StartNew();
  var attempts=new System.Collections.Generic.List<StagingAttempt>();
  for(int attempt=0;;attempt++) {
   var reply=await SendOnce(client,origin,method,path,body,cookie);
   attempts.Add(new StagingAttempt{Attempt=attempt+1,Status=reply.Status,Ms=reply.Ms,ErrorCode=reply.SafeCode??reply.Error,Location=reply.Location,Timing=reply.Timing});
   double delay=reply.RetryAfterMs+System.Security.Cryptography.RandomNumberGenerator.GetInt32(100,101+(int)(500*Math.Pow(2,attempt)));
   if(!retry || attempt>=2 || (reply.Status!=502 && reply.Status!=503 && reply.Status!=504) || delay>15000) {
    reply.Attempts=attempts.ToArray();reply.Ms=total.Elapsed.TotalMilliseconds;return reply;
   }
   // The serialized body and requestId are immutable across these attempts.
   reply.Body=null;reply.Cookie=null;
   await Task.Delay((int)Math.Ceiling(delay));
  }
 }
 private static int SafeMilliseconds(string text,string name) {
  var match=System.Text.RegularExpressions.Regex.Match(text,"\\\""+name+"\\\"\\s*:\\s*([0-9]{1,6})(?![0-9.])");
  int value; return match.Success && Int32.TryParse(match.Groups[1].Value,out value) && value<=360000?value:0;
 }
 private static async Task<StagingReply> SendOnce(HttpClient client, string origin, string method, string path, string body, string cookie) {
  var watch=Stopwatch.StartNew();
  try {
   using(var req=new HttpRequestMessage(new HttpMethod(method),origin+path)) {
    if(method!="GET" && body!=null) req.Content=new StringContent(body,System.Text.Encoding.UTF8,"application/json");
    if(!String.IsNullOrEmpty(cookie)) req.Headers.TryAddWithoutValidation("Cookie",cookie);
    using(var response=await client.SendAsync(req)) {
     if((int)response.StatusCode>=300 && (int)response.StatusCode<400) {
      StagingLocation safe=null;
      var location=response.Headers.Location;
      if(location!=null) {
       Uri resolved;
       if(Uri.TryCreate(req.RequestUri,location,out resolved)) {
        string safePath=resolved.AbsolutePath;
        System.Collections.Generic.IEnumerable<string> bypass;
        if(client.DefaultRequestHeaders.TryGetValues("x-vercel-protection-bypass",out bypass))
         foreach(var value in bypass)
          if(!String.IsNullOrEmpty(value) && (safePath.Contains(value) || Uri.UnescapeDataString(safePath).Contains(value))) safePath="[REDACTED]";
        safe=new StagingLocation{Scheme=resolved.Scheme,Host=resolved.Host,Path=safePath};
       }
      }
      // Never retain a redirect body, raw Location, query, fragment, userinfo or cookies.
      return new StagingReply{Status=(int)response.StatusCode,Ms=watch.Elapsed.TotalMilliseconds,Error="REDIRECT_NOT_FOLLOWED",Location=safe};
     }
     var text=await response.Content.ReadAsStringAsync(); string session="";
     System.Collections.Generic.IEnumerable<string> values;
     if(response.Headers.TryGetValues("Set-Cookie",out values)) foreach(var value in values) {
      var pair=value.Split(';')[0];
      if(pair.StartsWith("science_song_student_session=")) session=pair;
     }
     string safeCode=null;
     var match=System.Text.RegularExpressions.Regex.Match(text,"\\\"code\\\"\\s*:\\s*\\\"([A-Z_]+)\\\"");
     if(match.Success && Array.IndexOf(new[]{"LOCK_TIMEOUT","GAS_UNAVAILABLE","STORAGE_NOT_READY","STORAGE_LAYOUT_CONFLICT","REQUEST_ID_CONFLICT","SAVE_FAILED","LOGIN_RATE_LIMIT","OWNERSHIP_RELEASE_FAILED","STORAGE_WRITE_UNCERTAIN"},match.Groups[1].Value)>=0) safeCode=match.Groups[1].Value;
     double retryAfter=0;
     if(response.Headers.RetryAfter!=null) {
      if(response.Headers.RetryAfter.Delta.HasValue) retryAfter=Math.Max(0,response.Headers.RetryAfter.Delta.Value.TotalMilliseconds);
      else if(response.Headers.RetryAfter.Date.HasValue) retryAfter=Math.Max(0,(response.Headers.RetryAfter.Date.Value-DateTimeOffset.UtcNow).TotalMilliseconds);
     }
     StagingTiming timing=null;
     if(text.Contains("\"storageTiming\"")) {
      timing=new StagingTiming{LockWaitMs=SafeMilliseconds(text,"lockWaitMs"),LockHoldMs=SafeMilliseconds(text,"lockHoldMs"),ReleaseMs=SafeMilliseconds(text,"releaseMs")};
      var where=System.Text.RegularExpressions.Regex.Match(text,"\\\"failureLocation\\\"\\s*:\\s*\\\"(none|claim_lock|student_busy|release_property|write_uncertain)\\\"");
      if(where.Success)timing.FailureLocation=where.Groups[1].Value;
     }
     return new StagingReply{Status=(int)response.StatusCode,Ms=watch.Elapsed.TotalMilliseconds,Body=text,Cookie=session,SafeCode=safeCode,RetryAfterMs=retryAfter,Timing=timing};
    }
   }
  } catch(Exception) { return new StagingReply{Status=0,Ms=watch.Elapsed.TotalMilliseconds,Error="NETWORK_OR_TIMEOUT"}; }
 }
}
'@
$secure=$null; $plain=$null; $pointer=[IntPtr]::Zero; $client=$null; $handler=$null
$bypassEntered=$false
$cookies=New-Object string[] 25
$saved=@{}
$report=[ordered]@{origin=$origin;expectedCommit=$expectedCommit;expectedCommitFull=$expectedCommitFull;runId=$runId;branch='fix/classroom-concurrency-202610';revision='ownership-release-fix-draft';startedAt=$runStarted.ToString('o');phases=@();failure=$null;csv=$null;cleanup='pending';gemini='not called';physicalRowsVerified=$false}
function Write-Report {
    $json = $report | ConvertTo-Json -Depth 12
    if (!$script:reportCreated) {
        $stream = [IO.File]::Open($reportPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes($json)
            $stream.Write($bytes,0,$bytes.Length)
            $script:reportCreated = $true
        } finally { $stream.Dispose() }
    } else { [IO.File]::WriteAllText($reportPath,$json,[Text.UTF8Encoding]::new($false)) }
}
function Test-IsolationConfirmation([string]$value) { $value -ceq 'TEST-ONLY' }
function Test-HealthReply($r,$d) {
    $r.Status -eq 200 -and $d.status -ceq 'ok' -and $d.configured.gas -is [bool] -and $d.configured.gas -eq $true
}
function Batch([string]$label,[string]$path,[object[]]$bodies,[scriptblock]$verify,[int]$count=25,[ValidateSet('GET','POST')][string]$method) {
    if($path -notmatch '^/[A-Za-z0-9/_-]*$'){throw 'UNSAFE_REQUEST_PATH'}
    if(!$method){$method=if($null -eq $bodies){'GET'}else{'POST'}}
    $tasks=@(); $responses=@()
    for($i=0;$i -lt $count;$i++) {
        $body=if($null -ne $bodies){$bodies[$i] | ConvertTo-Json -Depth 8 -Compress}else{$null}
        $retry=$path -eq '/api/sheet' -and $null -ne $bodies -and $bodies[$i].action -in @('saveSubmission','saveStudentData')
        $tasks+= [StagingHttp]::Send($client,$origin,$method,$path,$body,$cookies[$i],$retry)
    }
    for($i=0;$i -lt $count;$i++) {
        $r=$tasks[$i].GetAwaiter().GetResult(); $data=$null
        try { $data=$r.Body | ConvertFrom-Json } catch {}
        $ok=$false
        if($r.Status -lt 300 -or $r.Status -ge 400){try { $ok=[bool](& $verify $i $r $data) } catch {}}
        $entry=[ordered]@{ordinal=$i+1;method=$method;path=$path;status=$r.Status;ms=[Math]::Round($r.Ms,2);passed=$ok;errorCode=$r.SafeCode;transportError=$r.Error;attempts=@($r.Attempts | ForEach-Object { [ordered]@{attempt=$_.Attempt;status=$_.Status;ms=[Math]::Round($_.Ms,2);errorCode=$_.ErrorCode;storageTiming=$(if($null -ne $_.Timing){[ordered]@{lockWaitMs=$_.Timing.LockWaitMs;lockHoldMs=$_.Timing.LockHoldMs;releaseMs=$_.Timing.ReleaseMs;failureLocation=$_.Timing.FailureLocation}}else{$null})} })}
        if($path -eq '/api/health' -and $null -ne $data.configured){
            $entry.configured=[ordered]@{}
            foreach($key in @('gas','adminPassword','session')){
                if($data.configured.$key -is [bool]){$entry.configured[$key]=$data.configured.$key}
            }
        }
        if($null -ne $r.Location){$entry.location=[ordered]@{scheme=$r.Location.Scheme;host=$r.Location.Host;path=$r.Location.Path}}
        if($null -ne $r.Location){$entry.attempts[-1].location=$entry.location}
        $responses+= $entry
        $r.Body=$null; $r.Cookie=$null; $data=$null
    }
    $times=@($responses.ms | Sort-Object); $codes=@{}
    foreach($r in $responses){$k=[string]$r.status;if(!$codes.ContainsKey($k)){$codes[$k]=0};$codes[$k]++}
        $attemptCodes=@{}
    foreach($entry in $responses){foreach($a in $entry.attempts){$k=[string]$a.status;if(!$attemptCodes.ContainsKey($k)){$attemptCodes[$k]=0};$attemptCodes[$k]++}}
    $success=@($responses | Where-Object passed).Count
    $metrics=[ordered]@{phase=$label;success=$success;total=$count;successRate=$success/$count;p50Ms=$times[[Math]::Ceiling(.5*$count)-1];p95Ms=$times[[Math]::Ceiling(.95*$count)-1];maxMs=$times[-1];httpCodes=$codes;attemptHttpCodes=$attemptCodes;requests=$responses}
    $report.phases+= $metrics; Write-Report
    Write-Host ([pscustomobject]@{phase=$label;success=$success;total=$count;p50Ms=$metrics.p50Ms;p95Ms=$metrics.p95Ms;maxMs=$metrics.maxMs;httpCodes=$codes;attemptHttpCodes=$attemptCodes} | ConvertTo-Json -Compress)
    if($success -ne $count){throw 'PHASE_FAILED'}
}
try {
    if(!$deploymentReady){Write-Host 'DEPLOYMENT_NOT_READY: no network requests will be sent.';throw 'DEPLOYMENT_NOT_READY'}
    Write-Report
    Write-Host "Preview: $origin"
    Write-Host "Expected commit: $expectedCommit"
    Write-Host "New result file: $reportPath"
    Write-Host 'Only the pinned Preview is used. Verify its branch-only test GAS/Sheets variables in Vercel first.'
    if(!(Test-IsolationConfirmation (Read-Host 'Type TEST-ONLY after verifying the Preview uses the separate test GAS and test Sheets'))){throw 'ISOLATION_NOT_CONFIRMED'}
    $secure=Read-Host 'Temporary Vercel Automation Bypass secret' -AsSecureString
    $bypassEntered=$true
    if($secure.Length -eq 0){throw 'EMPTY_BYPASS_INPUT'}
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$pointer=[IntPtr]::Zero}
    $handler=[System.Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false
    $client=[System.Net.Http.HttpClient]::new($handler);$client.Timeout=[TimeSpan]::FromSeconds(60)
    $client.DefaultRequestHeaders.Add('x-vercel-protection-bypass',$plain)
    $client.DefaultRequestHeaders.Add('Origin',$origin)
    $plain=$null;$secure.Dispose();$secure=$null
    Batch -label 'Preview health' -method 'GET' -path '/api/health' -bodies $null -verify {param($i,$r,$d) Test-HealthReply $r $d} -count 1
    Batch 'Synthetic roster guard' '/api/settings/public' $null {
        param($i,$r,$d)
        $rows=@($d.roster)
        $invalid=@($rows | Where-Object { $_.grade -ne 2 -or $_.classNum -ne 99 -or $_.studentNum -lt 1 -or $_.studentNum -gt 25 -or $_.PSObject.Properties.Name -contains 'name' -or $_.PSObject.Properties.Name -contains 'googleId' })
        $r.Status -eq 200 -and $d.access.isOpen -eq $true -and $rows.Count -eq 25 -and $invalid.Count -eq 0 -and @($rows.studentNum | Sort-Object -Unique).Count -eq 25
    } 1
    Batch 'First screen' '/' $null {param($i,$r,$d) $r.Status -eq 200 -and $r.Body.Contains('id="root"')}
    Batch 'Access window' '/api/settings/public' $null {param($i,$r,$d) $r.Status -eq 200 -and $d.access.isOpen -eq $true -and @($d.roster).Count -eq 25}
    $logins=@(1..25 | ForEach-Object {@{grade=2;classNum=99;studentNum=$_;name=('합성테스트{0:d2}' -f $_)}})
    $loginCheck={param($i,$r,$d) if($r.Status -eq 200){$cookies[$i]=$r.Cookie};$r.Status -eq 200 -and !!$r.Cookie -and $d.student.grade -eq 2 -and $d.student.classNum -eq 99 -and $d.student.studentNum -eq $i+1}
    Batch 'Login same host IP' '/api/student/login' $logins $loginCheck
    for($stage=1;$stage -le 4;$stage++){
        $saved[$stage]=@(1..25 | ForEach-Object {@{action='saveSubmission';requestId=([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()+'_'+[guid]::NewGuid().ToString());domain='소화';learningContent="synthetic-$_-summary";keywords="synthetic-keyword-$_";musicStyle=$(if($stage -ge 2){'K-Pop'}else{''});promptStructure=$(if($stage -ge 2){'[Verse 1] [Chorus] [Verse 2] [Chorus] [Outro]'}else{''});aiLyrics=$(if($stage -ge 2){"synthetic-$_-lyrics"}else{''});editedLyrics=$(if($stage -ge 3){"synthetic-$_-edited"}else{''});sunoLink=$(if($stage -eq 4){"https://example.invalid/synthetic/$_"}else{''});status=$(if($stage -eq 4){'completed'}else{"step$stage"});submittedAt=[DateTime]::UtcNow.ToString('o')}})
        Batch "Save stage $stage" '/api/sheet' $saved[$stage] {param($i,$r,$d) $r.Status -eq 200 -and $d.status -eq 'success' -and $d.requestId -eq $saved[$stage][$i].requestId -and !!$d.savedAt}
    }
    # Discarded first-stage acknowledgements are replayed after final submission; final content must survive.
    Batch 'Replay same requestId after lost acknowledgement' '/api/sheet' $saved[1] {param($i,$r,$d) $r.Status -eq 200 -and $d.duplicate -eq $true -and $d.requestId -eq $saved[1][$i].requestId}
    Batch 'Logout' '/api/student/logout' @(1..25 | ForEach-Object {@{}}) {param($i,$r,$d) $cookies[$i]='';$r.Status -eq 200 -and $d.status -eq 'success'}
    Batch 'Logged out read denied' '/api/sheet' @(1..25 | ForEach-Object {@{action='getStudentData'}}) {param($i,$r,$d) $r.Status -eq 401}
    Batch 'Relogin' '/api/student/login' $logins $loginCheck
    Batch 'Restore and compare every student' '/api/sheet' @(1..25 | ForEach-Object {@{action='getStudentData'}}) {
        param($i,$r,$d) $n=$i+1;$v=$d.data
        $r.Status -eq 200 -and $d.found -eq $true -and $v.grade -eq 2 -and $v.classNum -eq 99 -and $v.studentNum -eq $n -and $v.domain -eq '소화' -and $v.learningContent -eq "synthetic-$n-summary" -and $v.keywords -eq "synthetic-keyword-$n" -and $v.musicStyle -eq 'K-Pop' -and $v.aiLyrics -eq "synthetic-$n-lyrics" -and $v.editedLyrics -eq "synthetic-$n-edited" -and $v.sunoLink -eq "https://example.invalid/synthetic/$n" -and $v.status -eq 'completed'
    }
    $report.apiPassed=$true
} catch {
    # Do not print exception messages: an HTTP or input exception may contain private values.
    $report.failure='STOPPED: inspect the last safe phase metrics; bounded save retries exhausted or nonretryable failure';Write-Host $report.failure
} finally {
    if($client){$client.DefaultRequestHeaders.Clear();$client.Dispose();$client=$null}
    if($handler){$handler.Dispose();$handler=$null}
    if($secure){$secure.Dispose();$secure=$null}
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
    $plain=$null;$cookies=$null;$logins=$null;$saved=$null;$tasks=$null
    Remove-Item Env:STAGING_AUTOMATION_BYPASS -ErrorAction SilentlyContinue
    Remove-Item Env:VERCEL_AUTOMATION_BYPASS_SECRET -ErrorAction SilentlyContinue
    [GC]::Collect();[GC]::WaitForPendingFinalizers()
    if($bypassEntered){
        Write-Host 'NOW revoke the temporary bypass in Vercel > Deployment Protection > Protection Bypass for Automation.'
        Write-Host 'Remove only the temporary test entry; leave existing links and other credentials unchanged.'
        $report.cleanup=if((Read-Host 'After checking the temporary entry is absent, type REVOKED') -ceq 'REVOKED'){'user-confirmed removed from Vercel list'}else{'NOT CONFIRMED: immediate manual revocation required'}
    }else{$report.cleanup='bypass not supplied; no credential used'}
    $report.finishedAt=[DateTime]::UtcNow.ToString('o');Write-Report
}
if($report.apiPassed){
    Write-Host 'Export only Submissions from the known separate test spreadsheet as CSV. Never select production data.'
    $csvPath=Read-Host 'Full path of test Submissions CSV (Enter to defer)'
    if($csvPath){
        try{
            $rows=@(Import-Csv -LiteralPath $csvPath -Encoding utf8)
            $keys=@($rows | ForEach-Object {"$($_.'학년')-$($_.'반')-$($_.'번호')"})
            $unique=@($keys | Sort-Object -Unique).Count
            $bad=@($rows | Where-Object {$_.'학년' -ne '2' -or $_.'반' -ne '99' -or [int]$_.'번호' -lt 1 -or [int]$_.'번호' -gt 25}).Count
            $missing=@(1..25 | Where-Object {"2-99-$_" -notin $keys}).Count
            $mismatch=0
            foreach($row in $rows){$n=[int]$row.'번호';if($row.'학습정리' -cne "synthetic-$n-summary" -or $row.'AI가사' -cne "synthetic-$n-lyrics" -or $row.'학생수정가사' -cne "synthetic-$n-edited" -or $row.'Suno링크' -cne "https://example.invalid/synthetic/$n" -or $row.'상태' -cne 'completed'){$mismatch++}}
            $report.csv=@{rows=$rows.Count;uniqueStudents=$unique;duplicateRows=$rows.Count-$unique;missing=$missing;foreignOrInvalidRows=$bad;contentMismatchOrOverwrite=$mismatch}
            $report.physicalRowsVerified=$rows.Count -eq 25 -and $unique -eq 25 -and $bad -eq 0 -and $missing -eq 0 -and $mismatch -eq 0
            $rows=$null;$keys=$null;Write-Report
            Write-Host ($report.csv | ConvertTo-Json -Compress)
        }catch{$report.csv=@{error='CSV_VALIDATION_FAILED'};Write-Report}
    }
}
Write-Host "Safe report: $reportPath"
Write-Host 'Close this dedicated PowerShell process now. Gemini was not called.'
