<?php
/**
 * Bootstrap de l'application.
 * Fonctionne même quand config.php n'existe pas encore (utilisé pour la redirection install.php).
 */

// Démarrage session (le plus tôt possible, avant tout output)
if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_NONE) {
    // Paramètres cookie sûrs
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    @session_start();
}

// Fonction d'échappement HTML (defensive, au cas où mbstring ne serait pas activé)
if (!function_exists('e')) {
    function e($s): string {
        return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    }
}

// Redirection vers l'installateur si config.php n'existe pas encore
$configFile = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
$configExists = @file_exists($configFile);

// Calcul de l'URL de base auto si pas de config
function base_url_auto(): string {
    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    if ($scriptDir === '/' || $scriptDir === '.') return '';
    return rtrim($scriptDir, '/');
}

if (!$configExists) {
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    $isInstall = (stripos($script, 'install.php') !== false);
    $isTest    = (stripos($script, 'test.php') !== false);
    if (!$isInstall && !$isTest) {
        $base = base_url_auto();
        header('Location: ' . ($base === '' ? '/' : $base) . '/install.php');
        exit;
    }
    return; // pendant l'install on n'a pas encore la config, on s'arrête là
}

// Charge la config et la DB
require_once $configFile;
require_once __DIR__ . DIRECTORY_SEPARATOR . 'db.php';

/** Réponse JSON */
function json_out($data, int $code = 200): void {
    if (headers_sent()) return;
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function json_err(string $msg, int $code = 400): void {
    json_out(['ok' => false, 'error' => $msg], $code);
}

/** Authentification */
function is_logged(): bool {
    return !empty($_SESSION['logged']) && $_SESSION['logged'] === true;
}
function require_login(): void {
    if (!is_logged()) {
        json_err('Authentification requise', 401);
    }
}
function login(string $u, string $p): bool {
    if (!defined('ADMIN_USER')) return false;
    if ($u === ADMIN_USER && function_exists('password_verify') && @password_verify($p, ADMIN_PASS_HASH)) {
        @session_regenerate_id(true);
        $_SESSION['logged'] = true;
        $_SESSION['user']   = $u;
        return true;
    }
    // Vérifie aussi en base (multi-comptes)
    try {
        $row = db_select('SELECT password_hash FROM users WHERE username = ?', [$u]);
        if ($row && function_exists('password_verify') && @password_verify($p, $row['password_hash'])) {
            @session_regenerate_id(true);
            $_SESSION['logged'] = true;
            $_SESSION['user']   = $u;
            return true;
        }
    } catch (Throwable $th) {
        // table users peut ne pas exister pendant une réinstall partielle
    }
    return false;
}
function logout(): void {
    $_SESSION = [];
    if (PHP_SAPI !== 'cli' && ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        @setcookie(session_name(), '', time() - 42000, $p['path'] ?? '/', $p['domain'] ?? '', $p['secure'] ?? false, $p['httponly'] ?? true);
    }
    @session_destroy();
}

function log_event(string $source, string $kind, string $msg): void {
    try {
        if (function_exists('db_exec')) {
            @db_exec('INSERT INTO logs (source,kind,msg) VALUES (?,?,?)', [substr($source,0,10), $kind, substr($msg,0,1000)]);
        }
    } catch (Throwable $th) {
        // silencieux — évite de casser l'appli pendant l'install
    }
}

// CSRF
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
