testing branch

/* daiwik - name formatting */
document.querySelector("#reporterName").addEventListener("input" ,e => {
  const formattedValue = formatNameToTitleCase(e.target.value);
        e.target.value = formattedValue;
})
function formatNameToTitleCase(input) {
    // Handle empty input
    if (!input) return '';
    
    // Split on spaces and hyphens, keeping both spaces and hyphens
    const words = input.toLowerCase().split(' ');
    
    return words.map(word => {
        // Handle hyphenated names
        if (word.includes('-')) {
            return word.split('-')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join('-');
        }
        // Regular word capitalization
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');  // Join with space
}

/* daiwik - number formatting */
document.querySelector("#reporterPhone").addEventListener("input" ,e => {
  const formattedValue = formatPhoneNumber(e.target.value);
        e.target.value = formattedValue;
})
function formatPhoneNumber(input) {
  // Remove all non-numeric characters
  let cleaned = input.replace(/\D/g, '');
  
  // Handle different lengths of phone numbers
  if (cleaned.length > 11) {
      cleaned = cleaned.substring(0, 11);
  }
  
  // Check if it starts with country code 1
  let hasCountryCode = cleaned.length === 11 && cleaned.charAt(0) === '1';
  let numberToFormat = hasCountryCode ? cleaned.substring(1) : cleaned;
  
  // Format based on the length of the number
  let formatted;
  if (numberToFormat.length === 10) {
      formatted = `(${numberToFormat.substring(0, 3)}) ${numberToFormat.substring(3, 6)}-${numberToFormat.substring(6)}`;
      if (hasCountryCode) {
          formatted = `+1 ${formatted}`;
      }
  } else if (numberToFormat.length < 10) {
      // Handle partial input
      if (numberToFormat.length > 6) {
          formatted = `(${numberToFormat.substring(0, 3)}) ${numberToFormat.substring(3, 6)}-${numberToFormat.substring(6)}`;
      } else if (numberToFormat.length > 3) {
          formatted = `(${numberToFormat.substring(0, 3)}) ${numberToFormat.substring(3)}`;
      } else {
          formatted = numberToFormat.length ? `(${numberToFormat}` : '';
      }
  }
  
  return formatted || '';
}
