// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

//cell flyweight representation
import { Board } from "./board.ts";

class EventListener {
  constructor() {
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.addEventListener("cache-updated", this.cacheUpdated);
    document.addEventListener("player-moved", this.playerMoved);
    document.addEventListener(
      "player-inventory-changed",
      this.playerInventoryChanged,
    );
  }

  cacheUpdated() {
    console.log("cache updated");
  }

  playerMoved() {
    console.log("player moved");
  }

  playerInventoryChanged() {
    console.log("player inventory changed");
    updateStatusPanel();
  }
}

interface Cell {
  i: number;
  j: number;
}

interface Cache {
  coins: Coin[];
  position: Cell;
}

interface Coin {
  location: Cell;
  serialNumber: number;
}

interface Player {
  location: leaflet.LatLng;
  inventory: Coin[];
  marker: leaflet.Marker;
}

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const COIN_PROBABILITY = 25;

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

const _listener: EventListener = new EventListener();

const player: Player = {
  location: OAKES_CLASSROOM,
  inventory: [],
  marker: leaflet.marker(OAKES_CLASSROOM),
};
player.marker.bindTooltip("That's you!");
player.marker.addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No coins yet...";

function updateStatusPanel() {
  statusPanel.innerHTML = `<div>${player.inventory.length} coins collected</div>
  `;
  player.inventory.forEach((coin) => {
    statusPanel.innerHTML +=
      `<div> Coin ${coin.location.i}:${coin.location.j}#${coin.serialNumber}</div>`;
  });
}

const board: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

//create one cache
function spawnCache(cell: Cell) {
  const cache = generateCache(cell);
  renderCache(cache);
}

function generateCache(cell: Cell): Cache {
  const cache: Cache = {
    coins: [],
    position: cell,
  };

  //add coins to cache deterministically
  const num_coins: number = Math.ceil(
    luck([cell.i, cell.j].toString()) * COIN_PROBABILITY,
  );
  for (let i = 0; i < num_coins; i++) {
    cache.coins.push({ location: cell, serialNumber: i });
  }

  return cache;
}

function renderCache(cache: Cache) {
  const rect = addRectangle(cache.position);
  bindCachePopup(rect, cache);
}

function addRectangle(position: Cell): leaflet.Rectangle {
  const bounds = board.getCellBounds(position);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  return rect;
}

function bindCachePopup(rect: leaflet.Rectangle, cache: Cache) {
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${cache.position.i},${cache.position.j}".</div>
                <div>It contains <span id="count">${cache.coins.length}</span> coin(s).</div>
                <button id="withdraw">Withdraw</button>
                <button id="deposit">Deposit</button>`;

    //withdraw coin
    popupDiv
      .querySelector<HTMLButtonElement>("#withdraw")!
      .addEventListener("click", () => {
        if (cache.coins.length > 0) {
          player.inventory.push(cache.coins.shift()!);
          const coinCount = document.querySelector<HTMLSpanElement>("#count")!;
          coinCount.textContent = cache.coins.length.toString();
          document.dispatchEvent(new Event("player-inventory-changed"));
          document.dispatchEvent(new Event("cache-updated"));
        }
      });
    //deposit coin
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (player.inventory.length > 0) {
          cache.coins.push(player.inventory.pop()!);

          //should be moved to event listener?
          const coinCount = document.querySelector<HTMLSpanElement>("#count")!;
          coinCount.textContent = cache.coins.length.toString();
          document.dispatchEvent(new Event("player-inventory-changed"));
          document.dispatchEvent(new Event("cache-updated"));
        }
      });

    return popupDiv;
  });
}

//add parameter for player position
function populateMap() {
  //player position
  const origin = OAKES_CLASSROOM;

  board.getCellsNearPoint(origin).forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell);
    }
  });
}

populateMap();
