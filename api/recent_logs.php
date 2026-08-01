<?php
require __DIR__.'/common.php';
$n = min(200, max(10, (int)($_GET['n'] ?? 60)));
$logs = db_all('SELECT source,kind,msg,ts FROM logs ORDER BY ts DESC LIMIT ?', [$n]);
json_out(['ok'=>true,'logs'=>$logs]);
