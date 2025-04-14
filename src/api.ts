import { loadTripDataFromCsvString, TripData } from './trips-data';
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

interface BusArrival {
  routeId: string;
  headsign: string;
  scheduledArrivalTime: string;
  realtimeArrivalTime: string;
  arrivalIn: number; // minutes
  arrivalTime: Date;
  tripId: string;
}

interface BusInformation {
  routeId: string;
  tripId: string;
  vehicleId: string;
  licensePlate: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
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
  if ((!clientId || !clientSecret || clientId === 'your_client_id')) {
    throw new Error('Client ID and Client Secret are required for production use.');
  }
  
  try {
    // Base URL for GTFS-RT API
    const baseUrl = 'https://data.waltti.fi';
    
    const response = await fetch(`${baseUrl}/tampere/api/gtfsrealtime/v1.0/feed/tripupdate`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    });
    if (!response.ok) {
      const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
      throw error;
    }
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Process and filter data for the specific stop
    const now = new Date();
    const arrivals: BusArrival[] = [];

    // Get matching trip information
    const trips = await loadTripDataFromCsvString();

    // Process the data based on GTFS-RT format
    for (const entity of feed.entity) {
      if (entity?.tripUpdate?.stopTimeUpdate) {
        for (const update of entity.tripUpdate.stopTimeUpdate) {
          if (update?.stopId === stopCode) {
            const trip = trips.find((trip:TripData) => trip.trip_id === entity.tripUpdate?.trip?.tripId);
            const tripId = trip ? trip.trip_id : 'Unknown';
            const busNumber = trip?.route_id || 'Unknown';
            const busHeadsign = trip?.trip_headsign || 'Unknown';

            const arrivalTime = new Date(update.arrival.time * 1000);
            const arrivalInMinutes = Math.round((arrivalTime.getTime() - now.getTime()) / 60000);

            // Only include future arrivals
            if (arrivalInMinutes >= 0) {
              arrivals.push({
                routeId: busNumber,
                headsign: busHeadsign,
                scheduledArrivalTime: arrivalTime.toLocaleTimeString(),
                realtimeArrivalTime: arrivalTime.toLocaleTimeString(),
                arrivalIn: arrivalInMinutes,
                arrivalTime: arrivalTime,
                tripId: tripId,
              });
            }

            // Exit loop if we have enough arrivals
            if (arrivals.length >= 5) {
              break;
            }
          }
        }

        if (arrivals.length >= 5) {
          break;
        }
      }
    }

    // Sort by arrival time
    return arrivals.sort((a, b) => a.arrivalIn - b.arrivalIn);
  } catch (error) {
    throw new Error(`Error fetching bus arrivals for stop ${stopCode}: ${error}`);
  }
}

export async function getBusPosition(
  vehicleSearchText: string, 
  clientId: string, 
  clientSecret: string
): Promise<BusInformation[]> {
  // If running in development mode without credentials, use simulated data
  if (process.env.NODE_ENV === 'development' && (!clientId || !clientSecret || clientId === 'your_client_id')) {
    return [];
  }
  
  try {
    // Base URL for GTFS-RT API
    const baseUrl = 'https://data.waltti.fi';
    
    const response = await fetch(`${baseUrl}/tampere/api/gtfsrealtime/v1.0/feed/vehicleposition`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    });
    if (!response.ok) {
      const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
      throw error;
    }
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Process and filter data for the specific stop
    const now = new Date();
    const buses: BusInformation[] = [];

    // Get matching trip information
    const trips = await loadTripDataFromCsvString();

    // Process the data based on GTFS-RT format
    for (const entity of feed.entity) {
      //console.error(`${JSON.stringify(entity)}`);
      if (entity?.vehicle) {
        const vehicleUpdate = entity.vehicle;

        // Don't check if vehicle doesn't have position info
        if (!vehicleUpdate?.position) {
          continue;
        }

        const trip = trips.find((trip:TripData) => trip.trip_id === vehicleUpdate?.trip?.tripId);

        let collectData = false;
        if(vehicleUpdate.id === vehicleSearchText) {
          collectData = true;
        }
        else if(trip?.route_id === vehicleSearchText) {
          collectData = true;
        }
        else if(vehicleUpdate.vehicle?.license_plate === vehicleSearchText) {
          collectData = true;
        }
        if(collectData) {
          const vehicleId = vehicleUpdate.vehicle?.id || 'Unknown';
          const licensePlate = vehicleUpdate.vehicle?.licensePlate || 'Unknown';
          const speed = vehicleUpdate.position?.speed || 0;
          const latitude = vehicleUpdate.position?.latitude || 0;
          const longitude = vehicleUpdate.position?.longitude || 0;
          const bearing = vehicleUpdate.position?.bearing || 0;

          const busInformation : BusInformation = {
            routeId: trip?.route_id || 'Unknown',
            tripId: trip?.trip_id || 'Unknown',
            vehicleId: vehicleId,
            licensePlate: licensePlate,
            latitude: latitude,
            longitude: longitude,
            bearing: bearing,
            // Convert speed from m/s to km/h.
            speed: (speed * 3.6) || 0,
          };

          buses.push(busInformation);
            
          // Exit loop if we have enough busses
          if (buses.length >= 4) {
            break;
          }
        }
      }

      if (buses.length >= 5) {
        break;
      }
    
    }

    // Sort by arrival time
    return buses;
  } catch (error) {
    console.error(`Error fetching bus information:`, error);
    
    // Fallback to simulated data if API call fails
    return [];
  }
  
}
