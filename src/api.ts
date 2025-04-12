import axios from 'axios';

interface BusArrival {
  routeShortName: string;
  headsign: string;
  scheduledArrivalTime: string;
  realtimeArrivalTime: string;
  arrivalIn: number; // minutes
}

/**
 * Fetches real-time bus arrival information for a specified stop
 * 
 * @param stopCode - The code of the bus stop
 * @param clientId - Waltti API client ID
 * @param clientSecret - Waltti API client secret
 * @returns Array of bus arrivals with route information
 */
export async function getBusArrivals(
  stopCode: string, 
  clientId: string, 
  clientSecret: string
): Promise<BusArrival[]> {
  // If running in development mode without credentials, use simulated data
  if (process.env.NODE_ENV === 'development' && (!clientId || !clientSecret || clientId === 'your_client_id')) {
    console.log(`Using simulated data for stop ${stopCode}`);
    return simulateBusArrivals(stopCode);
  }
  
  try {
    // Base URL for GTFS-RT API
    const baseUrl = 'https://data.waltti.fi';
    
    // Make the API request with a timeout to prevent hanging
    const response = await axios.get(`${baseUrl}/api/v2/gtfsrt/v1/trip-updates`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // Validate response data
    if (!response.data || !response.data.entity) {
      throw new Error('Invalid or empty response data from API');
    }

    // Process and filter data for the specific stop
    const now = new Date();
    const arrivals: BusArrival[] = [];

    // Process the data based on GTFS-RT format
    for (const entity of response.data.entity) {
      if (entity?.tripUpdate?.stopTimeUpdate) {
        for (const update of entity.tripUpdate.stopTimeUpdate) {
          if (update?.stopId === stopCode && update?.arrival?.time) {
            const arrivalTime = new Date(update.arrival.time * 1000);
            const arrivalInMinutes = Math.round((arrivalTime.getTime() - now.getTime()) / 60000);
            
            // Only include future arrivals
            if (arrivalInMinutes >= 0) {
              arrivals.push({
                routeShortName: entity.tripUpdate?.vehicle?.label || 'Unknown',
                headsign: entity.tripUpdate?.trip?.tripHeadsign || 'Unknown',
                scheduledArrivalTime: arrivalTime.toLocaleTimeString(),
                realtimeArrivalTime: arrivalTime.toLocaleTimeString(),
                arrivalIn: arrivalInMinutes
              });
            }
          }
        }
      }
    }

    // If no arrivals were found, log this but don't throw an error
    if (arrivals.length === 0) {
      console.log(`No upcoming arrivals found for stop ${stopCode}`);
    }

    // Sort by arrival time
    return arrivals.sort((a, b) => a.arrivalIn - b.arrivalIn);
  } catch (error) {
    // Improved error logging with more details
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`API error for stop ${stopCode}: Status ${error.response.status}`, 
          error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        console.error(`Network error for stop ${stopCode}: No response received`, 
          error.message);
      } else {
        // Something happened in setting up the request
        console.error(`Request setup error for stop ${stopCode}:`, error.message);
      }
    } else {
      console.error(`Error fetching bus arrivals for stop ${stopCode}:`, error);
    }
    
    // Fallback to simulated data if API call fails
    console.log(`Falling back to simulated data for stop ${stopCode}`);
    return simulateBusArrivals(stopCode);
  }
}

/**
 * For testing purposes - simulate bus arrivals when actual API is not available
 * @param stopCode - The code of the bus stop
 * @returns Simulated array of bus arrivals
 */
export function simulateBusArrivals(stopCode: string): BusArrival[] {
  const now = new Date();
  const arrivals: BusArrival[] = [];
  
  // Generate random arrivals for testing
  const routes = ['1', '2', '3', '8', '12', '20', '25', '28'];
  const destinations = ['City Center', 'Hervanta', 'Tammela', 'Kaleva', 'Lentävänniemi', 'TAYS'];
  
  // Generate 1-5 random arrivals
  const count = Math.floor(Math.random() * 5) + 1;
  
  for (let i = 0; i < count; i++) {
    const minutesFromNow = Math.floor(Math.random() * 60) + i * 5;
    const arrivalTime = new Date(now.getTime() + minutesFromNow * 60000);
    
    arrivals.push({
      routeShortName: routes[Math.floor(Math.random() * routes.length)],
      headsign: destinations[Math.floor(Math.random() * destinations.length)],
      scheduledArrivalTime: arrivalTime.toLocaleTimeString(),
      realtimeArrivalTime: arrivalTime.toLocaleTimeString(),
      arrivalIn: minutesFromNow
    });
  }
  
  // Sort by arrival time
  return arrivals.sort((a, b) => a.arrivalIn - b.arrivalIn);
}