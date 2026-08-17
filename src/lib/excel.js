const CDN_URL =
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

let loading = null;

function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('SheetJS CDN load failed'));
    document.head.appendChild(script);
  });

  return loading;
}

export async function exportToExcel(rows, filename = 'export.xlsx') {
  const XLSX = await loadSheetJS();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

export async function importFromExcel(file) {
  const XLSX = await loadSheetJS();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/**
 * Extrage structurat anteturile și rândurile de date din fișiere CSV / XLSX.
 * Returnează: { headers: string[], rows: object[] }
 */
export async function parseFileForImport(file) {
  const XLSX = await loadSheetJS();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const ws = wb.Sheets[sheetName];
  // header: 1 returnează matrice 2D: [ [col1, col2, ...], [val1, val2, ...], ... ]
  const rawGrid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rawGrid || rawGrid.length === 0) return { headers: [], rows: [] };

  // Identifică primul rând ne-gol ca fiind rândul de antet (headers)
  let headerRowIdx = -1;
  for (let i = 0; i < rawGrid.length; i++) {
    if (rawGrid[i] && rawGrid[i].some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return { headers: [], rows: [] };

  // Extrage și curăță anteturile
  const rawHeaders = rawGrid[headerRowIdx].map((h, idx) => {
    const clean = String(h ?? '').trim();
    return clean || `Coloana ${idx + 1}`;
  });

  // Garantează anteturi unice dacă există duplicate
  const headers = [];
  const headerCounts = {};
  for (const h of rawHeaders) {
    if (!headerCounts[h]) {
      headerCounts[h] = 1;
      headers.push(h);
    } else {
      headerCounts[h]++;
      headers.push(`${h} (${headerCounts[h]})`);
    }
  }

  // Extrage rândurile de date
  const rows = [];
  for (let i = headerRowIdx + 1; i < rawGrid.length; i++) {
    const rowCells = rawGrid[i];
    if (!rowCells) continue;

    // Verifică dacă rândul are măcar o celulă completată
    const hasData = rowCells.some(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''
    );
    if (!hasData) continue;

    const rowObj = {};
    headers.forEach((headerName, colIdx) => {
      const cellVal = rowCells[colIdx];
      rowObj[headerName] = cellVal !== undefined && cellVal !== null ? cellVal : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}
