/**
 * Pricing matrix calculator implementing the exact GTA house cleaning pricing:
 * - 1 Bed / 1 Bath: $140 Retail, $85 Wholesale (Profit $55)
 * - 2 Bed / 1 Bath: $190 Retail, $115 Wholesale (Profit $75)
 * - 3 Bed / 2 Bath: $250 Retail, $155 Wholesale (Profit $95)
 * - 4 Bed / 2 Bath: $310 Retail, $195 Wholesale (Profit $115)
 * - Deep Clean Add-On: +$70 Retail, +$35 Wholesale (Profit $35)
 */
export function calculatePrices(beds: number, baths: number, isDeepClean: boolean) {
  let retail = 140;
  let wholesale = 85;

  if (beds === 1 && baths === 1) {
    retail = 140;
    wholesale = 85;
  } else if (beds === 2 && baths === 1) {
    retail = 190;
    wholesale = 115;
  } else if (beds === 3 && baths === 2) {
    retail = 250;
    wholesale = 155;
  } else if (beds === 4 && baths === 2) {
    retail = 310;
    wholesale = 195;
  } else {
    // Dynamic mapping for other combinations
    const additionalBeds = Math.max(0, beds - 1);
    const additionalBaths = Math.max(0, baths - 1);
    retail = 140 + (additionalBeds * 50) + (additionalBaths * 60);
    wholesale = 85 + (additionalBeds * 30) + (additionalBaths * 40);
  }

  if (isDeepClean) {
    retail += 70;
    wholesale += 35;
  }

  return {
    retail,
    wholesale,
    profit: retail - wholesale
  };
}

/**
 * Maps a GTA suburb/city to its respective regional segment
 */
export function mapCityToRegion(city: string): 'west' | 'north' | 'east' | 'central' {
  const c = city.toLowerCase().trim();
  if (['mississauga', 'brampton', 'oakville', 'burlington'].includes(c)) {
    return 'west';
  }
  if (['vaughan', 'richmond hill', 'thornhill', 'markham'].includes(c)) {
    return 'north';
  }
  if (['scarborough', 'pickering', 'ajax', 'whitby'].includes(c)) {
    return 'east';
  }
  return 'central'; // Default is central (Toronto)
}
