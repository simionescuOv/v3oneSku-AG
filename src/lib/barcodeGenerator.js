/**
 * Generate a valid EAN-13 barcode.
 * It generates 12 random digits and appends the correct checksum digit.
 * Ensures uniqueness against the locally cached products.
 */
export function generateRandomBarcode(products = []) {
  const MAX_ATTEMPTS = 50;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Generate 12 random digits.
    // Usually internal barcodes might start with '2' (in-store numbering)
    // Let's generate a prefix like '200' + 9 random digits.
    let base = '200';
    for (let i = 0; i < 9; i++) {
      base += Math.floor(Math.random() * 10).toString();
    }

    // Calculate checksum
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base[i], 10);
      const weight = i % 2 === 0 ? 1 : 3; // 0-based index: even index is odd position (1st, 3rd = index 0, 2)
      sum += digit * weight;
    }

    const checksum = (10 - (sum % 10)) % 10;
    const barcode = base + checksum.toString();

    // Check if available
    if (isBarcodeAvailable(barcode, products)) {
      return barcode;
    }
  }

  // Fallback
  return Date.now().toString().slice(-13).padStart(13, '0');
}

export function isBarcodeAvailable(barcode, products) {
  if (!barcode) return true;
  return !products.some((p) => p.barcode === barcode);
}
