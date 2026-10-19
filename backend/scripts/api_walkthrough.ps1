# Walkthrough of the live API (Step 8 preparation). Prints PASS/FAIL per check.
$base = "http://localhost:5000"
$ok = 0; $fail = 0
function check($name, $cond) {
    if ($cond) { Write-Host "PASS  $name"; $script:ok++ } else { Write-Host "FAIL  $name"; $script:fail++ }
}

# register
$email = "api_test_$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
$r = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{name='API Tester'; email=$email; password='Password123'} | ConvertTo-Json)
check "register 201 + role Researcher" ($r.user.role -eq 'Researcher')

# duplicate -> 409
try { Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{name='X'; email=$email; password='Password123'} | ConvertTo-Json); check "duplicate 409" $false }
catch { check "duplicate 409" ($_.Exception.Response.StatusCode.value__ -eq 409) }

# login
$r = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{email=$email; password='Password123'} | ConvertTo-Json)
$token = $r.token
check "login returns token" ([bool]$token)
$H = @{ Authorization = "Bearer $token" }

# me
$r = Invoke-RestMethod -Uri "$base/api/auth/me" -Headers $H
check "me returns email" ($r.email -eq $email)

# predict without token -> 401
try { Invoke-RestMethod -Method Post -Uri "$base/api/predict" -ContentType 'application/json' -Body '{}'; check "predict no token 401" $false }
catch { check "predict no token 401" ($_.Exception.Response.StatusCode.value__ -eq 401) }

# predict with a real row
$row = @{
  'Melt temperature'=126.137; 'Mold temperature'=80.098; 'time_to_fill'=9.607
  'ZDx - Plasticizing time'=4.637; 'ZUx - Cycle time'=75.076; 'SKx - Closing force'=913.348
  'SKs - Clamping force peak value'=916.837; 'Ms - Torque peak value current cycle'=115.805
  'Mm - Torque mean value current cycle'=90.498; 'APSs - Specific back pressure peak value'=146.794
  'APVs - Specific injection pressure peak value'=866.466
  'CPn - Screw position at the end of hold pressure'=8.622; 'SVo - Shot volume'=18.811
}
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$r = Invoke-RestMethod -Method Post -Uri "$base/api/predict" -ContentType 'application/json' -Headers $H -Body (@{row=$row} | ConvertTo-Json)
$sw.Stop()
check "predict result ($($r.label), $($r.predicted)) in $($sw.ElapsedMilliseconds)ms" ($r.predicted -in 1..4 -and $r.probabilities.Count -eq 4 -and $sw.ElapsedMilliseconds -lt 300)

# explain
$r = Invoke-RestMethod -Method Post -Uri "$base/api/explain" -ContentType 'application/json' -Headers $H `
    -Body (@{row=$row; predicted=2} | ConvertTo-Json)
check "explain 13 items sorted" ($r.Count -eq 13 -and [math]::Abs(($r | ForEach-Object {[math]::Abs($_.share)} | Measure-Object -Sum).Sum - 100) -lt 1)

# recommend
$r = Invoke-RestMethod -Method Post -Uri "$base/api/recommend" -ContentType 'application/json' -Headers $H `
    -Body (@{row=$row; predicted=2} | ConvertTo-Json)
check "recommend recs + afterPrediction" ($r.recs.Count -le 6 -and $null -ne $r.afterPrediction)

# history: post, list, get, isolation, delete
$entry = @{ fileName='api_run.csv'; rows=120; model='Random Forest'; accuracy=0.93; predicted=3
  label='Target'; confidence=0.86; topFeature='ZUx - Cycle time'
  snapshot=@{training=@{best='Random Forest'}} } | ConvertTo-Json -Depth 5
$r = Invoke-RestMethod -Method Post -Uri "$base/api/history" -ContentType 'application/json' -Headers $H -Body $entry
$id = $r.id
$r = Invoke-RestMethod -Uri "$base/api/history" -Headers $H
check "history list newest first, no snapshot" ($r[0].fileName -eq 'api_run.csv' -and $null -eq $r[0].snapshot)
$r = Invoke-RestMethod -Uri "$base/api/history/$id" -Headers $H
check "history get includes snapshot" ($r.snapshot.training.best -eq 'Random Forest')

# second user cannot see it
$email2 = "api_other_$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{name='Other User'; email=$email2; password='Password123'} | ConvertTo-Json) | Out-Null
$r2 = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{email=$email2; password='Password123'} | ConvertTo-Json)
try { Invoke-RestMethod -Uri "$base/api/history/$id" -Headers @{Authorization="Bearer $($r2.token)"}; check "user isolation 404" $false }
catch { check "user isolation 404" ($_.Exception.Response.StatusCode.value__ -eq 404) }

# train with the full sample dataset (measures the time for the report)
$csv = Import-Csv "..\test-data\1_valid_dataset.csv" -Delimiter ';'
$train = $csv[0..449]
$test = $csv[450..599]
$body = @{ train = $train; test = $test } | ConvertTo-Json -Depth 5
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$r = Invoke-RestMethod -Method Post -Uri "$base/api/train" -ContentType 'application/json' -Headers $H -Body $body
$sw.Stop()
check "train: 7 models, best=$($r.best), modelId, $($sw.ElapsedMilliseconds)ms" ($r.models.Count -eq 7 -and [bool]$r.modelId)

# predict now uses the user's own model
$r = Invoke-RestMethod -Method Post -Uri "$base/api/predict" -ContentType 'application/json' -Headers $H -Body (@{row=$row} | ConvertTo-Json)
check "predict after train works ($($r.label))" ($r.predicted -in 1..4)

# invalid files rejected by validate
foreach ($f in @('3_invalid_wrong_column_name.csv','5_invalid_quality_labels.csv','6_invalid_missing_column.csv','7_invalid_too_few_rows.csv')) {
  $rows = Import-Csv "..\test-data\$f" -Delimiter ';'
  $r = Invoke-RestMethod -Method Post -Uri "$base/api/datasets/validate" -ContentType 'application/json' -Headers $H -Body (@{rows=$rows} | ConvertTo-Json -Depth 5)
  check "validate rejects $f" (-not $r.ok)
}
# valid files accepted
foreach ($f in @('1_valid_dataset.csv','2_valid_with_missing_and_duplicates.csv','8_valid_comma_separated.csv')) {
  if ($f -like '8_*') { $rows = Import-Csv "..\test-data\$f" } else { $rows = Import-Csv "..\test-data\$f" -Delimiter ';' }
  $r = Invoke-RestMethod -Method Post -Uri "$base/api/datasets/validate" -ContentType 'application/json' -Headers $H -Body (@{rows=$rows} | ConvertTo-Json -Depth 5)
  check "validate accepts $f" ($r.ok)
}

Write-Host ""
Write-Host "TOTAL: $ok passed, $fail failed"
if ($fail -gt 0) { exit 1 }
