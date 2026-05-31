const parseField = (field, lang) => {
  if (!field) return '';
  
  if (typeof field === 'object') {
    const val = field[lang] !== undefined ? field[lang] : (
      field.fr !== undefined ? field.fr : (
        field.en !== undefined ? field.en : (
          field.pt !== undefined ? field.pt : ''
        )
      )
    );
    return val || '';
  }
  
  if (typeof field !== 'string') return field;
  
  try {
    let current = field.trim();
    
    // Handle double-serialization quote wrapping if present
    if (current.startsWith('"') && current.endsWith('"')) {
      try {
        current = JSON.parse(current);
      } catch {
        // Keep original if parsing fails
      }
    }
    
    // If parsed to object in step above
    if (current && typeof current === 'object') {
      const val = current[lang] !== undefined ? current[lang] : (
        current.fr !== undefined ? current.fr : (
          current.en !== undefined ? current.en : (
            current.pt !== undefined ? current.pt : ''
          )
        )
      );
      return val || '';
    }
    
    if (typeof current === 'string' && current.startsWith('{')) {
      const parsed = JSON.parse(current);
      if (parsed && typeof parsed === 'object') {
        const val = parsed[lang] !== undefined ? parsed[lang] : (
          parsed.fr !== undefined ? parsed.fr : (
            parsed.en !== undefined ? parsed.en : (
              parsed.pt !== undefined ? parsed.pt : ''
            )
          )
        );
        return val || '';
      }
    }
    return field;
  } catch {
    return field;
  }
};

const rawState = '{"fr":"","en":"","pt":""}';
console.log('Result of parsing raw state string:', JSON.stringify(parseField(rawState, 'pt')));

const doubleSerialized = '"{\\"fr\\":\\"\\",\\"en\\":\\"\\",\\"pt\\":\\"\\"}"';
console.log('Result of parsing double serialized state:', JSON.stringify(parseField(doubleSerialized, 'pt')));
