<?php
require __DIR__.'/common.php';

$startBal = (float)setting_get('starting_balance', 10000);

$positions = db_all('SELECT * FROM positions ORDER BY opened_at ASC');
$statsManual = db_select("SELECT
  COUNT(*) AS n,
  SUM(pnl) AS net,
  SUM(CASE WHEN pnl>=0 THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN pnl<0 THEN 1 ELSE 0 END) AS losses,
  SUM(CASE WHEN pnl>=0 THEN pnl ELSE 0 END) AS gross_win,
  SUM(CASE WHEN pnl<0 THEN -pnl ELSE 0 END) AS gross_loss,
  MAX(pnl) AS best, MIN(pnl) AS worst
  FROM trades WHERE source='manual'");
if (!$statsManual) $statsManual = ['n'=>0,'wins'=>0,'losses'=>0,'net'=>0,'gross_win'=>0,'gross_loss'=>0,'best'=>0,'worst'=>0];

$netManual = (float)($statsManual['net'] ?? 0);
$balance = $startBal + $netManual;

$maxdd = 0; $peak = $startBal; $eq = $startBal;
$curve = [$eq];
foreach (db_all("SELECT pnl FROM trades WHERE source='manual' ORDER BY closed_at ASC") as $t) {
    $eq += (float)$t['pnl'];
    $curve[] = round($eq,2);
    if ($eq > $peak) $peak = $eq;
    $dd = $peak > 0 ? ($peak - $eq)/$peak*100 : 0;
    if ($dd > $maxdd) $maxdd = $dd;
}

$botState = db_select('SELECT * FROM bot_state WHERE id=1');
$botOut = null;
if ($botState) {
    $botState['config'] = json_decode($botState['config'] ?? '{}', true) ?: [];
    unset($botState['id']);
    $botPosRaw = db_all("SELECT * FROM positions WHERE source='bot' ORDER BY opened_at ASC");
    $botPos = [];
    foreach ($botPosRaw as $p) {
        $botPos[] = [
            'id'=>$p['id'],'side'=>$p['side'],'size'=>(float)$p['size'],
            'entry'=>(float)$p['entry'],'sl'=>(float)$p['sl'],'tp'=>(float)$p['tp'],
            'peak'=>(float)$p['peak'],'trail'=>(float)$p['trail_pips'],'lev'=>(int)$p['lev'],
            'openedAt'=>$p['opened_at']?(int)(strtotime($p['opened_at'])*1000):0,
        ];
    }
    $botNRow = db_select("SELECT COUNT(*) n FROM trades WHERE source='bot'");
    $botOut = array_merge($botState, [
        'positions' => $botPos,
        'nTrades' => (int)($botNRow['n'] ?? 0),
    ]);
}

$positionsOut = [];
$manualPos = []; $botPosFlat = [];
foreach ($positions as $p) {
    $m = [
        'id'=>$p['id'],'source'=>$p['source'],'side'=>$p['side'],
        'size'=>(float)$p['size'],'entry'=>(float)$p['entry'],
        'sl'=>(float)$p['sl'],'tp'=>(float)$p['tp'],
        'lev'=>(int)$p['lev'],'trail'=>(float)$p['trail_pips'],
        'peak'=>(float)$p['peak'],'openedAt'=>$p['opened_at']?(int)(strtotime($p['opened_at'])*1000):0,
    ];
    $positionsOut[] = $m;
    if ($p['source'] === 'manual') $manualPos[] = $m; else $botPosFlat[] = $m;
}

$logs = db_all('SELECT source,kind,msg,ts FROM logs ORDER BY ts DESC LIMIT 60');

json_out([
    'ok' => true,
    'startBalance' => $startBal,
    'balance' => round($balance,2),
    'equity' => round($balance,2),
    'positions' => $positionsOut,
    'manualPositions' => $manualPos,
    'botPositions' => $botPosFlat,
    'stats' => [
        'manual' => [
            'n' => (int)$statsManual['n'],
            'wins' => (int)$statsManual['wins'],
            'losses' => (int)$statsManual['losses'],
            'net' => round((float)($statsManual['net']??0),2),
            'grossWin' => round((float)($statsManual['gross_win']??0),2),
            'grossLoss' => round((float)($statsManual['gross_loss']??0),2),
            'best' => round((float)($statsManual['best']??0),2),
            'worst' => round((float)($statsManual['worst']??0),2),
            'maxDD' => round($maxdd,2),
            'equity' => $curve,
        ],
    ],
    'bot' => $botOut,
    'logs' => $logs,
]);
