/* ============================================================
   Calculateur IR — 2022+ (Impôt uniquement)
   - Abattement: min(900 000 ; 30% du brut annuel théorique)
   - Barème 2022+
   - Réduction selon nombre de parts (min/max/taux)
   - Plafond: 43% du brut annuel théorique
   - Prorata: mois de présence
   ============================================================ */
(function(){
  // ---- Utilitaires
  const $ = s => document.querySelector(s);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmin = Math.min, fmax = Math.max;
  const fmt = new Intl.NumberFormat('fr-FR', { style:'currency', currency:'XOF', maximumFractionDigits:0 });

  // ---- Paramètres (2022+)
  const P = {
    abattementPlafond: 900000,
    abattementTaux: 0.30,
    tauxMax: 0.43,
    // Barème progressif 2022+ : [min, max, taux]
    bareme: [
      [       0,   630000, 0.00 ],
      [  630001,  1500000, 0.20 ],
      [ 1500001,  4000000, 0.30 ],
      [ 4000001,  8000000, 0.35 ],
      [ 8000001, 13500000, 0.37 ],
      [13500001, 50000000, 0.40 ],
      [50000001, Infinity, 0.43 ]
    ],
    // Réductions: [parts, min, max, taux]
    reductions: [
      [1.0,     0,       0,     0.00],
      [1.5, 100000,  300000,   0.10],
      [2.0, 200000,  650000,   0.15],
      [2.5, 300000, 1100000,   0.20],
      [3.0, 400000, 1650000,   0.25],
      [3.5, 500000, 2030000,   0.30],
      [4.0, 600000, 2490000,   0.35],
      [4.5, 700000, 2755000,   0.40],
      [5.0, 800000, 3180000,   0.45],
    ]
  };

  // ---- Fonctions de calcul
  const abattement = brutAnnuel => Math.min(P.abattementPlafond, P.abattementTaux * brutAnnuel);

  function impotProgressif(revenuAbattu){
    let imp = 0;
    for(const [min, max, taux] of P.bareme){
      const base = fmax(fmin(revenuAbattu, max) - min, 0);
      imp += base * taux;
    }
    return imp;
  }

  function reductionIR(impotLiquide, parts){
    const row = P.reductions.find(r => r[0] === parts);
    if(!row) return 0;
    const [, minR, maxR, taux] = row;
    return fmax( fmin(impotLiquide * taux, maxR), minR );
  }

  /** Calcule l'impôt pour la période (mois de présence) */
  function ImpotRevenu(brutPeriode, parts, moisPresence){
    moisPresence = clamp(Number(moisPresence||12), 1, 12);
    const brutAnnuel = (Number(brutPeriode||0) * 12) / moisPresence;
    const revenuAbattu = fmax(brutAnnuel - abattement(brutAnnuel), 0);
    const impLiquide = impotProgressif(revenuAbattu);
    const reduc = reductionIR(impLiquide, Number(parts||1));
    const impAnnuel = fmin(impLiquide - reduc, P.tauxMax * brutAnnuel);
    const impPeriode = fmax((impAnnuel * moisPresence) / 12, 0);
    return Math.round(impPeriode);
  }

  // ---- UI: événements
  $('#calcIR').addEventListener('click', () => {
    const parts = Number($('#parts').value);
    const mois  = Number($('#months').value);
    const brut  = Number($('#brut').value);

    if(!(parts >= 1) || !(mois >= 1 && mois <= 12) || !(brut >= 0)){
      $('#resIR').textContent = 'Veuillez vérifier vos entrées (parts ≥ 1, mois 1–12, brut ≥ 0).';
      return;
    }
    const imp = ImpotRevenu(brut, parts, mois);
    $('#resIR').innerHTML =
      `Impôt pour la période (2022+) : <strong>${fmt.format(imp)}</strong>`;
  });

  $('#reset').addEventListener('click', () => {
    $('#parts').value  = 1.5;
    $('#months').value = 12;
    $('#brut').value   = 1500000;
    $('#resIR').textContent = '';
  });

  $('#example').addEventListener('click', () => {
    $('#parts').value  = 2.0;
    $('#months').value = 12;
    $('#brut').value   = 2_000_000;
  });
})();
