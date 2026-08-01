# ⚡ XAUUSDT Micro-Scalper Pro (WAMP Edition)

Plateforme de micro-scalping ultra-performante sur **XAUUSDT** (or vs USDT), en **PHP + MySQL + JavaScript vanilla**. Conçue pour être lancée en **1 clic sous WAMP** (ou tout serveur Apache/PHP/MySQL) :

- ✅ **Aucun Node.js / npm nécessaire**
- ✅ **Installateur web** qui crée la base de données, les tables, le fichier de config et le compte admin
- ✅ Flux de prix **Bybit en WebSocket direct** depuis le navigateur (pas de proxy, latence minimum, pas besoin de clé API)
- ✅ **Fallback simulateur** si le réseau bloque le WS Bybit
- ✅ Chart canvas, order book, time&sales, SL/TP/trailing, RSI/VWAP/EMAs/BB/SR
- ✅ **Bot automatique** ON / PAUSE / OFF avec stratégie micro-scalping (EMAs + RSI + BB squeeze)
- ✅ Toutes les positions, trades, logs et état du bot sont **persistés en MySQL**

---

## 🚀 Installation sous WAMP (3 clics)

### 1. Démarrer WAMP
Lance **WampServer** et attends que l'icône devienne **verte** (Apache + MySQL démarrés).

### 2. Copier le projet
Copie tout le dossier du projet dans :
```
C:\wamp64\www\xauusdt\
```
(ou `C:\wamp\www\xauusdt\` si tu utilises l'ancienne version 32-bit).

### 3. Lancer l'installateur
Ouvre ton navigateur et va à :
```
http://localhost/xauusdt/install.php
```

L'assistant te guide en 3 étapes :

1. **Vérifications** (version PHP ≥ 8, extensions PDO MySQL, droits écriture) — tout doit être ✓
2. **Configuration** :
   - Hôte MySQL : `localhost` / port `3306` (défaut WAMP)
   - Nom de la base : `xauusdt`
   - Utilisateur : `root` / mot de passe : *(vide par défaut sous WAMP)*
   - URL de base : `/xauusdt` (détectée automatiquement)
   - Compte admin : choisis un pseudo et un mot de passe (4 caractères minimum)
3. **Terminé** → clique sur *« se connecter à XAUUSDT Micro-Scalper »* puis connecte-toi avec le compte créé.

➡️ C'est prêt. L'installateur a créé :
- la base de données `xauusdt` et ses 6 tables (`users`, `settings`, `positions`, `trades`, `logs`, `bot_state`)
- le fichier `inc/config.php` (à ne pas éditer manuellement)

> Pour réinstaller depuis zéro, supprime `inc/config.php` et retourne sur `install.php`.

---

## 📂 Structure du projet

```
xauusdt/
├── install.php         ← assistant d'installation web
├── index.php           ← app principale (protégée par login)
├── login.php           ← page de connexion
├── logout.php          ← déconnexion
├── .htaccess           ← config Apache (sécurité, cache)
├── inc/
│   ├── bootstrap.php   ← session + auth + helpers JSON
│   ├── db.php          ← PDO + helpers SQL
│   ├── config.php      ← généré par l'installateur
│   └── config.example.php
├── api/                ← endpoints REST JSON (CRUD positions, bot, logs)
│   ├── state.php
│   ├── position_open.php
│   ├── position_close.php
│   ├── position_update.php
│   ├── bot.php
│   ├── log.php
│   └── recent_logs.php
├── sql/schema.sql      ← schéma MySQL (exécuté par l'installateur)
├── css/app.css
├── js/app.js           ← flux WS Bybit, chart canvas, indicateurs, moteur trading, bot
└── robots.txt
```

---

## 📡 Flux de prix

- **Priorité** : WebSocket public Bybit `wss://stream.bybit.com/v5/public/linear`, souscription à `tickers.XAUUSDT` (perpétuel XAUUSDT qui réplique parfaitement le spot or/USD). Aucune clé API requise.
- **Fallback** : simulateur GBM (mouvement brownien + micro-sauts) si le WS Bybit est inaccessible (pas Internet, firewall). Une pastille **SRC** indique en permanence la source active :
  - 🟢 `SRC: BYBIT WS • LIVE` — flux officiel en direct
  - 🟡 `SRC: SIMULATEUR` — données simulées pour tester

---

## 🤖 Bot automatique

Le panneau **🤖 AUTO-BOT** à droite propose 3 états :

| Bouton | Effet |
|--------|-------|
| 🔴 **OFF** | Arrête le bot et clôture toutes ses positions |
| 🟡 **PAUSE** | Ne prend plus de nouveaux trades mais gère toujours SL/TP/trailing des positions en cours |
| 🟢 **ON** | Trading automatique actif |

### Stratégie (micro-scalping 1s)
- Direction : **EMA 9 / EMA 21** (croisement)
- Filtre : **RSI(14)** entre 32 et 75 pour éviter les extrêmes
- Entrée : repli/rejet sur **Bollinger Bands (20, 2)**
- Filtre optionnel **BB squeeze** (n'entre qu'en compression de volatilité)
- SL/TP/trailing/cooldown/max positions/size/levier tous modifiables en direct

Les positions du bot sont indépendantes de tes trades manuels (balance séparée, stats séparées) mais tout est historisé en base.

### API Bot
`POST /api/bot.php` (avec token CSRF) :
```jsonc
{"action":"start", "config":{...}}
{"action":"pause"}
{"action":"stop"}
{"action":"reset"}
{"action":"config", "config":{...}}
```

---

## 🎮 Utilisation manuelle

- **Ticket d'ordre** à droite : side (BUY/SELL), type (MARKET/LIMIT/STOP), taille, levier 1-125×, SL/TP/trailing en pips, calcul automatique du risque en USDT et % capital
- **Hotkeys** :
  - `F1` → achat market
  - `F2` → vente market
  - `F3` → fermer la position la plus ancienne
  - `+` / `-` → augmenter / baisser la size
  - `Ctrl+Z` → close de sécurité
- **Timeframes** : 1s / 5s / 15s / 30s / 1m / 5m (agrégés en direct depuis les ticks)
- **Indicateurs** toggleables : VWAP, EMA 9/21/50, Bollinger Bands, niveaux S/R (swings)
- RSI(14) en panneau séparé
- Book 15 niveaux agrégable, time & sales coloré

---

## 🛠️ Sécurité & bonnes pratiques

- Le mot de passe admin est haché avec `password_hash()` (bcrypt)
- Protection CSRF sur tous les endpoints qui modifient des données
- Session PHP régénérée à la connexion (`session_regenerate_id`)
- `.htaccess` interdit l'accès direct à `inc/config.php` et aux fichiers d'include
- `robots.txt` interdit l'indexation des dossiers sensibles
- **Aucune clé API n'est nécessaire pour le flux de prix** : le WS Bybit public est utilisé directement par le navigateur

---

## ⚠️ Règles d'or en micro-scalping XAUUSDT

- Jamais plus de **0.5-1% du capital** par trade
- Pas de trading 15 min avant et 15 min après une annonce macro forte (NFP, CPI, FOMC, décisions Fed) — les spreads explosent
- Le bot est une base de travail, **pas un système rentable clé en main** : un bot qui gagne demande des semaines de backtest, des frais au raz du plancher, et une latence maîtrisée
- La pastille **LIVE** est le flux officiel Bybit, mais le trading reste **en mode papier** sur une balance virtuelle — tu ne risques aucun argent réel tant que tu n'as pas branché un broker avec de vraies clés API

Bon scalping 🥇 — *le meilleur trade est souvent celui que l'on ne prend pas.*
