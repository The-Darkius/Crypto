<?php
/**
 * ⚡ XAUUSDT Micro-Scalper — Fichier de configuration
 * Généré automatiquement par install.php.
 *
 * Ne pas éditer à la main : relancer install.php si besoin (supprimer config.php).
 */

// Base de données MySQL
define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'xauusdt');
define('DB_USER', 'root');
define('DB_PASS', '');           // root vide par défaut sous WAMP ; à changer en prod

// Chemins
define('BASE_URL', '/xauusdt');  // URL relative (ex: '/xauusdt' si tu accèdes par http://localhost/xauusdt/)

// Compte admin
define('ADMIN_USER', 'admin');
define('ADMIN_PASS_HASH', '__ADMIN_HASH__'); // sera remplacé par l'installeur

// Sécurité session
define('SECRET_KEY', '__SECRET__');
