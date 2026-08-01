<?php
require __DIR__.'/common.php';
csrf_check();
$b = body();
$id = (string)($b['id'] ?? '');
$reason = substr((string)($b['reason'] ?? 'manual'), 0, 24);
$exit = round((float)($b['exit'] ?? 0), 2);
if (!$id || $exit <= 0) json_err('Paramètres invalides');

$p = db_select('SELECT * FROM positions WHERE id=?', [$id]);
if (!$p) json_err('Position introuvable', 404);

$side = $p['side'];
$entry = (float)$p['entry'];
$size  = (float)$p['size'];
$sl = (float)$p['sl']; $tp = (float)$p['tp'];
$dir = $side === 'L' ? 1 : -1;
$pnl = round(($exit - $entry) * $dir * $size, 2);
$openedAt = $p['opened_at'];
$source = $p['source'];

db_exec('DELETE FROM positions WHERE id=?', [$id]);
db_exec(
  'INSERT INTO trades (pos_id,source,side,size,entry,exit,sl,tp,pnl,reason,opened_at,closed_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  [$id,$source,$side,$size,$entry,$exit,$sl,$tp,$pnl,$reason,$openedAt,date('Y-m-d H:i:s.v')]
);

// Si c'est une position bot, MAJ bot_state
if ($source === 'bot') {
    db_exec('UPDATE bot_state SET
             wins = wins + ' . ($pnl>=0?1:0) . ',
             losses = losses + ' . ($pnl<0?1:0) . ',
             gross_win = gross_win + ' . ($pnl>=0?$pnl:0) . ',
             gross_loss = gross_loss + ' . ($pnl<0?-$pnl:0) . ',
             best_trade = GREATEST(best_trade, ' . $pnl . '),
             worst_trade = LEAST(worst_trade, ' . $pnl . ')');
}

log_event($source, $pnl>=0?'ok':'bad',
  "Fermeture $id $side @ $exit → " . ($pnl>=0?'+':'') . "$pnl USDT ($reason)");

json_out(['ok'=>true,'pnl'=>$pnl]);
