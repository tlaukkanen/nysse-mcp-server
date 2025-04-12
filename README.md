# Tampere Bus MCP Server

This is a Model Context Protocol (MCP) server that provides tools for AI agents to access bus traffic information for Tampere's public transport system. This enables AI assistants to answer questions like "When is the next bus stopping at Tuotekatu bus stop?"

## Features

- Search for bus stops by name
- Get real-time information about upcoming bus arrivals at specific stops
- Access to complete Tampere region bus stop database

## Prerequisites

- Node.js 18 or higher
- Access credentials for the Waltti GTFS-RT API (optional for development)

## Setup for VS Code as NPX MCP Server

Add to your MCP servers:

```
{
  "mcpServers": {
    "nysse-bus-tracker": {
      "command": "npx",
      "args": [
        "-y",
        "nysse-mcp-server"
      ],
      "env": {
        "WALTTI_CLIENT_ID": "YOUR_CLIENT_ID_HERE",
        "WALTTI_CLIENT_SECRET": "YOUR_CLIENT_SECRET_HERE",
        "USE_SIMULATED_DATA": "true/false"
      }
    }
  }
}
```

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables for API access:
   ```
   export WALTTI_CLIENT_ID=your_client_id
   export WALTTI_CLIENT_SECRET=your_client_secret
   ```
   
   In Windows Command Prompt:
   ```
   set WALTTI_CLIENT_ID=your_client_id
   set WALTTI_CLIENT_SECRET=your_client_secret
   ```
   
   In Windows PowerShell:
   ```
   $env:WALTTI_CLIENT_ID="your_client_id"
   $env:WALTTI_CLIENT_SECRET="your_client_secret"
   ```

   Alternatively, for development and testing without API credentials:
   ```
   export USE_SIMULATED_DATA=true
   ```
   
   In Windows Command Prompt:
   ```
   set USE_SIMULATED_DATA=true
   ```
   
   In Windows PowerShell:
   ```
   $env:USE_SIMULATED_DATA="true"
   ```

## Running the Server

Build the project:
```
npm run build
```

Start the server:
```
npm start
```

For development with automatic reloading:
```
npm run dev
```

## Development Mode

When running without API credentials or with `USE_SIMULATED_DATA=true`, the server will generate realistic but fake bus arrivals. This is useful for development and testing without needing real API credentials.

## Available Tools

The server provides the following MCP tools for AI agents:

### findNextBus

Find the next buses arriving at a specific stop in Tampere.

Parameters:
- `stopName`: The name of the bus stop to search for (can be partial)

Example response:
```json
{
  "status": "success",
  "results": [
    {
      "stop": "Tuotekatu",
      "stopCode": "3108",
      "location": "61.4593600013386, 23.7843499831829",
      "zone": "B",
      "arrivals": [
        {
          "routeShortName": "8",
          "headsign": "City Center",
          "scheduledArrivalTime": "14:25:00",
          "realtimeArrivalTime": "14:27:00",
          "arrivalIn": 12
        }
      ]
    }
  ]
}
```

### searchBusStops

Search for bus stops in Tampere by name.

Parameters:
- `query`: The name or partial name of the bus stop to search for

Example response:
```json
{
  "status": "success",
  "stops": [
    {
      "name": "Tuotekatu",
      "code": "3108",
      "location": "61.4593600013386, 23.7843499831829",
      "zone": "B"
    }
  ]
}
```

## Data Source

The bus stop data is loaded from the `stops.txt` file in GTFS format.
Real-time arrival information is fetched from the Waltti GTFS-RT API, or simulated in development mode.

## License

ISC
