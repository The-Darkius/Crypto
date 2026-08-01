<?php
require __DIR__ . '/inc/bootstrap.php';
if (!is_logged()) { header('Location: login.php'); exit; }

$base = rtrim(BASE_URL, '/');
$csrf = $_SESSION['csrf'];
?><!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0a0d14" />
  <title>🥇 Robot Or</title>
  <?php $cb = '?v=' . time(); ?>
  <link rel="stylesheet" href="<?= $base ?>/css/app.css<?= $cb ?>" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E%F0%9F%A5%87%3C/text%3E%3C/svg%3E" />
</head>
<body>

  <!-- BARRE DU HAUT -->
  <header class="topbar simple-top">
    <div class="brand">
      <span class="logo">🥇</span>
      <span class="title">Robot Or</span>
      <span class="src-pill" id="srcPill">⏳ Connexion…</span>
    </div>
    <div class="price-hero">
      <div class="ph-block">
        <div class="ph-label">📈 Prix d'achat</div>
        <div class="ph-val up" id="askPx">--.--</div>
      </div>
      <div class="ph-block big">
        <div class="ph-label">💰 Prix de l'or (1 once)</div>
        <div class="ph-val mid" id="midPx">--.--</div>
        <div class="ph-sub" id="chg">--</div>
      </div>
      <div class="ph-block">
        <div class="ph-label">📉 Prix de vente</div>
        <div class="ph-val down" id="bidPx">--.--</div>
      </div>
    </div>
    <div class="account">
      <div class="stat" id="pnlWrap"><span>🎯 Bénéfice</span><b id="pnl">+0.00</b><em>$</em></div>
      <div class="stat"><span>💵 Mon argent</span><b id="balance">10000</b><em>$</em></div>
      <a href="<?= $base ?>/logout.php" class="logout-btn" title="Déconnexion">⏻</a>
    </div>
  </header>

  <main class="grid simple-grid">

    <!-- Colonne gauche -->
    <aside class="col left simple-left">
      <section class="panel book">
        <div class="panel-head"><h3>📊 Achats / Ventes en cours</h3></div>
        <div class="book-spread" style="justify-content:center"><span id="spreadLine">--</span></div>
        <div class="book-body" id="asks"></div>
        <div class="book-body" id="bids"></div>
      </section>
      <section class="panel tape-panel">
        <div class="panel-head"><h3>🕒 Dernières transactions</h3></div>
        <ul id="tape" class="tape-list"></ul>
      </section>
    </aside>

    <!-- Colonne centrale -->
    <section class="col center simple-center">

      <div id="welcome" class="welcome-banner">
        <div class="welcome-emoji">👋</div>
        <div>
          <b>Bienvenue !</b>
          <p>Ce site te permet de <b>jouer avec le prix de l'or</b> (faux argent, aucun risque 🎮).
          Tu peux soit cliquer sur <b>ACHETER</b>/<b>VENDRE</b> à droite, soit lancer le robot qui joue à ta place.</p>
        </div>
        <button class="btn small" id="welcomeClose">C'est parti !</button>
      </div>

      <div class="panel chart-panel">
        <div class="chart-head">
          <div class="tf">
            <button data-tf="5" class="active">Rapide</button>
            <button data-tf="30">Moyen</button>
            <button data-tf="300">Lent</button>
          </div>
          <div class="legend">
            <span><b class="up">▲</b><i id="vH">--</i></span>
            <span><b class="down">▼</b><i id="vL">--</i></span>
          </div>
          <button class="btn tiny ghost" id="toggleExpert">🔧 Options experts</button>
        </div>
        <div class="indic expert-only" id="expertIndic">
          <label><input type="checkbox" id="iVWAP" checked> VWAP</label>
          <label><input type="checkbox" id="iEMA9" checked> EMA9</label>
          <label><input type="checkbox" id="iEMA21" checked> EMA21</label>
          <label><input type="checkbox" id="iEMA50"> EMA50</label>
          <label><input type="checkbox" id="iBB"> Bollinger</label>
          <label><input type="checkbox" id="iSR" checked> Niveaux</label>
        </div>
        <canvas id="chart"></canvas>
        <canvas id="overlayChart"></canvas>
      </div>
      <div class="panel rsi-panel expert-only">
        <div class="mini-label">Force du marché (RSI)</div>
        <canvas id="rsiChart"></canvas>
      </div>

      <div class="panel positions">
        <div class="panel-head">
          <h3>💼 Mes trades en cours</h3>
          <button class="btn small danger" id="closeAll">Tout fermer</button>
        </div>
        <table class="pos-table">
          <thead><tr>
            <th>Sens</th><th>Mise</th><th>Acheté à</th><th>Prix actuel</th>
            <th>Stop</th><th>Objectif</th><th>Gain/Perte</th><th>Temps</th><th></th>
          </tr></thead>
          <tbody id="positions"></tbody>
        </table>
        <div class="empty-hint" id="positionsEmpty">
          🔇 Aucun trade en cours.<br>Clique sur ACHETER ou VENDRE à droite, ou lance le robot !
        </div>
      </div>
    </section>

    <!-- Colonne droite -->
    <aside class="col right simple-right">

      <!-- ROBOT -->
      <section class="panel bot-card">
        <div class="bot-emoji">🤖</div>
        <h2 class="bot-title">Le robot qui joue à ta place</h2>
        <p class="bot-sub">Il regarde le prix de l'or en permanence et prend des décisions tout seul.
        Tu n'as rien d'autre à faire que de choisir le <b>niveau de risque</b>.</p>

        <div class="risk-picker">
          <button class="risk-btn" data-risk="safe">
            <span class="risk-emoji">🟢</span>
            <span class="risk-name">Prudent</span>
            <span class="risk-desc">Petits gains, petites pertes</span>
          </button>
          <button class="risk-btn active" data-risk="normal">
            <span class="risk-emoji">🟡</span>
            <span class="risk-name">Équilibré</span>
            <span class="risk-desc">Pour bien débuter</span>
          </button>
          <button class="risk-btn" data-risk="agro">
            <span class="risk-emoji">🔴</span>
            <span class="risk-name">Agressif</span>
            <span class="risk-desc">Gros gains, grosses pertes</span>
          </button>
        </div>

        <button class="btn huge start" id="botStart">
          <span class="big-emoji">▶</span>
          <span class="btn-lbl">Démarrer le robot</span>
          <span class="btn-sub">Clique pour lancer !</span>
        </button>

        <div class="bot-stats">
          <div class="kpi kpi-pnl"><span>💰 Gains du robot</span><b id="botPnl">+0.00 $</b></div>
          <div class="kpi"><span>🎯 Trades gagnés</span><b id="botWR">0%</b></div>
          <div class="kpi"><span>🔁 Nombre de trades</span><b id="botN">0</b></div>
          <div class="kpi"><span>📉 Pire journée</span><b id="botDD">0%</b></div>
        </div>

        <div class="bot-say" id="botSay">
          <span class="bot-say-emoji">💤</span>
          <span>Robot en pause. Choisis ton risque puis démarre !</span>
        </div>

        <div class="bot-actions-simple">
          <button class="btn small ghost" id="botPause" disabled>⏸ Pause</button>
          <button class="btn small danger-ghost" id="botReset">🔄 Recommencer à zéro</button>
        </div>

        <div class="mini-section">
          <div class="mini-title">🎯 Trades du robot en cours</div>
          <ul id="botPosList" class="bot-pos-simple"><li class="muted">aucun</li></ul>
        </div>

        <button class="btn tiny ghost full" id="botExpertToggle">🔧 Voir les paramètres experts</button>
        <div class="bot-config expert-only" id="botExpertPanel">
          <p class="danger-hint">⚠️ Si tu ne sais pas ce que c'est, ne touche pas à ça !</p>
          <div class="field two">
            <div><label>Mise (oz)</label><input type="number" id="botSize" value="0.10" step="0.01" min="0.01"></div>
            <div><label>Multiplicateur</label><input type="number" id="botLev" value="10" step="1" min="1" max="125"></div>
          </div>
          <div class="field two">
            <div><label>Perte max (pips)</label><input type="number" id="botSl" value="8" step="1" min="1"></div>
            <div><label>Gain visé (pips)</label><input type="number" id="botTp" value="14" step="1" min="1"></div>
          </div>
          <div class="field two">
            <div><label>Trailing (pips)</label><input type="number" id="botTrail" value="0" step="1" min="0"></div>
            <div><label>Attente (s)</label><input type="number" id="botCd" value="5" step="1" min="0"></div>
          </div>
          <div class="field two">
            <div><label>Max trades en même temps</label><input type="number" id="botMax" value="1" step="1" min="1" max="5"></div>
            <div class="chk-field"><label><input type="checkbox" id="botSqueeze" checked> BB squeeze</label></div>
          </div>
          <button class="btn small" id="botApply">💾 Enregistrer</button>
        </div>

        <div class="bot-log-wrap expert-only">
          <div class="mini-title">📜 Journal technique</div>
          <ul id="botLog"></ul>
        </div>
      </section>

      <!-- MANUEL -->
      <section class="panel manual-card">
        <h3 class="card-title">🛒 Jouer toi-même</h3>
        <p class="card-sub">Clique sur un bouton pour ouvrir un trade immédiatement.</p>

        <div class="field">
          <label>💵 Combien miser par trade ?</label>
          <div class="amount-picker">
            <button class="amt-btn" data-usdt="10">10 $</button>
            <button class="amt-btn" data-usdt="50">50 $</button>
            <button class="amt-btn active" data-usdt="100">100 $</button>
            <button class="amt-btn" data-usdt="500">500 $</button>
          </div>
        </div>

        <div class="manual-btns">
          <button class="btn huge buy" id="marketBuy">
            <span class="big-emoji">🟢</span>
            <span class="btn-lbl">ACHETER</span>
            <span class="btn-sub">Je parie que ça monte</span>
          </button>
          <button class="btn huge sell" id="marketSell">
            <span class="big-emoji">🔴</span>
            <span class="btn-lbl">VENDRE</span>
            <span class="btn-sub">Je parie que ça descend</span>
          </button>
        </div>

        <div class="risk-display">
          <span>⚠️ Perte max si tu te trompes : </span>
          <b id="riskTrade">~5 $</b>
        </div>

        <button class="btn tiny ghost full" id="manExpertToggle">🔧 Options avancées</button>
        <div class="expert-only" id="manExpertPanel">
          <div class="field two">
            <div><label>SL (pips)</label><input type="number" id="slPips" value="10" step="1" min="1" /></div>
            <div><label>TP (pips)</label><input type="number" id="tpPips" value="20" step="1" min="1" /></div>
          </div>
          <div class="field">
            <label>Levier</label>
            <input type="range" id="lev" min="1" max="50" value="10" />
            <span class="lev-val" id="levVal">10×</span>
          </div>
          <div class="field two">
            <div><label>RR</label><input type="number" id="rr" value="2" step="0.1" min="0.5" />:1</div>
            <div><label>Trailing</label><input type="number" id="trail" value="0" step="1" min="0" /></div>
          </div>
          <div class="field" hidden>
            <input type="number" id="size" value="0.10" step="0.01" min="0.01" />
          </div>
        </div>
      </section>

    </aside>
  </main>

  <div id="toasts"></div>
  <script>
    window.__CONFIG = {
      baseUrl: <?= json_encode($base, JSON_UNESCAPED_SLASHES) ?>,
      csrf: <?= json_encode($csrf) ?>,
    };
    window.__SIMPLE_MODE__ = true;
  </script>
  <script src="<?= $base ?>/js/app.js<?= $cb ?>" defer></script>
</body>
</html>
