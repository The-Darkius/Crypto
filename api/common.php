<?php
ini_set('display_errors', '0'); // les APIs renvoient du JSON, pas d'HTML d'erreur dedans
require __DIR__ . '/../inc/bootstrap.php';

if (!function_exists('is_logged') || !is_logged()) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    echo json_encode(['ok'=>false,'error'=>'Authentification requise']);
    exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
}
function csrf_check(): void {
    $b = body();
    $hdr = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($b['csrf'] ?? '');
    if (!isset($_SESSION['csrf'])) {
        json_err('Session expirée, recharge la page', 403);
    }
    if (!is_string($hdr) || !hash_equals((string)$_SESSION['csrf'], $hdr)) {
        json_err('Token CSRF invalide, recharge la page', 403);
    }
}
