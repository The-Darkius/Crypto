-- XAUUSDT Micro-Scalper — Schéma MySQL
-- Généré automatiquement par install.php

CREATE DATABASE IF NOT EXISTS `xauusdt` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `xauusdt`;

-- Utilisateurs (compte admin pour la session locale WAMP)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `starting_balance` DECIMAL(14,2) NOT NULL DEFAULT 10000.00,
  `bybit_api_key` VARCHAR(128) DEFAULT NULL,
  `bybit_api_secret` VARCHAR(128) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Paramètres globaux (clé/valeur)
CREATE TABLE IF NOT EXISTS `settings` (
  `k` VARCHAR(64) NOT NULL PRIMARY KEY,
  `v` TEXT DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Positions actuellement ouvertes (pour pouvoir recharger la page sans perdre les trades)
CREATE TABLE IF NOT EXISTS `positions` (
  `id` VARCHAR(16) NOT NULL PRIMARY KEY,
  `source` ENUM('manual','bot') NOT NULL DEFAULT 'manual',
  `side` ENUM('L','S') NOT NULL,
  `size` DECIMAL(10,3) NOT NULL,
  `entry` DECIMAL(10,2) NOT NULL,
  `sl` DECIMAL(10,2) NOT NULL,
  `tp` DECIMAL(10,2) NOT NULL,
  `lev` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `trail_pips` DECIMAL(8,2) NOT NULL DEFAULT 0,
  `peak` DECIMAL(10,2) NOT NULL,
  `opened_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique complet des trades fermés
CREATE TABLE IF NOT EXISTS `trades` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pos_id` VARCHAR(16) NOT NULL,
  `source` ENUM('manual','bot') NOT NULL,
  `side` ENUM('L','S') NOT NULL,
  `size` DECIMAL(10,3) NOT NULL,
  `entry` DECIMAL(10,2) NOT NULL,
  `exit` DECIMAL(10,2) NOT NULL,
  `sl` DECIMAL(10,2) NOT NULL,
  `tp` DECIMAL(10,2) NOT NULL,
  `pnl` DECIMAL(12,2) NOT NULL,
  `reason` VARCHAR(24) NOT NULL,
  `opened_at` DATETIME(3) NOT NULL,
  `closed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_source` (`source`),
  KEY `idx_closed_at` (`closed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal d'événements (logs du bot + actions utilisateur)
CREATE TABLE IF NOT EXISTS `logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `source` ENUM('system','manual','bot') NOT NULL,
  `kind` ENUM('info','ok','bad','warn') NOT NULL DEFAULT 'info',
  `msg` TEXT NOT NULL,
  `ts` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_ts` (`ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- État persistant du bot (config, stats, balance) — une seule ligne
CREATE TABLE IF NOT EXISTS `bot_state` (
  `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  `status` ENUM('on','pause','off') NOT NULL DEFAULT 'off',
  `config` JSON NOT NULL,
  `balance` DECIMAL(14,2) NOT NULL DEFAULT 10000.00,
  `wins` INT UNSIGNED NOT NULL DEFAULT 0,
  `losses` INT UNSIGNED NOT NULL DEFAULT 0,
  `gross_win` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `gross_loss` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `best_trade` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `worst_trade` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `peak_equity` DECIMAL(14,2) NOT NULL DEFAULT 10000.00,
  `max_dd` DECIMAL(7,4) NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Valeurs par défaut
INSERT INTO `bot_state` (`id`,`status`,`config`,`balance`) VALUES
(1,'off','{"size":0.10,"slPips":8,"tpPips":14,"trail":0,"cooldownSec":5,"maxPos":1,"lev":10,"useSqueeze":true,"emaFast":9,"emaSlow":21,"rsiLen":14,"bbLen":20,"bbMult":2,"rr":1.75}', 10000.00)
ON DUPLICATE KEY UPDATE `id`=`id`;

INSERT INTO `settings` (`k`,`v`) VALUES
('version','1.1.0'),
('installed_at', NOW()),
('feed_source','bybit'),
('starting_balance','10000')
ON DUPLICATE KEY UPDATE `k`=`k`;
