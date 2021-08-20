// Artifactory v0.31
// The artifactory plugin is modified from https://plugins.zkga.me/
// 1.Add "Fire" to capture target planet

import {
  html,
  render,
  useState,
  useLayoutEffect,
} from 'https://unpkg.com/htm/preact/standalone.module.js';

import {
  energy,
  coords,
  unlockTime,
  canWithdraw,
  hasArtifact,
  canHaveArtifact,
} from 'https://plugins.zkga.me/utils/utils.js';

import {
  Energy,
  EnergyGrowth,
  Defense,
  Range,
  Speed,
} from 'https://plugins.zkga.me/game/Icons.js';

import {
  EMPTY_ADDRESS
} from "https://cdn.skypack.dev/@darkforest_eth/constants"

import {
  BiomeNames
} from "https://cdn.skypack.dev/@darkforest_eth/types"

// 30 seconds
let REFRESH_INTERVAL = 1000 * 30;
// 10 minutes
let AUTO_INTERVAL = 1000 * 60 * 10;

function isUnowned(planet) {
  return planet.owner === EMPTY_ADDRESS;
}

function isMine(planet) {
  return planet.owner === df.account;
}

function canDeposit(planet) {
  return planet && isMine(planet) && !planet.heldArtifactId
}

function calcBonus(bonus) {
  return bonus - 100
}

function myPlanetsCache() {
  return Array.from(df.getMyPlanets())
    .filter(p => p.planetLevel >= 1);
}

function myPlanetsWithFindable() {
  return Array.from(df.getMyPlanets())
    .filter(df.isPlanetMineable)
    .sort((p1, p2) => parseInt(p1.locationId, 16) - parseInt(p2.locationId, 16));
}

function myPlanetsWithArtifacts() {
  return Array.from(df.getMyPlanets())
    .filter(hasArtifact)
    .sort((p1, p2) => parseInt(p1.locationId, 16) - parseInt(p2.locationId, 16));
}

function allPlanetsWithArtifacts() {
  return Array.from(df.getAllPlanets())
    .filter(canHaveArtifact)
    .sort((p1, p2) => parseInt(p1.locationId, 16) - parseInt(p2.locationId, 16));
}

function myArtifactsToDeposit() {
  return df.getMyArtifacts()
    .filter(artifact => !artifact.onPlanetId)
    .sort((a1, a2) => parseInt(a1.id, 16) - parseInt(a2.id, 16));
}

function findArtifacts() {
  let currentBlockNumber = df.contractsAPI.ethConnection.blockNumber;
  Array.from(df.getMyPlanets())
    .filter(canHaveArtifact)
    .forEach(planet => {
      try {
        if (isFindable(planet, currentBlockNumber)) {
          df.findArtifact(planet.locationId);
        } else if (isProspectable(planet) && enoughEnergyToProspect(planet) && !planet.unconfirmedProspectPlanet) {
          df.prospectPlanet(planet.locationId);
        }
      } catch (err) {
        console.log(err);
      }
    });
}

function withdrawArtifacts() {
  Array.from(df.getMyPlanets())
    .filter(canWithdraw)
    .forEach(planet => {
      try {
        df.withdrawArtifact(planet.locationId);
      } catch (err) {
        console.log(err);
      }
    });
}

function blocksLeftToProspectExpiration(
  currentBlockNumber,
  prospectedBlockNumber
) {
  return (prospectedBlockNumber || 0) + 255 - currentBlockNumber;
}

function prospectExpired(currentBlockNumber, prospectedBlockNumber) {
  return blocksLeftToProspectExpiration(currentBlockNumber, prospectedBlockNumber) <= 0;
}

function isFindable(planet, currentBlockNumber) {
  return (
    currentBlockNumber !== undefined &&
    df.isPlanetMineable(planet) &&
    planet.prospectedBlockNumber !== undefined &&
    !planet.hasTriedFindingArtifact &&
    !prospectExpired(currentBlockNumber, planet.prospectedBlockNumber)
  );
}

function isProspectable(planet) {
  return df.isPlanetMineable(planet) && planet.prospectedBlockNumber === undefined;
}

function enoughEnergyToProspect(p) {
  return p.energy / p.energyCap > 0.955;
}

function distance(from, to) {
    let fromloc = from.location;
    let toloc = to.location;
    //return Math.sqrt((fromloc.coords.x - toloc.coords.x) ** 2 + (fromloc.coords.y - toloc.coords.y) ** 2);
	//return parseInt(Math.sqrt(Math.pow((fromloc.coords.x - toloc.coords.x), 2) + Math.pow((fromloc.coords.y - toloc.coords.y), 2)));
	return (fromloc.coords.x - toloc.coords.x);
}

function FindButton({ planet, currentBlockNumber }) {
  let [finding, setFinding] = useState(false);

  let button = {
    marginLeft: '5px',
    opacity: finding ? '0.5' : '1',
  };

  function findArtifact() {
    try {
      // Why does this f'ing throw?
      df.findArtifact(planet.locationId);
    } catch (err) {
      console.log(err);
      setFinding(true);
    }
    setFinding(true);
  }

  if (isFindable(planet, currentBlockNumber)) {
    return html`
      <button style=${button} onClick=${findArtifact} disabled=${finding}>
        ${finding ? 'Finding...' : 'Find!'}
      </button>
    `;
  }
}

function ProspectButton({ planet }) {
  let [prospecting, setProspect] = useState(false);

  let button = {
    marginLeft: '5px',
    opacity: prospecting ? '0.5' : '1',
  };

  function prospectPleant() {
    try {
      if (!planet.unconfirmedProspectPlanet) {
        df.prospectPlanet(planet.locationId);
      }
    } catch (err) {
      console.log(err);
      setProspect(true);
    }
    setProspect(true);
  }

  if (isProspectable(planet) && enoughEnergyToProspect(planet)) {
    return html`
      <button style=${button} onClick=${prospectPleant} disabled=${prospecting}>
        ${prospecting ? 'Prospecting...' : 'Prospect!'}
      </button>
    `;
  }
}

function WithdrawButton({ planet }) {
  let [withdrawing, setWithdrawing] = useState(false);

  let button = {
    marginLeft: '5px',
    opacity: withdrawing ? '0.5' : '1',
  };

  function withdrawArtifact() {
    try {
      // Does this throw too?
      df.withdrawArtifact(planet.locationId);
    } catch (err) {
      console.log(err);
    }
    setWithdrawing(true);
  }

  if (canWithdraw(planet)) {
    return html`
      <button style=${button} onClick=${withdrawArtifact} disabled=${withdrawing}>
        ${withdrawing ? 'Withdrawing...' : 'Withdraw!'}
      </button>
    `;
  }
}

function Multiplier({ Icon, bonus }) {
  let diff = calcBonus(bonus);
  let style = {
    marginLeft: '5px',
    marginRight: '10px',
    color: diff < 0 ? 'red' : 'green',
    minWidth: '32px',
  };
  let text = diff < 0 ? `${diff}%` : `+${diff}%`
  return html`
    <${Icon} />
    <span style=${style}>${text}</span>
  `;
}

function Unfound({ selected }) {
  if (!selected) {
    return
  }

  let planetList = {
    maxHeight: '300px',
    overflowX: 'hidden',
    overflowY: 'scroll',
  };

  let currentBlockNumber = df.contractsAPI.ethConnection.blockNumber;

  let [lastLocationId, setLastLocationId] = useState(null);

  let planets = myPlanetsWithFindable()
    .filter(planet => !planet.hasTriedFindingArtifact && (planet.prospectedBlockNumber === undefined || !prospectExpired(currentBlockNumber, planet.prospectedBlockNumber)))

  let planetsChildren = planets.map(planet => {
    let planetEntry = {
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      color: lastLocationId === planet.locationId ? 'pink' : '',
    };

    let biome = BiomeNames[planet.biome];
    let { x, y } = planet.location.coords;

    function centerPlanet() {
      let planet = df.getPlanetWithCoords({ x, y });
      if (planet) {
        ui.centerPlanet(planet);
        setLastLocationId(planet.locationId);
      }
    }

    let text = `LV${planet.planetLevel} ${biome} at ${coords(planet)} - ${energy(planet)}% energy`;
    return html`
      <div key=${planet.locationId} style=${planetEntry}>
        <span onClick=${centerPlanet}>${text}</span>
        <${ProspectButton} planet="${planet}" />
        <${FindButton} planet=${planet} currentBlockNumber=${currentBlockNumber} />
      </div>
    `;
  });

  return html`
    <div style=${planetList}>
      ${planetsChildren.length ? planetsChildren : 'No artifacts to find right now.'}
    </div>
  `;
}

// TODO: Bonuses in this panel?
function Withdraw({ selected }) {
  if (!selected) {
    return;
  }

  let planetList = {
    maxHeight: '300px',
    overflowX: 'hidden',
    overflowY: 'scroll',
  };

  let [lastLocationId, setLastLocationId] = useState(null);

  const planets = myPlanetsWithArtifacts()
    .sort((p1, p2) => p1.artifactLockedTimestamp - p2.artifactLockedTimestamp);

  let planetsChildren = planets.map(planet => {
    let planetEntry = {
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      color: lastLocationId === planet.locationId ? 'pink' : '',
    };

    let biome = BiomeNames[planet.biome];
    let { x, y } = planet.location.coords;

    function centerPlanet() {
      let planet = df.getPlanetWithCoords({ x, y });
      if (planet) {
        ui.centerPlanet(planet);
        setLastLocationId(planet.locationId);
      }
    }

    let text = `${biome} at ${coords(planet)} - ${unlockTime(planet)}`;
    return html`
      <div key=${planet.locationId} style=${planetEntry}>
        <span onClick=${centerPlanet}>${text}</span>
        <${WithdrawButton} planet=${planet} />
      </div>
    `;
  });

  return html`
    <div style=${planetList}>
      ${planetsChildren.length ? planetsChildren : 'No artifacts on your planets.'}
    </div>
  `;
}

function Deposit({ selected }) {
  if (!selected) {
    return;
  }

  let artifactList = {
    maxHeight: '300px',
    overflowX: 'hidden',
    overflowY: 'scroll',
  };

  let [depositing, setDepositing] = useState(false);

  let [planet, setPlanet] = useState(ui.getSelectedPlanet);

  useLayoutEffect(() => {
    const sub = ui.selectedPlanetId$.subscribe(() => {
      setPlanet(ui.getSelectedPlanet());
    });

    return sub.unsubscribe;
  }, []);

  let artifacts = myArtifactsToDeposit();

  let artifactChildren = artifacts.map(artifact => {
    let wrapper = {
      display: 'flex',
      marginBottom: '10px',
    };
    let button = {
      marginLeft: 'auto',
      opacity: depositing ? '0.5' : '1',
    };
    let {
      energyCapMultiplier,
      energyGroMultiplier,
      defMultiplier,
      rangeMultiplier,
      speedMultiplier
    } = artifact.upgrade;

    let deposit = () => {
      if (canDeposit(planet) && !depositing) {
        // TODO: Fast depositing
        setDepositing(true);
        df.depositArtifact(planet.locationId, artifact.id);
      }
    }

    return html`
      <div key=${artifact.id} style=${wrapper}>
        <${Multiplier} Icon=${Energy} bonus=${energyCapMultiplier} />
        <${Multiplier} Icon=${EnergyGrowth} bonus=${energyGroMultiplier} />
        <${Multiplier} Icon=${Defense} bonus=${defMultiplier} />
        <${Multiplier} Icon=${Range} bonus=${rangeMultiplier} />
        <${Multiplier} Icon=${Speed} bonus=${speedMultiplier} />
        ${canDeposit(planet) ? html`
          <button style=${button} onClick=${deposit} disabled=${depositing}>
            ${depositing ? 'Depositing...' : 'Deposit'}
          </button>` : null}
      </div>
    `;
  });

  return html`
    <div style=${artifactList}>
      ${artifactChildren.length ? artifactChildren : 'No artifacts to deposit.'}
    </div>
  `;
}

function Untaken({ selected }) {
  if (!selected) {
    return;
  }

  let planetList = {
    maxHeight: '300px',
    overflowX: 'hidden',
    overflowY: 'scroll',
  };
  const inputGroup = {
    display: 'flex',
    alignItems: 'center',
  };
  const input = {
    flex: '1',
    padding: '5px',
    margin: 'auto 5px',
    outline: 'none',
    color: 'black',
  };

  let { x: homeX, y: homeY } = ui.getHomeCoords()

  let [lastLocationId, setLastLocationId] = useState(null);
  let [centerX, setCenterX] = useState(homeX);
  let [centerY, setCenterY] = useState(homeY);

  const onChangeX = (e) => {
    return setCenterX(e.target.value)
  }

  const onChangeY = (e) => {
    setCenterY(e.target.value)
  }

  const planets = allPlanetsWithArtifacts()
    .filter(isUnowned);

  let myPlanetsArray = myPlanetsCache();
	//console.log('>>Build Planet Cache:' + myPlanetsArray);
	
  let planetsArray = planets.map(planet => {
    let x = planet.location.coords.x;
    let y = planet.location.coords.y;
    let distanceFromTargeting = parseInt(Math.sqrt(Math.pow((x - centerX), 2) + Math.pow((y - centerY), 2)));

    return {
      locationId: planet.locationId, biome: planet.biome, planetLevel: planet.planetLevel,
      x, y, distanceFromTargeting
    };
  });

  planetsArray.sort((p1, p2) => (p1.distanceFromTargeting - p2.distanceFromTargeting));

  let planetsChildren = planetsArray.map(planet => {

    let { locationId, x, y, distanceFromTargeting, planetLevel } = planet;
    let biome = BiomeNames[planet.biome];
	//let nearestX = x;
	//let nearestY = y;

    let planetEntry = {
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      color: lastLocationId === locationId ? 'pink' : '',
    };

    function centerPlanet() {
      //let planet = df.getPlanetWithCoords({ x, y });
	  let planet = df.getPlanetWithId(locationId);
	  //console.log('centerPlanet-1:' + locationId + " ->" + planet);
      if (planet) {
        ui.centerPlanet(planet);
        setLastLocationId(planet.locationId);
      }
    }
	function centerNearestPlanet() {
      myPlanetsArray.sort((p1, p2) => (
		Math.sqrt(Math.pow((p1.location.coords.x - x), 2) + Math.pow((p1.location.coords.y - y), 2))
		- 
		Math.sqrt(Math.pow((p2.location.coords.x - x), 2) + Math.pow((p2.location.coords.y - y), 2))
		));
		
		if (myPlanetsArray[0]) {
			ui.centerPlanet(myPlanetsArray[0]);
			setLastLocationId(myPlanetsArray[0].locationId);
		}
    }
	function execCapturePlanet() {
		let pTarget = df.getPlanetWithId(locationId);
        //let planet = df.getPlanetWithCoords({ nearestX, nearestY });
        //console.log('execCapturePlanet-1:' + myPlanetsArray);

		captureTargetPlanet(pTarget, myPlanetsArray);
    }

	//console.log('PlanetId:' + locationId);
	let txtFireButton = "[Fire]";
	let unconfirmedMoves = df.getUnconfirmedMoves().filter(move => move.to === locationId)
	if (unconfirmedMoves.length !== 0) txtFireButton = "[Sending..]";
	if (getArrivalTXsForPlanet(locationId).length !== 0) txtFireButton = "[Sending..]";
		
	
	let extraInfo = "[NA]";
	
    let text = `LV${planetLevel} ${biome} ${distanceFromTargeting} away ${extraInfo}`;
    return html`
      <div key=${locationId} style=${planetEntry}>
        <span onClick=${centerPlanet}>${text}</span>
		<span onClick=${centerNearestPlanet}>[Near]</span>
		<span onClick=${execCapturePlanet}>${txtFireButton}</span>
      </div>
    `;
  });

  return html`
    <div style=${inputGroup}>
      <div>X: </div>
      <input
        style=${input}
        value=${centerX}
        onChange=${onChangeX}
        placeholder="center X" />
      <div>Y: </div>
      <input
        style=${input}
        value=${centerY}
        onChange=${onChangeY}
        placeholder="center Y" />
    </div>
    <div style=${planetList}>
      ${planetsChildren.length ? planetsChildren : 'No artifacts to find right now.'}
    </div>
  `;
}

function AutoButton({ loop, onText, offText }) {
  let button = {
    marginLeft: '10px',
  };

  let [isOn, setIsOn] = useState(false);
  let [timerId, setTimerId] = useState(null);

  function toggle() {
    setIsOn(!isOn);
  }

  useLayoutEffect(() => {
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }

    if (isOn) {
      // Run once before interval
      loop();
      let timerId = setInterval(loop, AUTO_INTERVAL);
      setTimerId(timerId);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isOn]);

  return html`
    <button style=${button} onClick=${toggle}>${isOn ? onText : offText}</button>
  `;
}

function App() {
  let buttonBar = {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '10px',
  };

  // ['unfound', 'withdraw', 'deposit', 'untaken']
  let [tab, setTab] = useState('unfound');
  let [_, setLoop] = useState(0);

  useLayoutEffect(() => {
    let intervalId = setInterval(() => {
      setLoop(loop => loop + 1)
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    }
  }, []);

  return html`
    <div style=${buttonBar}>
      <button onClick=${() => setTab('unfound')}>Unfound</button>
      <button onClick=${() => setTab('withdraw')}>Withdraw</button>
      <button onClick=${() => setTab('deposit')}>Deposit</button>
      <button onClick=${() => setTab('untaken')}>Untaken</button>
    </div>
    <div>
      <${Unfound} selected=${tab === 'unfound'} />
      <${Withdraw} selected=${tab === 'withdraw'} />
      <${Deposit} selected=${tab === 'deposit'} />
      <${Untaken} selected=${tab === 'untaken'} />
    </div>
    <div>
      <span>Auto:</span>
      <${AutoButton} onText="Cancel Find" offText="Find" loop=${findArtifacts} />
      <${AutoButton} onText="Cancel Withdraw" offText="Withdraw" loop=${withdrawArtifacts} />
    </div>
  `;
}
function captureTargetPlanet(pTarget, myPlanetsArray, maxDistributeEnergyPercent = 100, minimumEnergyAllowed = 100) {
		//console.log('captureTargetPlanet-1:' + myPlanetsArray);
		
		let unconfirmedMoves = df.getUnconfirmedMoves().filter(move => move.to === pTarget.locationId)
		if (unconfirmedMoves.length !== 0) return 0;
			
		// Rejected if target already has pending arrivals
        let arrivals = getArrivalTXsForPlanet(pTarget.locationId);
        if (arrivals.length !== 0) return 0;
		
		
		myPlanetsArray.sort((p1, p2) => (
		Math.sqrt(Math.pow((p1.location.coords.x - pTarget.location.coords.x), 2) + Math.pow((p1.location.coords.y - pTarget.location.coords.y), 2))
		- 
		Math.sqrt(Math.pow((p2.location.coords.x - pTarget.location.coords.x), 2) + Math.pow((p2.location.coords.y - pTarget.location.coords.y), 2))
		));
		

		let count = 0, sentCount = 0;
		let energySent = 0, energySentSum = 0;
		let energyForTarget = pTarget.energyCap * minimumEnergyAllowed / 100;
		let energyForAcquire = (pTarget.energy * (pTarget.defense / 100)) + 1;
        let energyNeedArriving = energyForTarget + energyForAcquire;
		for (let pFrom of myPlanetsArray) {
			count++;
			if(pFrom.planetLevel - pTarget.planetLevel >= 3) continue;
			
			//Skip if has unconfirmed outbound moves
			unconfirmedMoves = df.getUnconfirmedMoves().filter(move => move.from === pFrom.locationId)
			if (unconfirmedMoves.length !== 0) continue;
			
			//Skip if energy at low level
			if(pFrom.energy / pFrom.energyCap < 0.75) continue;

			//Skip if energy inefficiency
			energySent = (pFrom.planetLevel < 4) ? pFrom.energy - 1 : pFrom.energy * 0.75; //cant 100% energy...tx will be revert
			let energyArrival = df.getEnergyArrivingForMove(pFrom.locationId, pTarget.locationId, energySent)
			if(energyArrival / energySent < 0.25) continue;
			if(energyArrival < energyForAcquire * 1.0) continue;
			
			if(energyArrival > energyNeedArriving){
				energySent = Math.ceil(df.getEnergyNeededForMove(pFrom.locationId, pTarget.locationId, energyNeedArriving));
				//console.log('>>captureTargetPlanet-Adjust EnergySent:' + energyNeedArriving + " / " + energySent);
			}
			//let energyNeeded = Math.ceil(df.getEnergyNeededForMove(pFrom.locationId, pTarget.locationId, energyNeedArriving));
			
			energySent = parseInt(energySent, 10);
			energySentSum += energySent;
			
			//console.log('>>captureTargetPlanet-2:['+(count)+']Level=' + pFrom.planetLevel + ',Sent' + energySent + ', p=' + (energySent / pFrom.energy * 100) + '%');
			df.move(pFrom.locationId, pTarget.locationId, energySent, 0);
			
			if(energySentSum >= energyForAcquire)
				break;
			
			sentCount++;
			if(sentCount > 3) break;
		}
		
		if(energySentSum == 0)
			console.log('>>captureTargetPlanet-3:['+(count)+']Cant Find Any Near Planet..');
		
		return energySentSum;
}
function capturePlanets(pFrom, pTarget, maxDistributeEnergyPercent = 100, minimumEnergyAllowed = 0) {
    //const pFrom = df.getPlanetWithId(fromId);
	//const pTarget = df.getPlanetWithId(targetId);

    // Rejected if has pending outbound moves
    let unconfirmed = df.getUnconfirmedMoves().filter(move => move.from === pFrom.locationId)
    if (unconfirmed.length !== 0) {
        return 0;
    }

    const energyBudget = Math.floor((maxDistributeEnergyPercent / 100) * pFrom.energy);

        // Rejected if has unconfirmed pending arrivals
        unconfirmed = df.getUnconfirmedMoves().filter(move => move.to === pTarget.locationId)
        if (unconfirmed.length !== 0) {
            return 0;
        }

        // Rejected if has pending arrivals
        const arrivalTXs = getArrivalTXsForPlanet(pTarget.locationId);
        if (arrivalTXs.length !== 0) {
            return 0;
        }

        // set minimum above energy to % or 1 (if 0%), depending on minimumEnergyAllowed value
        const energyForCandidate = minimumEnergyAllowed === 0 ? 1 : pTarget.energyCap * minimumEnergyAllowed / 100;
        const energyArriving = energyForCandidate + (pTarget.energy * (pTarget.defense / 100));
        // needs to be a whole number for the contract
        const energyNeeded = Math.ceil(df.getEnergyNeededForMove(pFrom.locationId, pTarget.locationId, energyArriving));
        if (energyNeeded > energyBudget) {
            return 0;
        }

        df.move(pFrom.locationId, pTarget.locationId, energyNeeded, 0);

    return energyNeeded;
}


function getArrivalTXsForPlanet(planetId) {
    return df.getAllVoyages().filter(arrival => arrival.toPlanet === planetId).filter(p => p.arrivalTime > Date.now() / 1000);
}

class Artifactory {
  constructor() {
    this.container = null;
  }

  async render(container) {
    this.container = container;

    container.style.width = '450px';

    render(html`<${App} />`, container);
  }

  destroy() {
    render(null, this.container);
  }
}


export default Artifactory;
