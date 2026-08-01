<?php
/**
 * 🩺 Diagnostic XAUUSDT Micro-Scalper
 * Ouvre http://localhost/xauusdt/test.php pour vérifier ta configuration WAMP
 * si install.php renvoie une erreur 500. Ce fichier peut être supprimé ensuite.
 */
ini_set('display_errors', '1');
error_reporting(E_ALL);

$checks = [];
$ok = true;

$checks['PHP >= 8.0'] = [ PHP_VERSION_ID >= 80000, 'Version actuelle : ' . PHP_VERSION ];
$checks['Extension PDO'] = [ extension_loaded('pdo'), 'pdo chargée' ];
$checks['Extension PDO MySQL'] = [ extension_loaded('pdo_mysql'), 'pdo_mysql nécessaire' ];
$checks['Extension JSON'] = [ extension_loaded('json'), 'json chargée' ];
$checks['Extension MBstring'] = [ extension_loaded('mbstring'), 'mbstring (optionnel mais recommandé)' ];
$checks['Fonction password_hash()'] = [ function_exists('password_hash'), 'pour le hash du mot de passe admin' ];
$checks['Dossier inc/ accessible en écriture'] = [ is_writable(__DIR__ . '/inc'), 'pour créer inc/config.php' ];
$checks['Fichier sql/schema.sql lisible'] = [ is_readable(__DIR__ . '/sql/schema.sql'), 'schéma BDD' ];
$checks['Le dossier ./ est accessible en écriture'] = [ is_writable(__DIR__), 'logs / future màj' ];

// Test connexion MySQL avec valeurs par défaut WAMP
$mysql = ['host'=>'localhost','port'=>3306,'user'=>'root','pass'=>''];
$mysqlOk = false; $mysqlDetail = '';
try {
    $pdo = new PDO("mysql:host={$mysql['host']};port={$mysql['port']};charset=utf8mb4", $mysql['user'], $mysql['pass'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $mysqlOk = true;
    $mysqlDetail = 'Connexion MySQL OK avec root / mot de passe vide (défaut WAMP)';
} catch (PDOException $e) {
    // Essaye port 3308 (WAMP utilise parfois 3308 si MariaDB/MySQL cohabitent)
    try {
        $pdo = new PDO("mysql:host=localhost;port=3308;charset=utf8mb4", 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $mysqlOk = true;
        $mysql['port'] = 3308;
        $mysqlDetail = 'Connexion MySQL OK sur le port 3308 (WAMP alternatif)';
    } catch (PDOException $e2) {
        $mysqlDetail = 'Impossible de se connecter à MySQL : ' . $e->getMessage();
    }
}
$checks['Connexion MySQL (root / vide / localhost)'] = [ $mysqlOk, $mysqlDetail ];

// Existe-t-il une config ?
$configPath = __DIR__ . '/inc/config.php';
$checks['inc/config.php existe déjà'] = [ file_exists($configPath), file_exists($configPath) ? 'installation déjà effectuée' : 'pas encore installé' ];

// Charger parse test de install.php syntaxe (sans l'exécuter)
$installOk = (bool)@php_check_syntax(__DIR__ . '/install.php');
if (function_exists('php_check_syntax')) {
    $checks['install.php syntaxiquement valide'] = [ $installOk, '' ];
} else {
    $checks['(php -l install.php à lancer en console pour valider la syntaxe)'] = [true, ''];
}

// Vérifier les modules Apache
if (function_exists('apache_get_modules')) {
    $mods = apache_get_modules();
    $checks['Apache mod_rewrite'] = [ in_array('mod_rewrite', $mods), in_array('mod_rewrite',$mods)?'activé':'désactivé (non bloquant)' ];
} else {
    $checks['Apache modules'] = [true, 'impossible de lister (pas Apache/CGI)' ];
}
?><!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Diagnostic XAUUSDT</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;background:#0a0b10;color:#d7dbe6;margin:0;padding:40px}
h1{font-family:monospace;color:#e8b637}
.wrap{max-width:760px;margin:auto;background:#151823;border:1px solid #1f2438;padding:24px;border-radius:8px}
.check{display:flex;justify-content:space-between;padding:10px;border-bottom:1px dotted #1f2438;font-family:monospace;font-size:13px}
.yes{color:#1ec87a} .no{color:#ef3d5d} .warn{color:#e8b637}
.box{margin-top:20px;padding:12px;background:#0f1118;border:1px solid #1f2438;border-radius:4px;font-family:monospace;font-size:12px;line-height:1.7;color:#8b92a8}
code{background:#0f1118;padding:2px 6px;border-radius:3px;color:#e8b637}
a{color:#e8b637}
</style></head><body>
<div class="wrap">
<h1>⚡ Diagnostic XAUUSDT Micro-Scalper</h1>
<p>Si tous les voyants sont au vert, <a href="install.php">retente l'installation</a>.</p>
<?php foreach ($checks as $name => list($isOk, $detail)): ?>
  <div class="check">
    <span><?= htmlspecialchars($name) ?></span>
    <span class="<?= $isOk ? 'yes' : 'no' ?>"><?= $isOk ? '✓ OK' : '✗ ERREUR' ?> <?php if($detail):?> <small style="color:#8b92a8;margin-left:10px"><?= htmlspecialchars($detail) ?></small><?php endif ?></span>
  </div>
<?php $ok = $ok && $isOk; endforeach; ?>

<div class="box">
<b style="color:#fff">Si tu vois une erreur 500 sur install.php :</b><br>
1. Vérifie que <code>C:\wamp64\bin\php\phpx.y.z\php.ini</code> a <code>display_errors = On</code> (ligne non commentée).<br>
2. Ouvre un terminal WAMP et lance <code>cd C:\wamp64\www\xauusdt</code> puis <code>php -l install.php</code> — ça affichera la ligne exacte qui plante.<br>
3. Regarde le log Apache : <code>C:\wamp64\logs\apache_error.log</code> ou <code>C:\wamp64\logs\php_error.log</code>, tu auras la vraie erreur.<br>
4. Si la connexion MySQL échoue avec root/vide : tu as défini un mot de passe root MySQL pendant l'install de WAMP ? Reprends le champ "Mot de passe" avec ton mot de passe.<br>
5. Le port MySQL par défaut WAMP est parfois <b>3308</b> et non 3306 (ça s'affiche dans WampServer > MySQL > Service).
</div>
</div></body></html>
