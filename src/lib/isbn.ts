// A book's barcode is an EAN-13 that is also its ISBN-13: 13 digits starting with 978 or 979.
// Returns the ISBN, or null for other barcodes (groceries, price add-ons, misreads).
export function isbnFromBarcode(data: string): string | null {
  const digits = data.replace(/\D/g, '');
  if (!/^97[89]\d{10}$/.test(digits)) return null;

  const sum = [...digits.slice(0, 12)].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0
  );
  return (10 - (sum % 10)) % 10 === Number(digits[12]) ? digits : null;
}
