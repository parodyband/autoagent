/**
 * Block comment
 */
function process(x: number): string {
  if (x > 0) {
    return 'positive';
  } else if (x < 0) {
    return 'negative';
  }
  switch (x) {
    case 0: return 'zero';
    case 1: return 'one';
  }
  try {
    const y = x && x > 0 || false;
  } catch (e) {
    console.error(e);
  }
  return x?.toString() ?? 'unknown';
}