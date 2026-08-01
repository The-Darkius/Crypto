<?php
require __DIR__.'/common.php';
csrf_check();
$b = body();
$source = substr((string)($b['source'] ?? 'manual'), 0, 10);
$kind   = substr((string)($b['kind'] ?? 'info'), 0, 10);
$msg    = substr((string)($b['msg'] ?? ''), 0, 1000);
if (!in_array($kind, ['info','ok','bad','warn'], true)) $kind='info';
if (!in_array($source, ['manual','bot','system'], true)) $source='manual';
if ($msg === '') json_err('msg vide');
log_event($source, $kind, $msg);
json_out(['ok'=>true]);
