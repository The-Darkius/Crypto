<?php
require __DIR__.'/common.php';
csrf_check();
$b = body();
$action = (string)($b['action'] ?? 'get');

$state = db_select('SELECT * FROM bot_state WHERE id=1');
if (!$state) json_err('bot_state manquant', 500);
$cfg = json_decode($state['config'], true) ?: [];

if ($action === 'config' || $action === 'start') {
    if (isset($b['config']) && is_array($b['config'])) {
        foreach ($b['config'] as $k=>$v) {
            if (array_key_exists($k, $cfg)) $cfg[$k] = is_numeric($v) ? (float)$v : $v;
        }
        db_exec('UPDATE bot_state SET config=? WHERE id=1', [json_encode($cfg)]);
    }
}

if ($action === 'start') {
    db_exec("UPDATE bot_state SET status='on' WHERE id=1");
    log_event('bot','ok','Bot DÉMARRÉ');
} elseif ($action === 'pause') {
    db_exec("UPDATE bot_state SET status='pause' WHERE id=1");
    log_event('bot','info','Bot EN PAUSE');
} elseif ($action === 'stop') {
    // le client doit avoir fermé les positions avant de demander stop
    db_exec("UPDATE bot_state SET status='off' WHERE id=1");
    log_event('bot','info','Bot ARRÊTÉ');
} elseif ($action === 'reset') {
    db_exec("UPDATE bot_state SET status='off', balance=10000.00, wins=0, losses=0, gross_win=0, gross_loss=0, best_trade=0, worst_trade=0, peak_equity=10000.00, max_dd=0 WHERE id=1");
    db_exec("DELETE FROM positions WHERE source='bot'");
    db_exec("DELETE FROM trades WHERE source='bot'");
    log_event('bot','info','Bot RÉINITIALISÉ (balance 10 000)');
} elseif ($action === 'closeAll') {
    // le client se charge de clôturer (il faut le prix market pour le PnL),
    // on se contente de logger la demande
    log_event('bot','warn','Demande de fermeture de toutes les positions bot');
} elseif ($action === 'state') {
    // si le client renvoie la balance / DD courants (calcul tick par tick) on les sauve
    if (isset($b['balance'])) {
        $bal = round((float)$b['balance'],2);
        db_exec('UPDATE bot_state SET balance=?, peak_equity=GREATEST(peak_equity,?), max_dd=? WHERE id=1',
            [$bal, $bal, round((float)($b['maxDD'] ?? 0),4)]);
    }
}

$st = db_select('SELECT * FROM bot_state WHERE id=1');
if (!$st) json_err('bot_state manquant', 500);
$st['config'] = json_decode($st['config'] ?? '{}', true) ?: [];
$positionsDb = db_all("SELECT * FROM positions WHERE source='bot'");
$positionsOut = [];
foreach ($positionsDb as $p) {
    $positionsOut[] = [
        'id'=>$p['id'],'side'=>$p['side'],'size'=>(float)$p['size'],
        'entry'=>(float)$p['entry'],'sl'=>(float)$p['sl'],'tp'=>(float)$p['tp'],
        'peak'=>(float)$p['peak'],'trail'=>(float)$p['trail_pips'],'lev'=>(int)$p['lev'],
        'openedAt'=>$p['opened_at'] ? (int)(strtotime($p['opened_at'])*1000) : 0,
    ];
}
$st['positions'] = $positionsOut;
$nRow = db_select("SELECT COUNT(*) n FROM trades WHERE source='bot'");
$st['nTrades'] = (int)($nRow['n'] ?? 0);
unset($st['id']);

json_out(['ok'=>true,'bot'=>$st]);
