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
    document.addEventListener("cache-updated", (e) => {
      const customEvent = e as CustomEvent;
      this.cacheUpdated(customEvent.detail.div, customEvent.detail.cache);
    });
    document.addEventListener("player-moved", this.playerMoved);
    document.addEventListener(
      "player-inventory-changed",
      this.playerInventoryChanged,
    );
  }

  cacheUpdated(div: HTMLDivElement, cache: Cache) {
    console.log("cache updated");
    const coinCount = div.querySelector<HTMLSpanElement>("#count")!;
    coinCount.textContent = cache.coins.length.toString();
    const coinList = div.querySelector<HTMLSpanElement>("#coins")!;
    coinList.textContent = printCacheCoins(cache);
  }

  playerMoved() {
    console.log("player moved");
    player.marker.setLatLng(player.location);
    createPolyline();
    map.setView(player.location);
    updateLocalCaches();
  }

  playerInventoryChanged() {
    console.log("player inventory changed");
    updateStatusPanel();
    savePlayer();
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
  inventory: loadPlayerCoins() ? loadPlayerCoins()! : [],
  marker: leaflet.marker(OAKES_CLASSROOM),
};
player.marker.bindTooltip("That's you!");
player.marker.addTo(map);

function playerCoinsToMomento(player: Player): string {
  return JSON.stringify(player.inventory);
}

function playerCoinsFromMomento(momento: string): Coin[] {
  return JSON.parse(momento);
}

function savePlayer() {
  localStorage.setItem("player", playerCoinsToMomento(player));
}

function loadPlayerCoins(): Coin[] | null {
  const momento = localStorage.getItem("player");
  if (momento) {
    return playerCoinsFromMomento(momento);
  }
  return null;
}

//reset button
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;
resetButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset?")) {
    localStorage.clear();
    lastPosition = OAKES_CLASSROOM;
    movementHistory.forEach((polyline) => polyline.remove());
    movementHistory.length = 0;
    location.reload();
  }
});

let tracking = false;
let lastPosition: leaflet.LatLng = OAKES_CLASSROOM;
const movementHistory: leaflet.Polyline[] = [];
//live tracking button
const sensorButton = document.querySelector<HTMLButtonElement>("#sensor")!;
sensorButton.addEventListener("click", () => (tracking = !tracking));

function trackPlayer() {
  if (tracking) {
    navigator.geolocation.getCurrentPosition((position) => {
      const latlng = leaflet.latLng(
        position.coords.latitude,
        position.coords.longitude,
      );
      player.location = latlng;
      document.dispatchEvent(new Event("player-moved"));
    });
  }
}

function createPolyline() {
  const latlngs = [player.location, lastPosition];
  const polyline = leaflet.polyline(latlngs, { color: "red" });
  movementHistory.push(polyline.addTo(map));
  lastPosition = player.location;
}

//player movement buttons
const directions = new Map<string, Cell>();
directions.set("north", { i: 1, j: 0 });
directions.set("south", { i: -1, j: 0 });
directions.set("east", { i: 0, j: 1 });
directions.set("west", { i: 0, j: -1 });

directions.forEach((_vector, direction) => {
  const button = document.querySelector<HTMLButtonElement>(`#${direction}`)!;
  button.addEventListener("click", () => {
    movePlayer(directions.get(direction)!);
  });
});

function movePlayer(vector: Cell) {
  const oldLocation = player.location;
  player.location = leaflet.latLng(
    oldLocation.lat + vector.i * TILE_DEGREES,
    oldLocation.lng + vector.j * TILE_DEGREES,
  );
  document.dispatchEvent(new Event("player-moved"));
}

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
let localCaches: Cache[] = [];
let cacheMarkers: leaflet.Rectangle[] = [];

//memento caches
function cacheToMomento(cache: Cache): string {
  return JSON.stringify(cache);
}

function cacheFromMomento(momento: string): Cache {
  return JSON.parse(momento);
}

function storeCache(cache: Cache) {
  localStorage.setItem(
    `${cache.position.i},${cache.position.j}`,
    cacheToMomento(cache),
  );
}

function updateLocalCaches() {
  localCaches.forEach((cache) => {
    storeCache(cache);
  });
  localCaches = [];

  cacheMarkers.forEach((marker) => {
    marker.remove();
  });
  cacheMarkers = [];

  board.getCellsNearPoint(player.location).forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      localCaches.push(spawnCache(cell));
    }
  });
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

function loadCache(cell: Cell) {
  const momento = localStorage.getItem(`${cell.i},${cell.j}`);
  if (momento) {
    const cache = cacheFromMomento(momento);
    return cache;
  } else {
    return generateCache(cell);
  }
}

//create one cache
function spawnCache(cell: Cell): Cache {
  const cache = loadCache(cell);
  renderCache(cache);

  return cache;
}

function renderCache(cache: Cache) {
  const rect = addRectangle(cache.position);
  cacheMarkers.push(rect);
  bindCachePopup(rect, cache);
}

function printCacheCoins(cache: Cache): string {
  let result = ``;
  cache.coins.forEach((coin) => {
    result +=
      `Coin ${coin.location.i}:${coin.location.j}#${coin.serialNumber}\n`;
  });
  return result;
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
                <div><span id= "coins">${printCacheCoins(cache)}</span> </div>
                <button id="withdraw">Withdraw</button>
                <button id="deposit">Deposit</button>`;

    //withdraw coin
    popupDiv
      .querySelector<HTMLButtonElement>("#withdraw")!
      .addEventListener("click", () => {
        if (cache.coins.length > 0) {
          player.inventory.push(cache.coins.shift()!);
          storeCache(cache);

          document.dispatchEvent(new Event("player-inventory-changed"));
          document.dispatchEvent(
            new CustomEvent("cache-updated", {
              detail: { div: popupDiv, cache: cache },
            }),
          );
        }
      });
    //deposit coin
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (player.inventory.length > 0) {
          cache.coins.push(player.inventory.pop()!);
          storeCache(cache);

          document.dispatchEvent(new Event("player-inventory-changed"));
          document.dispatchEvent(
            new CustomEvent("cache-updated", {
              detail: { div: popupDiv, cache: cache },
            }),
          );
        }
      });

    return popupDiv;
  });
}

let time = 0;
function tick() {
  time++;
  if (time > 50) {
    trackPlayer();

    time = 0;
  }

  requestAnimationFrame(tick);
}

document.dispatchEvent(new Event("player-inventory-changed"));
updateLocalCaches();
tick();
