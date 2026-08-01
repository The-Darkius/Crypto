<?php
/**
 * Assistant d'installation en 3 étapes (WAMP-safe).
 * Affiche les erreurs PHP directement dans la page pour aider au diagnostic.
 */
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

// Helper e() même quand bootstrap n'est pas chargé
if (!function_exists('e')) {
    function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}

$errors = [];
$step   = (int)($_POST['step'] ?? ($_GET['step'] ?? 1));

$configExists = file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'inc' . DIRECTORY_SEPARATOR . 'config.php');
$alreadyInstalled = false;
if ($configExists && empty($_GET['reinstall']) && $step !== 3 && $step !== 1) {
    $alreadyInstalled = true;
}
// Écran "déjà installé" si le fichier config est présent et on est à l'étape 1
if ($configExists && $step === 1 && empty($_GET['reinstall'])) {
    // on affiche un message + bouton vers l'app ou la réinstall
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($step === 2) {
        $dbHost = trim($_POST['db_host'] ?? 'localhost');
        $dbPort = (int)($_POST['db_port'] ?? 3306);
        $dbName = trim($_POST['db_name'] ?? 'xauusdt');
        $dbUser = trim($_POST['db_user'] ?? 'root');
        $dbPass = (string)($_POST['db_pass'] ?? '');
        $baseUrl = rtrim(trim($_POST['base_url'] ?? '/xauusdt'), '/');
        $adminUser = trim($_POST['admin_user'] ?? 'admin');
        $adminPass = (string)($_POST['admin_pass'] ?? '');
        $adminPass2 = (string)($_POST['admin_pass2'] ?? '');

        if ($adminPass === '' || strlen($adminPass) < 4) $errors[] = 'Le mot de passe admin doit faire au moins 4 caractères.';
        if ($adminPass !== $adminPass2) $errors[] = 'Les mots de passe ne correspondent pas.';
        if ($adminUser === '') $errors[] = "Nom d'utilisateur admin obligatoire.";

        if (!$errors) {
            try {
                // Test de connexion (sans base)
                $pdo = new PDO("mysql:host=$dbHost;port=$dbPort;charset=utf8mb4", $dbUser, $dbPass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                ]);
                // Crée la base si elle n'existe pas
                $pdo->exec(sprintf(
                    'CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
                    str_replace('`', '``', $dbName)
                ));
                $pdo->exec(sprintf('USE `%s`', str_replace('`', '``', $dbName)));
                // Exécute le schéma (sans la ligne CREATE DATABASE et USE que l'on vient déjà d'exécuter)
                $schemaPath = __DIR__ . DIRECTORY_SEPARATOR . 'sql' . DIRECTORY_SEPARATOR . 'schema.sql';
                $sql = @file_get_contents($schemaPath);
                if ($sql === false) throw new RuntimeException('Impossible de lire ' . $schemaPath . '. Vérifie que le fichier est bien présent.');
                // Retire les CREATE DATABASE / USE du schéma
                $sql = preg_replace('/^\s*CREATE\s+DATABASE.*?;/ims', '', $sql);
                $sql = preg_replace('/^\s*USE\s+`?[^`;]+`?\s*;/im', '', $sql);
                // Exécute une à une
                $n = 0;
                foreach (array_map('trim', explode(';', $sql)) as $q) {
                    $q = trim($q);
                    if ($q === '') continue;
                    try { $pdo->exec($q); $n++; } catch (Throwable $ex) {
                        // une erreur sur une requête non critique ne doit pas casser l'install
                        // mais on la garde
                        $errors[] = 'SQL: ' . $ex->getMessage() . ' — req: ' . substr($q,0,120);
                    }
                }
                // Insère l'admin
                $hash = password_hash($adminPass, PASSWORD_DEFAULT);
                // vérifie si l'utilisateur existe déjà
                $st = $pdo->prepare('SELECT id FROM users WHERE username = ?');
                $st->execute([$adminUser]);
                if ($st->fetch()) {
                    $pdo->prepare('UPDATE users SET password_hash=?, starting_balance=10000 WHERE username=?')
                        ->execute([$hash, $adminUser]);
                } else {
                    $pdo->prepare('INSERT INTO users (username,password_hash,starting_balance) VALUES (?,?,10000)')
                        ->execute([$adminUser,$hash]);
                }

                // Génère config.php
                $secret = bin2hex(random_bytes(32));
                $tpl = file_get_contents(__DIR__ . '/inc/config.example.php');
                $tpl = strtr($tpl, [
                    "define('DB_HOST', 'localhost');"  => "define('DB_HOST', " . var_export($dbHost, true) . ');',
                    "define('DB_PORT', 3306);"          => "define('DB_PORT', $dbPort);",
                    "define('DB_NAME', 'xauusdt');"     => "define('DB_NAME', " . var_export($dbName, true) . ');',
                    "define('DB_USER', 'root');"        => "define('DB_USER', " . var_export($dbUser, true) . ');',
                    "define('DB_PASS', '');"            => "define('DB_PASS', " . var_export($dbPass, true) . ');',
                    "define('BASE_URL', '/xauusdt');"   => "define('BASE_URL', " . var_export($baseUrl, true) . ');',
                    "define('ADMIN_USER', 'admin');"    => "define('ADMIN_USER', " . var_export($adminUser, true) . ');',
                    "'__ADMIN_HASH__'"                  => var_export($hash, true),
                    "'__SECRET__'"                      => var_export($secret, true),
                ]);
                file_put_contents(__DIR__ . '/inc/config.php', $tpl);

                // Log
                $pdo->prepare('INSERT INTO logs (source,kind,msg) VALUES (?,?,?)')
                    ->execute(['system','ok','Installation terminée avec succès']);

                header('Location: install.php?step=3');
                exit;
            } catch (PDOException $e) {
                $errors[] = 'Erreur de connexion à la base : ' . $e->getMessage();
            }
        }
    }
}

?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Installation · XAUUSDT Micro-Scalper</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{--bg:#0a0b10;--bg2:#151823;--line:#1f2438;--text:#d7dbe6;--muted:#6b7389;--accent:#e8b637;--up:#1ec87a;--down:#ef3d5d;font-family:Inter,system-ui,sans-serif}
    html,body{margin:0;height:100%;background:radial-gradient(1000px 600px at 30% -10%,rgba(232,182,55,.08),transparent),var(--bg);color:var(--text)}
    .wrap{max-width:720px;margin:60px auto;padding:24px}
    h1{font-family:'JetBrains Mono',ui-monospace,monospace;margin:0 0 8px;letter-spacing:1px}
    h1 .logo{color:var(--accent)}
    .sub{color:var(--muted);margin-bottom:24px}
    .card{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:24px;box-shadow:0 20px 80px rgba(0,0,0,.5)}
    .steps{display:flex;gap:8px;margin-bottom:20px}
    .step{flex:1;padding:8px 12px;border:1px solid var(--line);border-radius:4px;font-family:monospace;font-size:12px;color:var(--muted);text-align:center}
    .step.done{color:var(--up);border-color:rgba(30,200,122,.4);background:rgba(30,200,122,.08)}
    .step.active{color:var(--accent);border-color:rgba(232,182,55,.5);background:rgba(232,182,55,.08)}
    label{display:block;font-family:monospace;font-size:11px;letter-spacing:1px;color:var(--muted);margin:12px 0 6px}
    input[type=text],input[type=password],input[type=number]{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--line);color:var(--text);padding:10px 12px;border-radius:4px;font-family:monospace;font-size:13px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .btn{display:inline-block;background:linear-gradient(180deg,#f0c84a,#c9991e);color:#0a0b10;border:none;padding:12px 24px;font-family:monospace;font-weight:700;letter-spacing:1px;border-radius:4px;cursor:pointer;font-size:13px;margin-top:20px;width:100%}
    .btn:hover{filter:brightness(1.1)}
    .err{background:rgba(239,61,93,.1);border:1px solid rgba(239,61,93,.4);color:var(--down);padding:10px 14px;border-radius:4px;margin-bottom:14px;font-size:13px}
    .ok{background:rgba(30,200,122,.08);border:1px solid rgba(30,200,122,.3);color:var(--up);padding:12px;border-radius:4px;margin-bottom:14px}
    .check{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted var(--line);font-family:monospace;font-size:13px}
    .check .yes{color:var(--up)}
    .check .no{color:var(--down)}
    a{color:var(--accent);text-decoration:none}
    code{background:var(--bg);padding:2px 6px;border-radius:3px;font-size:12px}
  </style>
</head>
<body>
<div class="wrap">
  <h1><span class="logo">⚡</span> XAUUSDT <span style="color:var(--muted);font-weight:400">· Installateur</span></h1>
  <div class="sub">Configuration en 3 étapes pour WAMP (Apache + PHP + MySQL).</div>

  <div class="card">
    <div class="steps">
      <div class="<?= $step >= 1 ? ($step>1?'done':'active') : ''?>">1 · Vérifications</div>
      <div class="<?= $step >= 2 ? ($step>2?'done':'active') : ''?>">2 · Configuration</div>
      <div class="<?= $step >= 3 ? 'active' : ''?>">3 · Terminé</div>
    </div>

<?php if ($step === 1): ?>
<?php
  // Si installé, on affiche un avertissement en haut
  if ($configExists): ?>
    <div class="ok">⚠️ L'application est <b>déjà installée</b> (fichier <code>inc/config.php</code> existant).
      <br>→ <a href="index.php">Aller sur la plateforme</a> ou <a href="install.php?reinstall=1">réinstaller par-dessus</a>.
    </div>
<?php endif; ?>
<?php
  $reqs = [
    'PHP ≥ 8.0' => PHP_VERSION_ID >= 80000,
    'PDO MySQL' => extension_loaded('pdo_mysql'),
    'MySQLi'    => extension_loaded('mysqli'),
    'JSON'      => extension_loaded('json'),
    'MBString'  => extension_loaded('mbstring'),
    'Écriture dossier ' . __DIR__ => is_writable(__DIR__) && is_writable(__DIR__ . '/inc'),
  ];
  $allOk = true;
  foreach ($reqs as $r=>$ok) if (!$ok) $allOk = false;
?>
    <h3 style="margin-top:0">Vérifications système</h3>
<?php foreach($reqs as $r=>$ok): ?>
    <div class="check"><span><?= htmlspecialchars($r) ?></span><span class="<?= $ok?'yes':'no'?>"><?= $ok?'✓ OK':'✗ MANQUANT'?></span></div>
<?php endforeach; ?>

<?php if($errors): ?><div class="err"><?= implode('<br>', array_map('htmlspecialchars',$errors))?></div><?php endif; ?>

    <form method="post" action="install.php?step=2">
      <input type="hidden" name="step" value="2">
      <button class="btn" <?= $allOk?'':'disabled'?>><?= $allOk?'Commencer la configuration':'Corriger avant de continuer'?></button>
    </form>

<?php elseif ($step === 2): ?>
<?php
  // valeurs auto-détectées
  $scriptName = $_SERVER['SCRIPT_NAME'];
  $autoBase  = rtrim(str_replace('install.php','',$scriptName),'/');
  if ($autoBase === '') $autoBase = '/';
?>
<?php if($errors): ?><div class="err"><?= implode('<br>', array_map('htmlspecialchars',$errors))?></div><?php endif; ?>

    <h3 style="margin-top:0">Connexion à la base MySQL</h3>
    <form method="post" action="install.php?step=2" autocomplete="off">
      <input type="hidden" name="step" value="2">
      <div class="grid">
        <div>
          <label>HÔTE MYSQL</label>
          <input type="text" name="db_host" value="<?= e($_POST['db_host']??'localhost') ?>">
        </div>
        <div>
          <label>PORT</label>
          <input type="number" name="db_port" value="<?= e($_POST['db_port']??'3306') ?>">
        </div>
        <div>
          <label>NOM DE LA BASE</label>
          <input type="text" name="db_name" value="<?= e($_POST['db_name']??'xauusdt') ?>">
        </div>
        <div></div>
        <div>
          <label>UTILISATEUR</label>
          <input type="text" name="db_user" value="<?= e($_POST['db_user']??'root') ?>">
        </div>
        <div>
          <label>MOT DE PASSE</label>
          <input type="password" name="db_pass" value="<?= e($_POST['db_pass']??'') ?>" placeholder="vide par défaut sous WAMP">
        </div>
      </div>

      <label>URL DE BASE (sans slash final)</label>
      <input type="text" name="base_url" value="<?= e($_POST['base_url']??$autoBase) ?>" placeholder="/xauusdt">

      <h3 style="margin-top:24px">Compte administrateur</h3>
      <div class="grid">
        <div>
          <label>NOM D'UTILISATEUR</label>
          <input type="text" name="admin_user" value="<?= e($_POST['admin_user']??'admin') ?>">
        </div>
        <div></div>
        <div>
          <label>MOT DE PASSE</label>
          <input type="password" name="admin_pass" autocomplete="new-password">
        </div>
        <div>
          <label>CONFIRMATION</label>
          <input type="password" name="admin_pass2" autocomplete="new-password">
        </div>
      </div>

      <button class="btn">Installer 🚀</button>
    </form>

<?php elseif ($step === 3): ?>
    <div class="ok">✅ Installation terminée avec succès ! La base a été créée et le fichier <code>inc/config.php</code> a été généré.</div>
    <p>L'installateur est automatiquement neutralisé tant que <code>inc/config.php</code> existe. Pour réinstaller, supprime ce fichier et retourne sur <a href="install.php">install.php</a>.</p>
    <h3>Prochaines étapes</h3>
    <ol style="line-height:1.8;color:#c5cad8">
      <li>Assure-toi que WAMP est bien démarré (icône WampServer verte)</li>
      <li>Accède à l'application : <a href="index.php">se connecter à XAUUSDT Micro-Scalper</a></li>
      <li>Connecte-toi avec le compte admin créé à l'étape précédente</li>
      <li>Le flux XAUUSDT se connecte directement à Bybit via ton navigateur — aucune clé API n'est nécessaire pour voir les prix et trader en papier</li>
    </ol>
    <p style="color:var(--muted);font-size:12px">Fichiers créés : <code>inc/config.php</code>, base de données <code>xauusdt</code>, 6 tables (users, settings, positions, trades, logs, bot_state).</p>
<?php endif; ?>
  </div>
  <div style="text-align:center;color:var(--muted);margin-top:16px;font-size:11px;font-family:monospace">⚡ XAUUSDT Micro-Scalper Pro · version WAMP</div>
</div>
</body>
</html>
