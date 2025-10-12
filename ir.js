/* ============================================================
   Calculateur IR — 2022+
   Abattement, barème 2022+, réductions par parts, plafond 43%,
   prorata des mois, et recherche binaire Net → Brut.
   ============================================================ */
(function(){
  // Utilitaires
  const fmt = new Intl.NumberFormat('fr-FR', { style:'currency', currency:'XOF', maximumFractionDigits:0 });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmin = Math.min, fmax = Math.max;

  // Paramètres (2022+)
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

    // Réductions selon parts : [parts, min, max, taux]
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

  const abattement = brutAnnuel => Math.min(P.abattementPlafond, P.abattementTaux * brutAnnuel);

  function reductionIR(impotLiquide, parts){
    const row = P.reductions.find(r => r[0] === parts);
    if(!row) return 0;
    const [, minR, maxR, taux] = row;
    return fmax( fmin(impotLiquide * taux, maxR), minR );
  }

  function impotProgressif(revenuAbattu){
    let imp = 0;
    for(const [min, max, taux] of P.bareme){
      const base = fmax(fmin(revenuAbattu, max) - min, 0);
      imp += base * taux;
    }
    return imp;
  }

  // Impôt pour la période (en fonction des mois de présence)
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

  // Net → Brut (période) via dichotomie (précision 1 XOF)
  function NetToBrut(netPeriode, parts, moisPresence, eps = 1){
    netPeriode = Number(netPeriode||0);
    if(netPeriode <= 0) return 0;

    let lo = netPeriode, hi = netPeriode * 2, brut = (lo + hi) / 2;
    let iter = 0, maxIter = 80;

    const netFrom = b => b - ImpotRevenu(b, parts, moisPresence);

    let netCourant = netFrom(brut);
    while(lo < hi && Math.abs(netCourant - netPeriode) >= eps && iter < maxIter){
      if(netCourant < netPeriode){ lo = brut; } else { hi = brut; }
      brut = (lo + hi) / 2;
      netCourant = netFrom(brut);
      iter++;
    }
    return Math.max(brut, 0);
  }

  // ---- UI
  const $ = s => document.querySelector(s);

  $('#calcIR').addEventListener('click', () => {
    const brut  = Number($('#brut').value);
    const parts = Number($('#parts').value);
    const mois  = Number($('#months').value);

    if(!(brut >= 0) || !(parts >= 1) || !(mois >= 1 && mois <= 12)){
      $('#resIR').textContent = 'Veuillez vérifier vos entrées.';
      return;
    }
    const imp = ImpotRevenu(brut, parts, mois);
    $('#resIR').innerHTML = `Impôt pour la période (2022+) : <strong>${fmt.format(imp)}</strong>`;
  });

  $('#calcN2B').addEventListener('click', () => {
    const net   = Number($('#net').value);
    const parts = Number($('#parts').value);
    const mois  = Number($('#months').value);

    if(!(net >= 0) || !(parts >= 1) || !(mois >= 1 && mois <= 12)){
      $('#resN2B').textContent = 'Veuillez vérifier vos entrées.';
      return;
    }
    const brut = Math.round(NetToBrut(net, parts, mois, 1));
    const imp  = Math.round(ImpotRevenu(brut, parts, mois));
    $('#resN2B').innerHTML =
      `Brut imposable estimé : <strong>${fmt.format(brut)}</strong><br>
       Impôt correspondant : <strong>${fmt.format(imp)}</strong><br>
       Net obtenu : <strong>${fmt.format(brut - imp)}</strong>`;
  });

  $('#ex1').addEventListener('click', () => {
    $('#parts').value = 1.5;
    $('#months').value = 12;
    $('#brut').value = 1_500_000;
    $('#net').value  = 1_000_000;
  });

  $('#clear').addEventListener('click', () => {
    $('#resIR').textContent = '';
    $('#resN2B').textContent = '';
  });
})();
