import { isValidPhoneNumber } from 'libphonenumber-js';

function resolveCountryCode(c) {
  if (!c) return 'IN';
  const str = String(c).trim().toUpperCase();
  if (str === 'INDIA' || str === 'IN' || str.includes('ORD')) return 'IN'; // Assuming ORD rows in sample might default to IN
  if (str === 'SINGAPORE' || str === 'SG') return 'SG';
  if (str === 'USA' || str === 'US' || str === 'UNITED STATES') return 'US';
  if (str === 'UK' || str === 'GB' || str === 'UNITED KINGDOM') return 'GB';
  if (str === 'AUSTRALIA' || str === 'AU') return 'AU';
  if (str === 'CANADA' || str === 'CA') return 'CA';
  return 'IN';
}

function validatePhone(val, countryStr) {
  if (!val) return "Phone number is missing";
  const clean = val.replace(/[\s\-\(\)\+]/g, "");
  if (!/^\d+$/.test(clean)) return `Phone contains non-numeric characters`;
  
  const isoCode = resolveCountryCode(countryStr);
  
  try {
    if (!isValidPhoneNumber(val.trim(), isoCode)) {
      return `Invalid global phone number format for country: ${isoCode}`;
    }
  } catch (err) {
    return `Invalid global phone number format for country: ${isoCode}`;
  }
  return null;
}

function validateEmail(val) {
  if (!val) return "Email is missing";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Invalid email format";
  return null;
}

function validateDate(val) {
  if (!val) return null;
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
  ];
  const matches = formats.some((f) => f.test(val.trim()));
  if (!matches) return `Date "${val}" doesn't match expected formats (YYYY-MM-DD or DD/MM/YYYY)`;
  const d = new Date(val);
  if (isNaN(d.getTime())) return `Date "${val}" is not a valid date`;
  return null;
}

function validateAmount(val) {
  if (!val) return null;
  if (isNaN(parseFloat(val))) return `Amount "${val}" is not a valid number`;
  if (parseFloat(val) < 0) return "Amount cannot be negative";
  return null;
}

function validatePaymentMode(val, country) {
  if (!val) return "Payment mode is missing";
  const modes = ["UPI", "CREDIT CARD", "DEBIT CARD", "CARD", "NET BANKING", "PAYNOW", "PAYPAL", "CASH", "BANK TRANSFER"];
  const mode = String(val).trim().toUpperCase();
  if (!modes.includes(mode)) {
    return `Invalid payment mode "${val}". Accepted: UPI, Credit Card, Debit Card, Card, Net Banking, PayNow, PayPal, Cash, Bank Transfer.`;
  }
  if (country) {
    const c = String(country).trim().toUpperCase();
    if (c === "SG" && mode !== "PAYNOW" && mode !== "CREDIT CARD" && mode !== "CARD") {
      return `Payment mode "${val}" is not allowed for SG. Only PayNow, Credit Card, and Card are accepted.`;
    }
    if (c === "IN" && mode === "PAYNOW") {
      return `Payment mode "${val}" is not allowed for IN. PayNow is invalid.`;
    }
  }
  return null;
}

export function guessFieldType(header) {
  const h = header.toLowerCase();
  if (h.includes("payment") || h.includes("mode")) return "payment";
  if (h.includes("phone") || h.includes("mobile") || h.includes("contact")) return "phone";
  if (h.includes("email") || h.includes("mail")) return "email";
  if (h.includes("date") || h.includes("time") || h.includes("created") || h.includes("updated")) return "date";
  if (h.includes("amount") || h.includes("price") || h.includes("total") || h.includes("cost")) return "amount";
  return "text";
}

export function validateRow(row, headers) {
  const errors = [];
  for (const header of headers) {
    const val = row[header];
    const type = guessFieldType(header);
    let err = null;
    const countryHeader = headers.find((h) => h.toLowerCase().includes("country"));
    const countryVal = countryHeader ? row[countryHeader] : null;

    if (type === "phone") err = validatePhone(val, countryVal);
    else if (type === "email") err = validateEmail(val);
    else if (type === "date") err = validateDate(val);
    else if (type === "amount") err = validateAmount(val);
    else if (type === "payment") {
      err = validatePaymentMode(val, countryVal);
    }
    else if (!val || String(val).trim() === "") err = `${header} is empty`;
    if (err) errors.push({ field: header, message: err });
  }
  return errors;
}

export function autoFixRow(row, headers) {
  for (const header of headers) {
    const val = row[header];
    const type = guessFieldType(header);
    if (type === "phone" && val) {
      row[header] = val.replace(/[\s\-\(\)]/g, "");
    }
    if (type === "email" && val) {
      row[header] = val.trim().toLowerCase();
    }
    if (type === "date" && val) {
      const trimmed = val.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [p1, p2, y] = trimmed.split("/");
        let d = p1, m = p2;
        if (parseInt(p2, 10) > 12) {
          m = p1; d = p2; // It was MM/DD/YYYY
        }
        row[header] = `${y}-${m}-${d}`;
      }
    }
    if (type === "text" && (!val || String(val).trim() === "")) {
      row[header] = "N/A";
    }
  }
  return row;
}
