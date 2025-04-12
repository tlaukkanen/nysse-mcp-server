import { BusStop, loadStopDataFromCsv } from './stops-data';

/**
 * Loads bus stop data using the stops-data module
 * @returns Promise resolving to an array of BusStop objects
 */
export async function loadStopData(): Promise<BusStop[]> {
  return loadStopDataFromCsv();
}

// Re-export the BusStop interface for convenience
export type { BusStop } from './stops-data';