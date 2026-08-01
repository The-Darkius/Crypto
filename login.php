<?php require __DIR__.'/inc/bootstrap.php';

$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $u = trim($_POST['u'] ?? '');
    $p = (string)($_POST['p'] ?? '');
    if (login($u, $p)) {
        header('Location: index.php'); exit;
    } else {
        $err = 'Identifiants incorrects.';
    }
}
if (is_logged()) { header('Location: index.php'); exit; }
?><!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Connexion · XAUUSDT</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#0a0b10;--bg2:#151823;--line:#1f2438;--text:#d7dbe6;--muted:#6b7389;--accent:#e8b637;--up:#1ec87a;--down:#ef3d5d;font-family:Inter,system-ui,sans-serif}
html,body{margin:0;height:100%;background:radial-gradient(800px 500px at 50% -10%,rgba(232,182,55,.12),transparent),var(--bg);color:var(--text);display:flex;align-items:center;justify-content:center}
.card{background:var(--bg2);border:1px solid var(--line);padding:32px;border-radius:8px;width:380px;box-shadow:0 20px 80px rgba(0,0,0,.5)}
h1{font-family:'JetBrains Mono',ui-monospace,monospace;margin:0 0 6px;letter-spacing:1px}.logo{color:var(--accent)}
.sub{color:var(--muted);margin-bottom:22px;font-size:12px}
label{display:block;font-family:monospace;font-size:10px;letter-spacing:1.2px;color:var(--muted);margin:12px 0 6px}
input{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--line);color:var(--text);padding:12px;border-radius:4px;font-family:monospace;font-size:14px}
button{width:100%;background:linear-gradient(180deg,#f0c84a,#c9991e);color:#0a0b10;border:none;padding:13px;font-family:monospace;font-weight:700;letter-spacing:1px;border-radius:4px;cursor:pointer;font-size:13px;margin-top:20px}
button:hover{filter:brightness(1.1)}
.err{background:rgba(239,61,93,.1);border:1px solid rgba(239,61,93,.4);color:var(--down);padding:10px;border-radius:4px;margin-bottom:12px;font-size:12px}
</style></head><body>
<form method="post" class="card">
  <h1><span class="logo">⚡</span> XAUUSDT <span style="color:var(--muted);font-weight:400">· Login</span></h1>
  <div class="sub">Connecte-toi pour accéder à la plateforme de micro-scalping.</div>
  <?php if($err): ?><div class="err"><?= htmlspecialchars($err)?></div><?php endif; ?>
  <label>NOM D'UTILISATEUR</label>
  <input name="u" autofocus autocomplete="username" required>
  <label>MOT DE PASSE</label>
  <input type="password" name="p" autocomplete="current-password" required>
  <button>SE CONNECTER</button>
</form></body></html>
