<?php
/**
 * Connexion PDO MySQL singleton.
 * Toutes les fonctions sont silencieuses-échec-safe pour ne jamais planter avant la config.
 */
function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    if (!defined('DB_HOST')) {
        throw new RuntimeException('Configuration DB absente. Exécute install.php.');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Force l'encodage (au cas où le DSN charset ne suffirait pas avec certaines versions)
        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch (PDOException $e) {
        throw $e;
    }
    return $pdo;
}

function db_select(string $sql, array $params = []) {
    try {
        $st = db()->prepare($sql);
        $st->execute($params);
        $r = $st->fetch();
        return $r ?: null;
    } catch (Throwable $th) {
        return null;
    }
}
function db_all(string $sql, array $params = []): array {
    try {
        $st = db()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll() ?: [];
    } catch (Throwable $th) {
        return [];
    }
}
function db_exec(string $sql, array $params = []): int {
    try {
        $st = db()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    } catch (Throwable $th) {
        return 0;
    }
}

function setting_get(string $k, $default = null) {
    try {
        $r = db_select('SELECT v FROM settings WHERE k = ?', [$k]);
        return $r ? $r['v'] : $default;
    } catch (Throwable $th) {
        return $default;
    }
}
function setting_set(string $k, string $v): void {
    @db_exec('INSERT INTO settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [$k,$v]);
}
