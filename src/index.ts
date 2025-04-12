#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadStopData, BusStop } from './stops';
import { getBusArrivals } from './api';
import { z } from "zod";

/**
 * Main entry point for the Nysse MCP Server
 */
async function main() {
  // Check for required environment variables
  const clientId = process.env.WALTTI_CLIENT_ID || 'your_client_id';
  const clientSecret = process.env.WALTTI_CLIENT_SECRET || 'your_client_secret';
  const useSimulatedData = process.env.USE_SIMULATED_DATA === 'true';

  // Set development mode early if we're using simulated data or missing credentials
  if (useSimulatedData || (!clientId || !clientSecret || clientId === 'your_client_id')) {
    process.env.NODE_ENV = 'development';
    //console.warn('Warning: WALTTI_CLIENT_ID and WALTTI_CLIENT_SECRET not set or using default values.');
    //console.warn('Set USE_SIMULATED_DATA=true to use simulated data without credentials.');
    //console.warn('Continuing with simulated data...');
  }

  // Load stop data from the file
  const stops = await loadStopData();
  //console.log(`Loaded ${stops.length} bus stops from data file`);

  // Create an MCP server instance
  const server = new McpServer(
    {
      name: 'Nysse MCP Server',
      description: 'A server for accessing bus stop data and arrivals in Tampere, Finland',
      version: '1.0.0',
    }
  );

  // Register the findNextBus tool
  server.tool(
    'findNextBus',
    'Find the next buses arriving at a specific stop in Tampere, Finland',
    {
      stopName: z.string().describe('The name of the bus stop to search for. Can be a partial name.'),
    },
    async ({ stopName }) => {
      // Find matching stops
      const matchingStops = stops.filter((stop: BusStop) => 
        stop.stop_name.toLowerCase().includes(stopName.toLowerCase()));
      
      if (matchingStops.length === 0) {
        return { 
          content: [
            {
              type: 'text',
              text: `No bus stops found matching "${stopName}". Please try another stop name.`
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
              text: `Found ${matchingStops.length} stops matching "${stopName}". Please be more specific.`
            }
          ],
          stops: matchingStops.slice(0, 10).map((stop: BusStop) => stop.stop_name),
          isError: true
        };
      }

      // Get arrivals for the matching stops
      const results = [];
      for (const stop of matchingStops) {
        try {
          const arrivals = await getBusArrivals(stop.stop_code, clientId, clientSecret);
          results.push({
            stop: stop.stop_name,
            stopCode: stop.stop_code,
            location: `${stop.stop_lat}, ${stop.stop_lon}`,
            zone: stop.zone_id,
            arrivals: arrivals
          });
        } catch (error) {
          console.error(`Error fetching data for stop ${stop.stop_name}:`, error);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} bus stops matching "${stopName}":\n` +
              results.map((result: any) => `- ${result.stop} (${result.stopCode})`).join('\n')
          }
        ],
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