// ===== simulateur-app.js =====

// Helpers
const parseDec = (v) => { if (typeof v === 'number') return v; if (!v) return 0; v = String(v).replace(/\s/g, '').replace(',', '.'); const n = Number(v); return isFinite(n) ? n : 0; };
const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(n||0));

// Paramètres (state)
const State = {
  ABATTEMENT_IR: 900000, TAUX_ABATTEMENT_IR: 0.3, TAUX_MAXIMAL_IR: 0.43,
  PLAFOND_IPRES_RG: 5184000, PLAFOND_IPRES_RC: 15552000,
  TAUX_IPRES_RG_EMP: 0.056, TAUX_IPRES_RG_PAT: 0.084,
  TAUX_IPRES_RC_EMP: 0.024, TAUX_IPRES_RC_PAT: 0.036,
  TAUX_CSS_PFAM: 0.07, TAUX_CSS_ACTR: 0.01,
  PLAFOND_CSS_PFAM: 756000, PLAFOND_CSS_ACTR: 756000,
  bareme_ir: [], reduction_ir: [], bareme_trimf: []
};

function applyParamsFromUI() {
  const ids = ['ABATTEMENT_IR','TAUX_ABATTEMENT_IR','TAUX_MAXIMAL_IR','PLAFOND_IPRES_RG','PLAFOND_IPRES_RC','TAUX_IPRES_RG_EMP','TAUX_IPRES_RG_PAT','TAUX_IPRES_RC_EMP','TAUX_IPRES_RC_PAT','TAUX_CSS_PFAM','TAUX_CSS_ACTR','PLAFOND_CSS_PFAM','PLAFOND_CSS_ACTR'];
  ids.forEach(id => { State[id] = parseDec(document.getElementById(id).value); });
  try {
    const bir = JSON.parse(document.getElementById('bareme_ir').value || '[]')
      .map(r => ({ montant_min: parseDec(r.montant_min), montant_max: (r.montant_max==null? null: parseDec(r.montant_max)), taux: parseDec(r.taux) }))
      .sort((a,b)=> a.montant_min - b.montant_min);
    const rir = JSON.parse(document.getElementById('reduction_ir').value || '[]')
      .map(r => ({ nombre_parts: parseDec(r.nombre_parts), taux_reduction: parseDec(r.taux_reduction), montant_min: parseDec(r.montant_min), montant_max: parseDec(r.montant_max) }));
    const btf = JSON.parse(document.getElementById('bareme_trimf').value || '[]')
      .map(r => ({ montant_min: parseDec(r.montant_min), montant_max: (r.montant_max==null? null: parseDec(r.montant_max)), taux: parseDec(r.taux) }))
      .sort((a,b)=> a.montant_min - b.montant_min);
    State.bareme_ir = bir; State.reduction_ir = rir; State.bareme_trimf = btf;
    document.getElementById('params-status').textContent = 'Paramètres appliqués';
  } catch(e) { alert('JSON invalide dans les barèmes.'); }
}

function loadSample() {
  document.getElementById('bareme_ir').value = JSON.stringify([
    { montant_min:        0, montant_max:   630000,  taux: 0.00 },
    { montant_min:   630001, montant_max:  1500000,  taux: 0.20 },
    { montant_min:  1500001, montant_max:  4000000,  taux: 0.30 },
    { montant_min:  4000001, montant_max:  8000000,  taux: 0.35 },
    { montant_min:  8000001, montant_max: 13500000,  taux: 0.37 },
    { montant_min: 13500001, montant_max: 50000000,  taux: 0.40 },
    { montant_min: 50000001, montant_max:       null, taux: 0.43 }
  ], null, 2);
  document.getElementById('reduction_ir').value = JSON.stringify([
    { nombre_parts: 1.0, taux_reduction: 0.00, montant_min:   0,  montant_max:      0 },
    { nombre_parts: 1.5, taux_reduction: 0.10, montant_min:100000, montant_max:  300000 },
    { nombre_parts: 2.0, taux_reduction: 0.15, montant_min:200000, montant_max:  650000 },
    { nombre_parts: 2.5, taux_reduction: 0.20, montant_min:300000, montant_max: 1100000 },
    { nombre_parts: 3.0, taux_reduction: 0.25, montant_min:400000, montant_max: 1650000 },
    { nombre_parts: 3.5, taux_reduction: 0.30, montant_min:500000, montant_max: 2030000 },
    { nombre_parts: 4.0, taux_reduction: 0.35, montant_min:600000, montant_max: 2490000 },
    { nombre_parts: 4.5, taux_reduction: 0.40, montant_min:700000, montant_max: 2755000 },
    { nombre_parts: 5.0, taux_reduction: 0.45, montant_min:800000, montant_max: 3180000 }
  ], null, 2);
  document.getElementById('bareme_trimf').value = JSON.stringify([
    { montant_min:0,       montant_max: 600000, taux: 900 },
    { montant_min:600000, montant_max: 999999, taux: 3600 },
    { montant_min:1000000, montant_max: 1999999, taux: 4800 },
    { montant_min:2000000, montant_max: 6999999, taux: 12000 },
    { montant_min:7000000, montant_max: 11999999, taux: 18000 },
    { montant_min:12000000, montant_max: 999999999999, taux: 36000 }
  ], null, 2);
  applyParamsFromUI();
}

// Portage logique PL/SQL → JS
function get_impot_liquide(pi_brut_imposable){
  const { ABATTEMENT_IR, TAUX_ABATTEMENT_IR, bareme_ir } = State;
  let l_brut_abattu = pi_brut_imposable - Math.min(ABATTEMENT_IR, TAUX_ABATTEMENT_IR * pi_brut_imposable);
  l_brut_abattu = Math.max(l_brut_abattu, 0);
  let l_impot_liquide = 0;
  for (const c of bareme_ir) {
    if (l_brut_abattu >= c.montant_min) {
      const max = (c.montant_max==null? Number.POSITIVE_INFINITY : c.montant_max);
      l_impot_liquide += (Math.min(l_brut_abattu, max) - c.montant_min) * c.taux;
    }
  }
  return l_impot_liquide;
}

function get_reduction_impot(pi_impot_liquide, pi_nombre_parts){
  let l_reduction = 0;
  for (const c of State.reduction_ir) {
    if (Number(pi_nombre_parts) === Number(c.nombre_parts)) {
      l_reduction = Math.max(Math.min(pi_impot_liquide * c.taux_reduction, c.montant_max), c.montant_min);
    }
  }
  return Math.max(l_reduction, 0);
}

function get_impot_revenu(pi_montant_imposable, pi_nombre_mois, pi_nombre_parts){
  const { TAUX_ABATTEMENT_IR, ABATTEMENT_IR, TAUX_MAXIMAL_IR } = State;
  const l_brut_imposable_annuel = pi_montant_imposable * 12 / pi_nombre_mois;
  const l_brut_abattu_annuel = l_brut_imposable_annuel - Math.min(l_brut_imposable_annuel * TAUX_ABATTEMENT_IR, ABATTEMENT_IR);
  const l_impot_liquide = get_impot_liquide(l_brut_imposable_annuel);
  const l_reduction_impot = get_reduction_impot(l_impot_liquide, pi_nombre_parts);
  let l_impot_revenu_annuel = l_impot_liquide - l_reduction_impot;
  l_impot_revenu_annuel = Math.min(l_impot_revenu_annuel, TAUX_MAXIMAL_IR * l_brut_imposable_annuel);
  let l_impot_revenu = l_impot_revenu_annuel * pi_nombre_mois / 12;
  l_impot_revenu = Math.max(l_impot_revenu, 0);
  return l_impot_revenu;
}

function get_trimf(pi_brut_imposable, pi_nombre_mois, pi_nombre_conjoints){
  const { bareme_trimf } = State;
  const l_brut_imposable_annuel = pi_brut_imposable / pi_nombre_mois * 12;
  let l_taux_annuel = 0;
  for (const c of bareme_trimf) {
    const max = (c.montant_max==null? Number.POSITIVE_INFINITY : c.montant_max);
    if ((l_brut_imposable_annuel >= c.montant_min && l_brut_imposable_annuel <= max) && l_brut_imposable_annuel > c.taux) {
      l_taux_annuel = c.taux;
    }
  }
  const l_trimf_annuel = (pi_nombre_conjoints + 1) * l_taux_annuel;
  const l_trimf = l_trimf_annuel / 12 * pi_nombre_mois;
  return l_trimf;
}

function get_css(pi_brut_imposable, pi_nombre_mois){
  const { TAUX_CSS_PFAM, TAUX_CSS_ACTR, PLAFOND_CSS_PFAM, PLAFOND_CSS_ACTR } = State;
  const l_brut_imposable_annuel = pi_brut_imposable / pi_nombre_mois * 12;
  const l_css_pfam = Math.min(l_brut_imposable_annuel, PLAFOND_CSS_PFAM) * TAUX_CSS_PFAM;
  const l_css_actr = Math.min(l_brut_imposable_annuel, PLAFOND_CSS_ACTR) * TAUX_CSS_ACTR;
  return { css_pfam: l_css_pfam / 12 * pi_nombre_mois, css_actr: l_css_actr / 12 * pi_nombre_mois };
}

function get_ipres(pi_brut_imposable, pi_nombre_mois, pi_est_cadre){
  const { PLAFOND_IPRES_RG, PLAFOND_IPRES_RC, TAUX_IPRES_RG_EMP, TAUX_IPRES_RG_PAT, TAUX_IPRES_RC_EMP, TAUX_IPRES_RC_PAT } = State;
  const annual = pi_brut_imposable * 12 / pi_nombre_mois;
  let ipres_rg_emp = TAUX_IPRES_RG_EMP * Math.min(annual, PLAFOND_IPRES_RG);
  let ipres_rg_pat = TAUX_IPRES_RG_PAT * Math.min(annual, PLAFOND_IPRES_RG);
  let ipres_rc_emp = TAUX_IPRES_RC_EMP * Math.min(annual, PLAFOND_IPRES_RC);
  let ipres_rc_pat = TAUX_IPRES_RC_PAT * Math.min(annual, PLAFOND_IPRES_RC);
  if (pi_est_cadre === 'N') { ipres_rc_emp = 0; ipres_rc_pat = 0; }
  return {
    ipres_rg_emp: ipres_rg_emp / 12 * pi_nombre_mois,
    ipres_rg_pat: ipres_rg_pat / 12 * pi_nombre_mois,
    ipres_rc_emp: ipres_rc_emp / 12 * pi_nombre_mois,
    ipres_rc_pat: ipres_rc_pat / 12 * pi_nombre_mois,
  };
}

function get_brut_to_net(pi_brut_imposable, pi_nombre_mois, pi_nombre_parts, pi_nombre_conjoints, pi_est_cadre){
  const impot_revenu = get_impot_revenu(pi_brut_imposable, pi_nombre_mois, pi_nombre_parts);
  const trimf = get_trimf(pi_brut_imposable, pi_nombre_mois, pi_nombre_conjoints);
  const { ipres_rg_emp, ipres_rg_pat, ipres_rc_emp, ipres_rc_pat } = get_ipres(pi_brut_imposable, pi_nombre_mois, pi_est_cadre);
  const { css_pfam, css_actr } = get_css(pi_brut_imposable, pi_nombre_mois);
  const total_charges = pi_brut_imposable + ipres_rg_pat + ipres_rc_pat + css_pfam + css_actr;
  const net_a_payer = pi_brut_imposable - impot_revenu - trimf - ipres_rg_emp - ipres_rc_emp;
  return { net_a_payer, impot_revenu, trimf, ipres_rg_emp, ipres_rg_pat, ipres_rc_emp, ipres_rc_pat, css_pfam, css_actr, total_charges };
}

function net_to_brut(pi_montant_net, pi_nombre_mois, pi_nombre_parts){
  let l_min_value = pi_montant_net;
  let l_max_value = pi_montant_net * 2;
  let l_brut_imposable = (l_min_value + l_max_value) / 2;
  let l_net_courant = l_brut_imposable - get_impot_revenu(l_brut_imposable, pi_nombre_mois, pi_nombre_parts);
  let guard = 0;
  while ((l_min_value < l_max_value) && Math.abs(l_net_courant - pi_montant_net) >= 1 && guard < 200) {
    if (l_net_courant < pi_montant_net) { l_min_value = l_brut_imposable; } else { l_max_value = l_brut_imposable; }
    l_brut_imposable = (l_min_value + l_max_value) / 2;
    l_net_courant = l_brut_imposable - get_impot_revenu(l_brut_imposable, pi_nombre_mois, pi_nombre_parts);
    guard++;
  }
  return Math.max(l_brut_imposable, 0);
}

function get_net_to_brut(pi_montant_net, pi_nombre_mois, pi_nombre_parts, pi_nombre_conjoints, pi_est_cadre){
  let l_net_to_brut = net_to_brut(pi_montant_net, pi_nombre_mois, pi_nombre_parts);
  let l_min_value = l_net_to_brut;
  let l_max_value = l_net_to_brut * 2;
  let l_brut_imposable = (l_min_value + l_max_value) / 2;
  let current = get_brut_to_net(l_brut_imposable, pi_nombre_mois, pi_nombre_parts, pi_nombre_conjoints, pi_est_cadre);
  let l_net_courant = current.net_a_payer;
  let guard = 0;
  while ((l_min_value < l_max_value) && Math.abs(l_net_courant - pi_montant_net) >= 1 && guard < 200) {
    if (l_net_courant < pi_montant_net) { l_min_value = l_brut_imposable; } else { l_max_value = l_brut_imposable; }
    l_brut_imposable = (l_min_value + l_max_value) / 2;
    current = get_brut_to_net(l_brut_imposable, pi_nombre_mois, pi_nombre_parts, pi_nombre_conjoints, pi_est_cadre);
    l_net_courant = current.net_a_payer;
    guard++;
  }
  l_net_to_brut = Math.round(Math.max(l_brut_imposable, 0));
  return { brut: l_net_to_brut, ...current };
}

// UI Handlers
function bind() {
  document.getElementById('btn-save-params').addEventListener('click', applyParamsFromUI);
  document.getElementById('btn-load-sample').addEventListener('click', loadSample);
  document.getElementById('btn-b2n').addEventListener('click', () => {
    applyParamsFromUI();
    const brut = parseDec(document.getElementById('b2n_brut').value);
    let mois = Math.max(1, Math.min(12, parseInt(document.getElementById('b2n_mois').value || '12', 10)));
    const parts = parseDec(document.getElementById('b2n_parts').value || '1');
    const conj = parseDec(document.getElementById('b2n_conjoints').value || '0');
    const cadre = document.getElementById('b2n_cadre').value;
    const r = get_brut_to_net(brut, mois, parts, conj, cadre);
    document.getElementById('b2n_net').textContent = fmt(r.net_a_payer);
    document.getElementById('b2n_ir').textContent = fmt(r.impot_revenu);
    document.getElementById('b2n_trimf').textContent = fmt(r.trimf);
    document.getElementById('b2n_rg_emp').textContent = fmt(r.ipres_rg_emp);
    document.getElementById('b2n_rg_pat').textContent = fmt(r.ipres_rg_pat);
    document.getElementById('b2n_rc_emp').textContent = fmt(r.ipres_rc_emp);
    document.getElementById('b2n_rc_pat').textContent = fmt(r.ipres_rc_pat);
    document.getElementById('b2n_css_pfam').textContent = fmt(r.css_pfam);
    document.getElementById('b2n_css_actr').textContent = fmt(r.css_actr);
    document.getElementById('b2n_total_charges').textContent = fmt(r.total_charges);
  });
  document.getElementById('btn-b2n-clear').addEventListener('click', () => {
    ['b2n_brut','b2n_parts','b2n_conjoints'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('b2n_mois').value = 12;
    ['b2n_net','b2n_ir','b2n_trimf','b2n_rg_emp','b2n_rg_pat','b2n_rc_emp','b2n_rc_pat','b2n_css_pfam','b2n_css_actr','b2n_total_charges'].forEach(id => document.getElementById(id).textContent = '—');
  });
  document.getElementById('btn-n2b').addEventListener('click', () => {
    applyParamsFromUI();
    const net = parseDec(document.getElementById('n2b_net').value);
    let mois = Math.max(1, Math.min(12, parseInt(document.getElementById('n2b_mois').value || '12', 10)));
    const parts = parseDec(document.getElementById('n2b_parts').value || '1');
    const conj = parseDec(document.getElementById('n2b_conjoints').value || '0');
    const cadre = document.getElementById('n2b_cadre').value;
    const r = get_net_to_brut(net, mois, parts, conj, cadre);
    document.getElementById('n2b_brut').textContent = fmt(r.brut);
    document.getElementById('n2b_ir').textContent = fmt(r.impot_revenu);
    document.getElementById('n2b_trimf').textContent = fmt(r.trimf);
    document.getElementById('n2b_rg_emp').textContent = fmt(r.ipres_rg_emp);
    document.getElementById('n2b_rg_pat').textContent = fmt(r.ipres_rg_pat);
    document.getElementById('n2b_rc_emp').textContent = fmt(r.ipres_rc_emp);
    document.getElementById('n2b_rc_pat').textContent = fmt(r.ipres_rc_pat);
    document.getElementById('n2b_css_pfam').textContent = fmt(r.css_pfam);
    document.getElementById('n2b_css_actr').textContent = fmt(r.css_actr);
    document.getElementById('n2b_total_charges').textContent = fmt(r.total_charges);
  });
  document.getElementById('btn-n2b-clear').addEventListener('click', () => {
    ['n2b_net','n2b_parts','n2b_conjoints'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('n2b_mois').value = 12;
    ['n2b_brut','n2b_ir','n2b_trimf','n2b_rg_emp','n2b_rg_pat','n2b_rc_emp','n2b_rc_pat','n2b_css_pfam','n2b_css_actr','n2b_total_charges'].forEach(id => document.getElementById(id).textContent = '—');
  });
}

// init
document.addEventListener('DOMContentLoaded', () => { bind(); loadSample(); });
