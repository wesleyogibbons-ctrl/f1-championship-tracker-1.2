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
    
    // Calculate track bounds
    const trackHeight = layer.parentElement.offsetHeight - 100;
    const maxPoints = Math.max(...data.map(d => parseFloat(d.points)));

    // 1. Sort highest points to lowest points (Leader goes first)
    const sortedData = [...data].sort((a, b) => b.points - a.points);

    // 2. Track the last Y coordinate used in each of the 5 lanes
    let laneMemory = [-200, -200, -200, -200, -200]; 

    sortedData.forEach((entry, index) => {
        const points = parseFloat(entry.points);
        const teamId = mode === 'driver' ? entry.Constructors[0].constructorId : entry.Constructor.constructorId;
        const name = mode === 'driver' ? entry.Driver.familyName : entry.Constructor.name;
        const id = mode === 'driver' ? entry.Driver.driverId : entry.Constructor.constructorId;

        // Proportional Y calculation
        const yPos = maxPoints > 0 ? ((maxPoints - points) / maxPoints) * trackHeight : trackHeight;

        // 3. MIDDLE-OUT LOGIC: Find the first available lane from the center outward
        let chosenLane = 0;
        for (let l = 0; l < LANE_OFFSETS.length; l++) {
            // Is this lane empty at this Y-height?
            if (yPos > laneMemory[l] + VERTICAL_BUFFER) {
                chosenLane = l;
                break;
            }
        }
        
        // If the grid is extremely packed, cycle through as a failsafe
        if (chosenLane === undefined) chosenLane = index % LANE_OFFSETS.length;
        
        // Mark this lane as occupied at this height
        laneMemory[chosenLane] = yPos;

        // 4. Create or update the car DOM element
        let car = document.getElementById(`${mode}-${id}`);
        if (!car) {
            car = document.createElement('div');
            car.id = `${mode}-${id}`;
            car.className = 'car-node';
            layer.appendChild(car);
        }

        // Apply Position
        car.style.left = LANE_OFFSETS[chosenLane];
        // -50% centers the car exactly on the left% percentage mark
        car.style.transform = `translate(-50%, ${yPos}px)`;
        
        // Z-Index: ensure cars lower on points stay visually behind the leaders
        car.style.zIndex = Math.round(yPos);

        const teamColor = TEAM_CONFIG[teamId]?.color || '#888';
        car.innerHTML = `
            <img src="${TEAM_CONFIG[teamId]?.img || ''}" onerror="this.src='https://media.formula1.com/d_team_car_fallback_image.png'">
            <div class="label" style="border-bottom: 3px solid ${teamColor}">
                ${name.toUpperCase()} (${points})
            </div>
        `;
    });
}

// Initial load and auto-refresh
syncData();
setInterval(syncData, 60000);
