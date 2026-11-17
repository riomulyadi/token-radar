/* Token Radar — the page.
 *
 * The whole dataset arrives in data.js as window.RADAR: no network, no fetch, no external asset.
 * The page is the radar: a ranked board that can be sorted by any column, filtered by name,
 * category, chain and token status, and opened for a detail view that carries the protocol's
 * farm plan and the model's own arithmetic for that row.
 */

(function () {
  'use strict';

  var D = window.RADAR;
  if (!D) {
    document.getElementById('board').innerHTML =
      '<div class="empty">The radar data did not load.</div>';
    return;
  }

  var rows = D.rows || [];
  var live = D.live || [];
  var categories = D.categories || [];
  var state = {
    query: '',
    category: 'all',
    chain: 'all',
    token: 'all',
    scope: 'all',
    sort: 'implied_value_usd',
    dir: 'desc',
    open: null,
    expanded: null
  };

  /* ---------- formatting ---------- */

  function money(n) {
    if (n === null || n === undefined) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }

  function fullMoney(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function pct(n, digits) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function ageText(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 60) return days + 'd';
    if (days < 730) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function chainList(r) {
    return (r.chains || []).slice(0, 2).map(esc).join(' · ') || '—';
  }

  /**
   * The farm plan for a row. The steps come from the data file, which carries the very strings
   * board.json holds for this row, so what a reader reads is what the gate checks.
   */
  function farmPlan(r) {
    return r.farm_steps || [];
  }

  /* ---------- filtering and sorting ---------- */

  function allChains() {
    var seen = {};
    rows.forEach(function (r) {
      (r.chains || []).forEach(function (c) { seen[c] = true; });
    });
    return Object.keys(seen).sort();
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    return rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.scope !== 'all') {
        // The scope filter separates the watchlist rows from the early radar the floor hides.
        var watched = D.watchlist_slugs.indexOf(r.slug) >= 0;
        if (state.scope === 'watch' && !watched) return false;
        if (state.scope === 'early' && watched) return false;
      }
      if (state.token !== 'all') {
        // The token-status filter became a share-quality filter: a category's share is either
        // measured from its own live-token protocols or taken from the snapshot-wide median.
        if (state.token === 'measured' && r.category_samples === 0) return false;
        if (state.token === 'median' && r.category_samples > 0) return false;
      }
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function sortRows(list) {
    var key = state.sort;
    var dir = state.dir === 'asc' ? 1 : -1;
    return list.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      // The implied-value multiple is derived, so it is compared as a number.
      if (key === 'multiple') {
        x = a.tvl_usd > 0 ? a.implied_value_usd / a.tvl_usd : -Infinity;
        y = b.tvl_usd > 0 ? b.implied_value_usd / b.tvl_usd : -Infinity;
      }
      if (x === null || x === undefined) x = -Infinity;
      if (y === null || y === undefined) y = -Infinity;
      if (typeof x === 'string' || typeof y === 'string') {
        return String(x).localeCompare(String(y)) * dir;
      }
      if (x === y) return a.rank - b.rank;
      return (x < y ? -1 : 1) * dir;
    });
  }

  /* ---------- rendering ---------- */

  var COLUMNS = [
    { key: 'rank', label: '#', cls: 'rank', sortable: true },
    { key: 'open', label: '', cls: 'caret', sortable: false },
    { key: 'name', label: 'Protocol', cls: 'name', sortable: true },
    { key: 'category', label: 'Category', cls: 'catcell', sortable: true },
    { key: 'chains', label: 'Chains', cls: 'chains', sortable: false },
    { key: 'tvl_usd', label: 'TVL', cls: 'num tvl', sortable: true },
    { key: 'change_7d', label: '7d', cls: 'chg', sortable: true },
    { key: 'age_days', label: 'Age', cls: 'age', sortable: true },
    { key: 'multiple', label: 'Implied/TVL', cls: 'mult', sortable: true },
    { key: 'implied_value_usd', label: 'Implied value', cls: 'val', sortable: true },
    { key: 'bar', label: '', cls: 'barcell', sortable: false }
  ];

  var COLGROUPS = [
    'c-rank', 'c-open', 'c-name', 'c-cat', 'c-chain',
    'c-tvl', 'c-chg', 'c-age', 'c-mult', 'c-val', 'c-bar'
  ];

  function headHtml() {
    return COLUMNS.map(function (c) {
      var aria = state.sort === c.key ? ' aria-sort="' + (state.dir === 'asc' ? 'ascending' : 'descending') + '"' : '';
      var arrow = state.sort === c.key ? '<span class="arrow">' + (state.dir === 'asc' ? '▲' : '▼') + '</span>' : '';
      var hint = (c.sortable && state.sort !== c.key) ? '<span class="hint">↕</span>' : '';
      return '<th class="' + c.cls + '" data-key="' + c.key + '"' + (c.sortable ? aria : '') + ' scope="col">' + esc(c.label) + arrow + hint + '</th>';
    }).join('');
  }

  /** The model's own arithmetic for one row, as the board shows it. */
  function equationHtml(r) {
    // The factors are shown rounded, so the chain approximates the stated value rather than
    // equalling it exactly: the implied value is the model's, computed at full precision.
    // The exact TVL and the exact waiting days are given too, so the chain can be recomputed.
    return '$' + Math.round(r.tvl_usd_exact).toLocaleString('en-US') + ' TVL × size ' + r.size_weight.toFixed(4) +
      ' × growth ' + r.growth_weight.toFixed(4) +
      ' × maturity ' + r.maturity_weight.toFixed(4) +
      ' × category ' + r.category_share.toFixed(4) +
      ' ≈ <b>$' + money(r.implied_value_usd) + '</b>';
  }

  /** Where a row's category share came from: measured, or the snapshot-wide fallback. */
  function shareOrigin(r) {
    if (r.category_samples > 0) {
      return 'Share ' + r.category_share.toFixed(4) + ' measured from ' +
        r.category_samples + ' live-token ' + (r.category_samples === 1 ? 'protocol' : 'protocols') +
        ' in ' + (r.category || 'this category') + '.';
    }
    return 'Share ' + r.category_share.toFixed(4) + ' not measurable: no live-token protocol in ' +
      (r.category || 'this category') + ' has one, so this row uses the snapshot-wide median of the ' +
      D.live_sample_size + ' that do.';
  }

  /** The badge a row carries when its category share had to fall back. */
  function fallbackBadge(r) {
    if (r.category_samples > 0) return '';
    return '<span class="badge fallback" title="No live-token protocol in this category, so the share is the snapshot-wide median">median</span>';
  }

  /** The four factors, in one line each, so a reader can audit the numbers. */
  function legendHtml(r) {
    var days = r.age_days === null || r.age_days === undefined ? 'unknown' : r.age_days + ' days';
    return '<dl class="legend">' +
      '<dt>size</dt><dd>' + D.model.size_floor.toFixed(2) + ' at no TVL, capped at 1.00 above $' +
        money(D.model.size_reference_usd * D.model.size_span) + ', on a log scale</dd>' +
      '<dt>growth</dt><dd>1 + (7-day change × ' + D.model.growth_weight + '), capped at ±' +
        (D.model.growth_move_cap * 100).toFixed(0) + '%</dd>' +
      '<dt>maturity</dt><dd>' + (D.model.maturity_floor + D.model.maturity_range).toFixed(2) +
        ' at 0 days to ' + D.model.maturity_floor.toFixed(2) + ' at ' + D.model.maturity_days +
        ' days; this one has waited ' + days + '</dd>' +
      '<dt>category</dt><dd>market-cap-to-TVL ratio of the ' + D.live_sample_size +
        ' protocols that record a token</dd>' +
      '</dl>';
  }

  /** The farm plan, three steps on the board and the rest behind the detail view. */
  function expandHtml(r) {
    var plan = farmPlan(r);
    // The board shows the first sentence of each step, with its cost and time; the detail view
    // carries the step in full.
    var steps = plan.slice(0, 3).map(function (s) {
      var first = s.text.split(/(?<=\.)\s/)[0];
      return '<li>' + esc(first) + ' <em>· ' + esc(s.cost) + ' · ' + esc(s.time) + '</em></li>';
    }).join('');
    return '<tr class="expand"><td colspan="' + COLUMNS.length + '"><div class="expand-inner">' +
      '<div class="ex-col">' +
        '<h4>How this row was scored</h4>' +
        '<div class="equation">' + equationHtml(r) + '</div>' +
        '<p class="origin">' + shareOrigin(r) + '</p>' +
      '</div>' +
      '<div class="ex-col">' +
        '<h4>How to farm it</h4>' +
        '<ol class="steps-inline">' + steps + '</ol>' +
        '<p class="qualifier">First 3 of ' + plan.length + ' steps · $' + r.farm_capital +
          ' of capital and about $' + r.farm_total_gas + ' of gas over ' + r.farm_hold_days +
          ' days · no token is announced for this protocol.</p>' +
      '</div>' +
    '</div></td></tr>';
  }

  function rowHtml(r, maxValue) {
    var live = r.mcap_usd !== null && r.mcap_usd !== undefined;
    var chg = r.change_7d;
    var cls = chg === null || chg === undefined ? 'flat' : (chg > 0.05 ? 'up' : (chg < -0.05 ? 'down' : 'flat'));
    var pctw = maxValue > 0 ? Math.max(2, (r.implied_value_usd / maxValue) * 100) : 0;
    var mult = r.tvl_usd > 0 ? (r.implied_value_usd / r.tvl_usd).toFixed(3) : '—';
    var open = state.expanded === r.slug;
    var html = '<tr data-slug="' + esc(r.slug) + '" aria-expanded="' + open + '"' +
      (state.open === r.slug ? ' aria-selected="true"' : '') + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td class="caret" title="Show the model and the farm plan">' + (open ? '▾' : '▸') + '</td>' +
      '<td class="name">' + esc(r.name) + '<span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td class="catcell"><span class="cat">' + esc(r.category || 'Uncategorised') + '</span>' +
        fallbackBadge(r) + '</td>' +
      '<td class="chains">' + chainList(r) + '</td>' +
      '<td class="num tvl">$' + money(r.tvl_usd) + '</td>' +
      '<td class="chg ' + cls + '">' + pct(chg, 1) + '</td>' +
      '<td class="age">' + ageText(r.age_days) + '</td>' +
      '<td class="mult">' + mult + '×</td>' +
      '<td class="val">$' + money(r.implied_value_usd) + '</td>' +
      '<td class="barcell"><div class="bar" title="$' + money(r.implied_value_usd) + ' of a $' +
        money(maxValue) + ' maximum"><span style="width:' + pctw.toFixed(1) + '%"></span></div></td>' +
      '</tr>';
    if (open) html += expandHtml(r);
    return html;
  }

  function statHtml() {
    var list = filtered();
    var total = 0, max = 0;
    var watchTotal = 0, earlyTotal = 0;
    var watchRows = 0, earlyRows = 0;
    list.forEach(function (r) {
      total += r.implied_value_usd;
      if (r.implied_value_usd > max) max = r.implied_value_usd;
      if (D.watchlist_slugs.indexOf(r.slug) >= 0) { watchTotal += r.implied_value_usd; watchRows++; }
      else { earlyTotal += r.implied_value_usd; earlyRows++; }
    });
    return '' +
      '<div class="stats">' +
        '<dl class="stat"><dt>Protocols ranked</dt><dd>' + list.length + '<small>on the board</small></dd></dl>' +
        '<dl class="stat"><dt>Implied value, total</dt><dd class="accent">$' + money(total) + '<small>sum of every row shown</small></dd></dl>' +
        '<dl class="stat"><dt>Watchlist</dt><dd>' + watchRows + ' <small class="inline">· $' + money(watchTotal) + '</small><small>the house’s own shortlist</small></dd></dl>' +
        '<dl class="stat"><dt>Early radar</dt><dd>' + earlyRows + ' <small class="inline">· $' + money(earlyTotal) + '</small><small>found below the floor</small></dd></dl>' +
        '<dl class="stat"><dt>Strongest row</dt><dd>$' + money(max) + '<small>the highest implied value on the board</small></dd></dl>' +
      '</div>';
  }

  function modelHtml() {
    var rowsHtml = categories.slice(0, 12).map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td>' + c.samples + '</td><td>' +
        (c.median_ratio === null ? '—' : c.median_ratio.toFixed(4)) + '</td><td>' + c.share.toFixed(4) + '</td></tr>';
    }).join('');
    return '' +
      '<section class="explain">' +
        '<div class="card">' +
          '<h3>The model, in full</h3>' +
          '<p>Implied value is <code>tvl_usd × size_weight × growth_weight × maturity_weight × category_share</code>. Every term comes out of the snapshot, and no protocol name is special-cased: the same function scores every row.</p>' +
          '<p><strong>Size</strong> is log-scaled TVL, so a protocol twice as large ranks higher but not twice as high — the biggest pools in DeFi do not mint the biggest tokens.</p>' +
          '<p><strong>Growth</strong> is the seven-day TVL change, clamped to ±' + D.model.growth_cap + '% and weighted at ' + D.model.growth_weight + '. Momentum is evidence, not proof.</p>' +
          '<p><strong>Maturity</strong> falls as the waiting grows: a protocol that has run ' + Math.round(D.model.maturity_days / 365) + ' years with no token is not close to one. A new protocol keeps ' + D.model.maturity_floor + ' of its weight; a three-year wait keeps ' + D.model.maturity_floor + '.</p>' +
          '<p><strong>Category share</strong> is measured, not written down. For each category the model takes the median ratio of market cap to TVL across the protocols in that category that already have a token, and applies it. A category with fewer than ' + D.model.category_min_samples + ' live-token protocols falls back on the snapshot’s own global median of <strong>' + D.global_median_ratio.toFixed(4) + '</strong>, measured over ' + D.live_sample_size + ' live-token protocols.</p>' +
          '<p class="model-note">Live-token protocols are never ranked. They are the market’s own values, kept apart on their own view, and they are the sample the category shares are measured from.</p>' +
        '</div>' +
        '<div class="card">' +
          '<h3>Category shares, measured</h3>' +
          '<p>The share each category carries, and the live-token protocols it was measured from.</p>' +
          '<table class="weights">' +
            '<thead><tr><th>Category</th><th>Sample</th><th>Median mcap/TVL</th><th>Share</th></tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
          '<p style="margin-top:12px">Snapshot <strong>' + esc(D.as_of) + '</strong> from ' + esc(D.source) + '. The watchlist floor is $' + money(D.floor_usd) + '; the early radar carries the ' + D.early_size + ' pre-token protocols below it.</p>' +
        '</div>' +
      '</section>';
  }

  function liveHtml() {
    var rowsHtml = live.map(function (l) {
      return '<tr><td class="name">' + esc(l.name) + '<span class="slug">' + esc(l.slug) + '</span></td>' +
        '<td class="catcell"><span class="cat">' + esc(l.category || 'Uncategorised') + '</span></td>' +
        '<td class="num tvl">$' + money(l.tvl_usd) + '</td>' +
        '<td class="val">$' + money(l.mcap_usd) + '</td>' +
        '<td class="num">' + (l.mcap_to_tvl === null ? '—' : l.mcap_to_tvl.toFixed(3)) + '</td></tr>';
    }).join('');
    return '<section class="card" style="margin-top:26px">' +
      '<h3>Live tokens — the sample the category shares come from</h3>' +
      '<p>Of the ' + D.protocol_count + ' protocols in this snapshot, ' + D.live_sample_size +
      ' record a token; these are the ' + D.live_size + ' with the largest market cap. They are not ranked: ' +
      'their value is the market’s, not a model’s. Their market-cap-to-TVL ratio is what each category’s share ' +
      'is measured from, and the snapshot-wide median of ' + D.global_median_ratio.toFixed(4) + ' over all ' +
      D.live_sample_size + ' of them is the fallback for a category with too few live-token protocols to measure.</p>' +
      '<table class="weights"><thead><tr><th>Protocol</th><th>Category</th><th>TVL</th><th>Market cap</th><th>mcap/TVL</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table></section>';
  }

  function render() {
    var list = sortRows(filtered());
    var maxValue = 0;
    list.forEach(function (r) { if (r.implied_value_usd > maxValue) maxValue = r.implied_value_usd; });

    // The counts the share-mode filter splits the board by.
    var measuredRows = 0, medianRows = 0;
    rows.forEach(function (r) {
      if (r.category_samples > 0) measuredRows++; else medianRows++;
    });

    // The first row opens by default, so the board shows the model and a farm plan on arrival.
    if (state.expanded === null && list.length > 0) state.expanded = list[0].slug;

    var body = list.length
      ? '<div class="tablewrap"><table>' +
        '<colgroup>' + COLGROUPS.map(function (c) { return '<col class="' + c + '">'; }).join('') + '</colgroup>' +
        '<thead><tr>' + headHtml() + '</tr></thead><tbody>' +
        list.map(function (r) { return rowHtml(r, maxValue); }).join('') +
        '</tbody></table>' +
        '<p class="tablefoot">Showing <b>' + list.length + '</b> of ' + rows.length +
        ' ranked protocols · the bar is scaled to the strongest row ($' + money(maxValue) + ')' +
        ' · a <span class="badge fallback">median</span> pill means the category had no live-token protocol to measure, so it uses the snapshot-wide median' +
        ' · click a row for its full plan, click ▸ for the model behind it</p></div>'
      : '<div class="tablewrap"><div class="empty">No protocol matches this filter.</div></div>';

    document.getElementById('board').innerHTML =
      '<div class="wrap">' +
        '<header class="masthead">' +
          '<div>' +
            '<div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>' +
              '<div><h1>Token <span>Radar</span></h1><p>pre-token protocols, ranked by implied value</p></div>' +
            '</div>' +
            '<p class="tagline">The ' + D.pre_token_count + ' protocols in this snapshot that <strong>record no token</strong>, ranked by what that token would be worth if it launched. The board covers the whole watchlist and adds the <strong>' + D.early_size + ' protocols</strong> found below the $' + money(D.floor_usd) +
              ' house floor; the other ' + (D.exclusions.cex + D.exclusions.versioned + D.exclusions.house_rule) +
              ' are exchanges, versioned pools, or above the floor and outside the house’s own rule. The implied value comes from the snapshot’s own figures — TVL, seven-day growth, how long the protocol has run with no token on its record, and what the market already pays for a token in that same category.</p>' +
          '</div>' +
          '<p class="asof"><b>Snapshot</b><span class="date">' + esc(D.as_of) + '</span>' + esc(D.source) +
            '<br><span class="sep">·</span> model ' + esc(D.model_version) +
            '<br>' + D.protocol_count + ' protocols, ' + D.live_sample_size + ' record a token</p>' +
        '</header>' +
        statHtml() +
        '<div class="controls">' +
          '<label class="search"><input type="search" id="q" placeholder="Search protocol or slug" value="' + esc(state.query) + '" aria-label="Search protocols"></label>' +
          '<select id="cat" aria-label="Filter by category"><option value="all">All categories</option>' +
            categories.map(function (c) { return '<option value="' + esc(c.category) + '"' + (state.category === c.category ? ' selected' : '') + '>' + esc(c.category) + '</option>'; }).join('') +
            '<option value="Uncategorised"' + (state.category === 'Uncategorised' ? ' selected' : '') + '>Uncategorised</option>' +
          '</select>' +
          '<select id="chain" aria-label="Filter by chain"><option value="all">All chains</option>' +
            allChains().map(function (c) { return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
          '</select>' +
          '<div class="chips" role="group" aria-label="Row set">' +
            '<button class="chip" data-scope="all" aria-pressed="' + (state.scope === 'all') + '">All rows</button>' +
            '<button class="chip" data-scope="watch" aria-pressed="' + (state.scope === 'watch') + '">Watchlist ' + D.watchlist_size + '</button>' +
            '<button class="chip" data-scope="early" aria-pressed="' + (state.scope === 'early') + '">Early ' + D.early_size + '</button>' +
          '</div>' +
          '<div class="chips" role="group" aria-label="Category share">' +
            '<button class="chip" data-token="all" aria-pressed="' + (state.token === 'all') + '">Any share</button>' +
            '<button class="chip" data-token="measured" aria-pressed="' + (state.token === 'measured') + '">Measured ' + measuredRows + '</button>' +
            '<button class="chip" data-token="median" aria-pressed="' + (state.token === 'median') + '">Median ' + medianRows + '</button>' +
          '</div>' +
          '<span class="count"><b>' + list.length + '</b> of ' + rows.length + ' rows</span>' +
        '</div>' +
        body +
        modelHtml() +
        liveHtml() +
        '<p class="disclaimer">This is a model built from one sealed snapshot of the protocol universe, not a forecast and not advice. Implied value is what the model says, not what a token is worth; a protocol may never issue one. Every farm plan describes an action to evaluate, and any capital placed in a third-party protocol can be lost.</p>' +
      '</div>' +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="detail" id="detail" aria-label="Protocol detail"></aside>';

    bind();
    if (state.open) openDetail(state.open, false);
  }

  /* ---------- the detail view ---------- */

  function detailHtml(r) {
    var plan = farmPlan(r);
    var steps = plan.map(function (s) {
      return '<li><p>' + esc(s.text) + '</p><p class="meta">Cost: ' + esc(s.cost) + ' · Time: ' + esc(s.time) + '</p></li>';
    }).join('');
    var live = r.mcap_usd !== null && r.mcap_usd !== undefined;
    return '' +
      '<button class="detail-close" id="closeDetail" aria-label="Close">×</button>' +
      '<div class="detail-inner">' +
        '<p class="detail-kicker">Rank ' + r.rank + ' of ' + D.board_size + '</p>' +
        '<h2>' + esc(r.name) + '</h2>' +
        '<p class="slugline">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' +
          esc((r.chains || []).length) + ' chain' + ((r.chains || []).length === 1 ? '' : 's') +
          ' (' + esc((r.chains || []).slice(0, 4).join(', ')) + (r.chains.length > 4 ? ' +' + (r.chains.length - 4) + ' more' : '') + ')</p>' +
        '<dl class="detail-value"><dt>Implied value at launch</dt><dd>$' + money(r.implied_value_usd) + '</dd>' +
          '<p class="note">$' + money(r.tvl_usd) + ' of TVL, ' + (r.gross_weight).toFixed(4) +
          ' of it kept by size, growth and maturity, then a category share of ' + r.category_share.toFixed(4) + '.</p></dl>' +
        '<h3>How this row was scored</h3>' +
        '<div class="equation">' + equationHtml(r) + '</div>' +
        '<p class="origin">' + shareOrigin(r) + '</p>' +
        legendHtml(r) +
        '<dl class="facts">' +
          '<div><dt>TVL</dt><dd>$' + money(r.tvl_usd) + '</dd></div>' +
          '<div><dt>7-day change</dt><dd>' + pct(r.change_7d, 1) + '</dd></div>' +
          '<div><dt>Waiting</dt><dd>' + ageText(r.age_days) + '</dd></div>' +
          '<div><dt>Token on record</dt><dd>' + (live ? 'Yes' : 'None') + '</dd></div>' +
          '<div><dt>Size weight</dt><dd>' + r.size_weight.toFixed(4) + '</dd></div>' +
          '<div><dt>Growth weight</dt><dd>' + r.growth_weight.toFixed(4) + '</dd></div>' +
          '<div><dt>Maturity weight</dt><dd>' + r.maturity_weight.toFixed(4) + '</dd></div>' +
          '<div><dt>Category share</dt><dd>' + r.category_share.toFixed(4) + '</dd></div>' +
        '</dl>' +
        '<h3>What the model claims, and what it does not</h3>' +
        '<p>The implied value is this entry’s own claim, computed from the sealed snapshot of ' +
          esc(D.as_of) + ' — it is not a forecast, not a promise that a token is issued, and not ' +
          'advice. The ' + '$' + money(r.implied_value_usd) + ' figure is what the model says a token would be ' +
          'worth at launch if the protocol’s record stood still; a protocol may never issue one, and the ' +
          'snapshot’s record of "no token" is not proof that none exists.</p>' +
        '<p>Its category share was ' +
          (r.category_samples > 0
            ? 'measured from ' + r.category_samples + ' live-token ' + (r.category_samples === 1 ? 'protocol' : 'protocols') + ' in ' + esc(r.category || 'this category')
            : 'not measurable: no live-token protocol in ' + esc(r.category || 'this category') + ' carries one, so the snapshot-wide median of ' + r.category_share.toFixed(4) + ' was used') +
          '. The farm plan below says what a reader could do with a small position; it says nothing about what ' +
          'that position would earn, because the snapshot carries no airdrop flag, no points schedule and no ' +
          'allocation history to reason from.</p>' +
        '<p class="model-note">Risk to weigh before any of it: a curator vault can lose money, a bridge can be ' +
          'exploited, a lending position can be liquidated, and capital locked for ' + r.farm_hold_days +
          ' days earns nothing while a token, if one ever comes, may be airdropped to a different set of ' +
          'addresses. Treat the whole position as lost.</p>' +
        '<h3>Farm plan</h3>' +
        '<p>' + plan.length + ' steps, each with what it costs and how long it takes, as the board file ' +
          'records them for this row. The action follows the protocol’s own category and size.</p>' +
        '<p class="plantotal">' + plan.length + ' steps · $' + r.farm_capital + ' of capital · about $' +
          r.farm_total_gas + ' of gas in total · ' + r.farm_hold_days + ' days held · about 40 minutes of your time' +
          ' · that $' + r.farm_capital + ' is ' + shareOfPool(r) + ' of the ' + '$' + money(r.tvl_usd) +
          ' pool, and the implied value of a token here is ' + '$' + money(r.implied_value_usd) + '</p>' +
        '<ol class="steps">' + steps + '</ol>' +
        '<p class="model-note">This row was scored by the model, not by hand: <code>' + esc(r.slug) + '</code> takes ' +
          'size ' + r.size_weight.toFixed(4) + ', growth ' + r.growth_weight.toFixed(4) + ', maturity ' +
          r.maturity_weight.toFixed(4) + ' and its category’s share of ' + r.category_share.toFixed(4) + '.</p>' +
        '<p class="disclaimer">A plan is a plan, not a promise. Check the protocol’s own points page before ' +
          'you act, and never send funds to an address a page you did not open yourself gives you.</p>' +
      '</div>';
  }

  /** The position as a share of the protocol's own pool: the scale between the two numbers. */
  function shareOfPool(r) {
    if (!r.tvl_usd || !r.farm_capital) return 'a negligible share';
    var pct = (r.farm_capital / r.tvl_usd) * 100;
    if (pct >= 0.001) return pct.toFixed(4) + '%';
    if (pct >= 0.000001) return pct.toFixed(6) + '%';
    return pct.toExponential(2) + '%';
  }

  function openDetail(slug, rerender) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) return;
    state.open = slug;
    var panel = document.getElementById('detail');
    var scrim = document.getElementById('scrim');
    panel.innerHTML = detailHtml(r);
    panel.classList.add('open');
    scrim.classList.add('open');
    document.getElementById('closeDetail').addEventListener('click', closeDetail);
    if (!rerender) {
      var tr = document.querySelector('tr[data-slug="' + slug + '"]');
      if (tr) tr.setAttribute('aria-selected', 'true');
    }
  }

  function closeDetail() {
    state.open = null;
    var panel = document.getElementById('detail');
    var scrim = document.getElementById('scrim');
    if (panel) panel.classList.remove('open');
    if (scrim) scrim.classList.remove('open');
    var sel = document.querySelector('tr[aria-selected="true"]');
    if (sel) sel.removeAttribute('aria-selected');
  }

  /* ---------- events ---------- */

  function bind() {
    var q = document.getElementById('q');
    if (q) {
      q.addEventListener('input', function (e) {
        state.query = e.target.value;
        var pos = e.target.selectionStart;
        render();
        var again = document.getElementById('q');
        again.focus();
        again.setSelectionRange(pos, pos);
      });
    }

    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function (e) { state.category = e.target.value; render(); });

    var chain = document.getElementById('chain');
    if (chain) chain.addEventListener('change', function (e) { state.chain = e.target.value; render(); });

    Array.prototype.forEach.call(document.querySelectorAll('.chip[data-token]'), function (b) {
      b.addEventListener('click', function () {
        state.token = b.getAttribute('data-token');
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.chip[data-scope]'), function (b) {
      b.addEventListener('click', function () {
        state.scope = b.getAttribute('data-scope');
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('thead th[data-key]'), function (th) {
      var key = th.getAttribute('data-key');
      if (key === 'bar') return;
      th.addEventListener('click', function () {
        if (state.sort === key) {
          state.dir = state.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort = key;
          state.dir = key === 'name' || key === 'category' ? 'asc' : 'desc';
        }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('tbody tr[data-slug]'), function (tr) {
      var slug = tr.getAttribute('data-slug');
      tr.addEventListener('click', function (e) {
        // The caret column opens the row on the board; anywhere else opens the detail view.
        if (e.target.classList.contains('caret')) {
          state.expanded = state.expanded === slug ? null : slug;
          render();
          return;
        }
        openDetail(slug, false);
      });
    });

    var scrim = document.getElementById('scrim');
    if (scrim) scrim.addEventListener('click', closeDetail);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDetail();
    });
  }

  render();
})();
