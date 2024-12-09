// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

interface Cell {
  i: number;
  j: number;
}

interface Cache {
  coins: Coin[];
}

interface Coin {
  location: Cell;
  serialNumber: number;
}

addEventListener("cache-updated", (_event) => {});

addEventListener("player-moved", (_event) => {});

addEventListener("player-inventory-changed", (_event) => {});

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8e-4;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display number of coins collected
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

//create one cache
function spawnCache(cell: Cell) {
  const cache: Cache = {
    coins: [],
  };
  cache.coins.push({ location: cell, serialNumber: 0 });

  const bounds = leaflet.latLngBounds([
    [cell.i, cell.j],
    [cell.i + TILE_DEGREES, cell.j + TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${cell.i},${cell.j}".</div>
                <button id="take">Take</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#take")!
      .addEventListener("click", () => {
        if (cache.coins.pop()) {
          //need to convert to events
          playerCoins++;
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      });
    //add drop coin here

    return popupDiv;
  });
}

//add parameter for player position
function populateMap() {
  //player position
  const origin = OAKES_CLASSROOM;
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i += TILE_DEGREES) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j += TILE_DEGREES) {
      // If location i,j is lucky enough, spawn a cache!
      const cell: Cell = { i: i + origin.lat, j: j + origin.lng };
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(cell);
      }
    }
  }
}

populateMap();
