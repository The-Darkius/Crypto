<?php
require __DIR__.'/common.php';
csrf_check();
$b = body();

$source = (($b['source'] ?? 'manual') === 'bot') ? 'bot' : 'manual';
$side   = (($b['side'] ?? 'L') === 'S') ? 'S' : 'L';
$size   = round((float)($b['size'] ?? 0), 3);
$entry  = round((float)($b['entry'] ?? 0), 2);
$sl     = round((float)($b['sl'] ?? 0), 2);
$tp     = round((float)($b['tp'] ?? 0), 2);
$lev    = max(1, min(125, (int)($b['lev'] ?? 10)));
$trail  = round((float)($b['trail'] ?? 0), 2);

if ($size <= 0 || $entry <= 0 || $sl <= 0 || $tp <= 0) json_err('Paramètres invalides');

$id = strtoupper(($source === 'bot' ? 'B' : 'M') . bin2hex(random_bytes(3)));
$id = substr($id, 0, 8);

$ok = db_exec(
  'INSERT INTO positions (id,source,side,size,entry,sl,tp,lev,trail_pips,peak,opened_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  [$id,$source,$side,$size,$entry,$sl,$tp,$lev,$trail,$entry,date('Y-m-d H:i:s.v')]
);

if ($ok) {
    log_event($source, 'ok', ($side==='L'?'LONG':'SHORT')." ouvert: $size oz @ $entry SL=$sl TP=$tp id=$id");
    json_out(['ok'=>true,'id'=>$id]);
} else {
    json_err("Impossible d'ouvrir la position (DB en erreur ? Lance test.php)", 500);
}
