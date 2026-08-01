<?php
require __DIR__.'/common.php';
csrf_check();
$b = body();
$id = (string)($b['id'] ?? '');
if (!$id) json_err('id requis');

$fields = []; $params = [];
foreach (['sl','tp','peak'] as $k) {
    if (isset($b[$k])) { $fields[] = "$k=?"; $params[] = round((float)$b[$k],2); }
}
if (!$fields) json_err('aucun champ à mettre à jour');
$params[] = $id;
db_exec("UPDATE positions SET " . implode(',', $fields) . " WHERE id=?", $params);
json_out(['ok'=>true]);
