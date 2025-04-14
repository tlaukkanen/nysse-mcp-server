#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadStopData, BusStop } from './stops';
import { getBusArrivals, getBusPosition } from './api';
import { z } from "zod";

/**
 * Main entry point for the Nysse MCP Server
 */
async function main() {
  // Check for required environment variables
  const clientId = process.env.WALTTI_CLIENT_ID || 'your_client_id';
  const clientSecret = process.env.WALTTI_CLIENT_SECRET || 'your_client_secret';

  // Set development mode early if we're using simulated data or missing credentials
  if (!clientId || !clientSecret || clientId === 'your_client_id') {
    console.warn('Warning: WALTTI_CLIENT_ID and WALTTI_CLIENT_SECRET not set or using default values.');
  }

  // Load stop data from the file
  const stops = await loadStopData();

  // Create an MCP server instance
  const server = new McpServer(
    {
      name: 'Nysse MCP Server',
      description: 'A server for accessing bus stop data and arrivals in Tampere, Finland',
      version: '0.1.2',
    }
  );

  // Register the findNextBus tool
  server.tool(
    'findNextBus',
    'Find the next buses arriving at a specific stop in Tampere, Finland',
    {
      stopNameOrNumber: z.string().describe('The name or nunmber of the bus stop to search for. Can be a partial name.'),
    },
    async ({ stopNameOrNumber }) => {
      // Find matching stops
      const matchingStops = stops.filter((stop: BusStop) => 
        stop.stop_name.toLowerCase().includes(stopNameOrNumber.toLowerCase()) ||
        stop.stop_code.toLowerCase().includes(stopNameOrNumber.toLowerCase())
      );

      if (matchingStops.length === 0) {
        return { 
          content: [
            {
              type: 'text',
              text: `No bus stops found matching "${stopNameOrNumber}". Please try another stop name.`
            }
          ],
          isError: true
        };
      }

      if (matchingStops.length > 5) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${matchingStops.length} stops matching "${stopNameOrNumber}". Please be more specific.`
            }
          ],
          isError: true
        };
      }

      // Get arrivals only for the first matching stop
      const results = [];
      try {
        const firstStop = matchingStops[0];
        const arrivals = await getBusArrivals(firstStop.stop_code, clientId, clientSecret);
        results.push({
          stop: firstStop.stop_name,
          stopCode: firstStop.stop_code,
          location: `${firstStop.stop_lat}, ${firstStop.stop_lon}`,
          zone: firstStop.zone_id,
          arrivals: arrivals,          
        });
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching bus arrivals for stop "${stopNameOrNumber}". Please try again later.`
            }
          ],
          isError: true
        };
      }

      // Format the results for output
      if (results.length === 0 || results[0].arrivals.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No arrivals found for stop "${stopNameOrNumber}" in near future. Please try again later.`
            }
          ],
          isError: true
        };
      }

      // Format the results for output
      const arrivalsText = results.map((result) => {
        return result.arrivals?.map((arrival) => 
            ` - In ${arrival.arrivalIn} minutes at ${arrival.arrivalTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} : bus ${arrival.routeId} with destination ${arrival.headsign} (Trip ID: ${arrival.tripId})`
          ).join('\n');
      }).join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Next buses arriving to ${matchingStops[0].stop_name} (${matchingStops[0].stop_code}):\n${arrivalsText}`
          }
        ],
      };
    }
  );

  server.tool(
    'getBusInformation',
    'Get information (location, license plate, speed, bearing, id) about a specific bus',
    {
      busSearchText: z.string().default('').describe('The route id, trip id, vehicle id, license plate or other identifier of the bus'),
    },
    async ({ busSearchText = ''}) => {

      const buses = await getBusPosition(busSearchText, clientId, clientSecret);
      if (buses.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No bus information found for the given parameters.`
            }
          ],
          isError: true
        };
      }

      const busInfoText = buses.map(bus => 
        `- Route ID: ${bus.routeId}, Bus ID: ${bus.vehicleId}, License Plate: ${bus.licensePlate}, Position: ${bus.latitude.toFixed(5)},${bus.longitude.toFixed(5)} Speed: ${Math.round(bus.speed)} km/h, Bearing: ${bus.bearing}°`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${buses.length} bus(es) with the given parameters:\n${busInfoText}` 
          }
        ]
      };
    }
  );

  // Register the searchBusStops tool
  server.tool(
    'searchBusStops',
    'Search for bus stops in Tampere, Finland by name',
    {
      query: z.string().describe('The name or partial name of the bus stop to search for')
    },
    async ({ query }) => {
      if (!query || query.trim() === '') {
        return {
          content: [
            {
              type: 'text',
              text: 'Please provide a search term'
            }
          ],
          isError: true
        };
      }

      const matchingStops = stops
        .filter((stop: BusStop) => stop.stop_name.toLowerCase().includes(query.toLowerCase()))
        .map((stop: BusStop) => ({
          name: stop.stop_name,
          code: stop.stop_code,
          location: `${stop.stop_lat}, ${stop.stop_lon}`,
          zone: stop.zone_id
        }));

      if (matchingStops.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No bus stops found matching "${query}". Please try another search term.`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${matchingStops.length} bus stops matching "${query}":\n` +
              matchingStops.map((stop) => `- ${stop.name} (${stop.code})`).join('\n')
          }
        ]
      };
    }
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  if (process.env.NODE_ENV === 'development') {
    //console.log('Running in development mode with simulated data');
  }
}

// Run the server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});