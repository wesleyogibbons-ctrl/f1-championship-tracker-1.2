const TEAM_CONFIG = {
    'mercedes': { color: '#27F4D2', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/mercedes/2026mercedescarright.png' },
    'ferrari': { color: '#E80020', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/ferrari/2026ferraricarright.png' },
    'mclaren': { color: '#FF8000', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/mclaren/2026mclarencarright.png' },
    'audi': { color: '#F50537', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/audi/2026audicarright.png' },
    'cadillac': { color: '#FFD700', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/cadillac/2026cadillaccarright.png' },
    'red_bull': { color: '#3671C6', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/redbullracing/2026redbullracingcarright.png' },
    'aston_martin': { color: '#229971', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/astonmartin/2026astonmartincarright.png' },
    'haas': { color: '#B6BABD', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/haasf1team/2026haasf1teamcarright.png' },
    'racing_bulls': { color: '#6692FF', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/racingbulls/2026racingbullscarright.png' },
    'alpine': { color: '#0093CC', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/alpine/2026alpinecarright.png' },
    'williams': { color: '#64C4FF', img: 'https://media.formula1.com/image/upload/f_auto,q_auto/v1740000000/common/f1/2026/williams/2026williamscarright.png' }
};

// Middle-Out Lane Order: Center, Inner-Right, Inner-Left, Outer-Right, Outer-Left
const LANE_OFFSETS = ["50%", "75%", "25%", "90%", "10%"];
const VERTICAL_BUFFER = 80; // Pixels needed between cars in the same lane

async function syncData() {
    try {
        const year = 2026;
        const [dRes, cRes] = await Promise.all([
            fetch(`https://api.jolpi.ca/ergast/f1/${year}/driverStandings.json`).then(r => r.json()),
            fetch(`https://api.jolpi.ca/ergast/f1/${year}/constructorStandings.json`).then(r => r.json())
        ]);

        const drivers = dRes.MRData.StandingsTable.StandingsLists[0].DriverStandings;
        const teams = cRes.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;

        renderTrack('drivers-layer', drivers, 'driver');
        renderTrack('constructors-layer', teams, 'team');
        document.getElementById('status').innerText = `Live Data Synced: ${new Date().toLocaleTimeString()}`;
    } catch (e) {
        document.getElementById('status').innerText = "Sync Error: API Connection Failed";
    }
}

function renderTrack(layerId, data, mode) {
    const layer = document.getElementById(layerId);
    if (!layer) return;

    // 1. Grid Configuration
    const columns = 5;
    const cellWidth = 100 / columns; // percentage
    const cellHeight = 85; // pixels (height of car + label + gap)
    const trackHeight = layer.parentElement.offsetHeight;
    const maxRows = Math.floor(trackHeight / cellHeight);

    // 2. Create the "Invisible Grid" (a 2D array of booleans)
    // grid[row][column] = true if occupied
    let occupancyGrid = Array.from({ length: maxRows + 10 }, () => Array(columns).fill(false));

    // 3. Sort data: Highest points first
    const sortedData = [...data].sort((a, b) => b.points - a.points);
    const maxPoints = Math.max(...data.map(d => parseFloat(d.points)));

    sortedData.forEach((entry) => {
        const points = parseFloat(entry.points);
        const teamId = mode === 'driver' ? entry.Constructors[0].constructorId : entry.Constructor.constructorId;
        const name = mode === 'driver' ? entry.Driver.familyName : entry.Constructor.name;
        const id = mode === 'driver' ? entry.Driver.driverId : entry.Constructor.constructorId;

        // 4. Calculate Preferred Row based on points
        // Leaders want to be at row 0 (top), 0-pointers want to be at the bottom
        let preferredRow = maxPoints > 0 
            ? Math.floor(((maxPoints - points) / maxPoints) * (maxRows - 1)) 
            : maxRows - 1;

        // 5. FIND EMPTY CELL (Middle-Out Search)
        // Check lanes in order: Center(2), Right(3), Left(1), Far-Right(4), Far-Left(0)
        const laneOrder = [2, 3, 1, 4, 0];
        let finalRow = preferredRow;
        let finalCol = 2;
        let found = false;

        // Search starting at preferred row and moving down until a spot is found
        for (let r = preferredRow; r < occupancyGrid.length && !found; r++) {
            for (let c of laneOrder) {
                if (!occupancyGrid[r][c]) {
                    finalRow = r;
                    finalCol = c;
                    occupancyGrid[r][c] = true; // MARK OCCUPIED
                    found = true;
                    break;
                }
            }
        }

        // 6. Update DOM
        let car = document.getElementById(`${mode}-${id}`);
        if (!car) {
            car = document.createElement('div');
            car.id = `${mode}-${id}`;
            car.className = 'car-node';
            layer.appendChild(car);
        }

        // Positioning
        const xPercent = (finalCol * cellWidth) + (cellWidth / 2);
        const yPixels = finalRow * cellHeight;

        car.style.left = `${xPercent}%`;
        car.style.transform = `translate(-50%, ${yPixels}px)`;
        car.style.zIndex = 1000 - finalRow; // Higher cars appear "over" lower ones

        const teamColor = TEAM_CONFIG[teamId]?.color || '#888';
        car.innerHTML = `
            <img src="${TEAM_CONFIG[teamId]?.img || ''}" onerror="this.src='https://media.formula1.com/d_team_car_fallback_image.png'">
            <div class="label" style="border-bottom: 3px solid ${teamColor}">
                ${name.toUpperCase()} (${points})
            </div>
        `;
    });
}
