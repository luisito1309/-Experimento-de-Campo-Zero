/* ==========================================================================
   ANTIGRAVITY: Experimento de Campo Zero
   script.js - Physics Engine and Canvas Render
   ========================================================================== */

// 1. Simulation Constants & Settings
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const G_CONSTANT = 0.15; // Pixel gravity constant (scaled for smooth canvas physics)

// 2. State Variables
let state = {
  tab: 'intro', // 'intro', 'medidas', 'graficas', 'playground'
  paused: false,
  speed: 1.0, // 1.0 = Normal, 0.25 = Slow
  visualizacionCampo: true,
  autoEstabilidad: true,
  fuerzaCampo: 350, // N (0 - 1000)
  frecuenciaAcustica: 2500, // Hz (1000 - 5000)
  vectorScale: 5, // 1 - 10
  masa: 5.0, // kg
  selectedSample: 'ceramic', // 'ceramic', 'metal', 'plasma'
  stability: 100, // % (0 - 100)
  consumo: 0, // %
  potencia: 0, // %
  collapsed: false,
  aceleracionLocal: 0, // in g units
  
  // Cylinder X coordinate transition (smooth sliding)
  cylinderX: 400,
  targetCylinderX: 400,
  
  // Time tracker for wave animations
  time: 0
};

// 3. Simulation Objects
let samples = {
  ceramic: {
    x: 400,
    y: 390,
    vx: 0,
    vy: 0,
    mass: 15.0,
    width: 60,
    height: 40,
    color: '#a0aec0',
    type: 'ceramic',
    drag: 0.95,
    dragging: false
  },
  metal: {
    x: 400,
    y: 390,
    vx: 0,
    vy: 0,
    mass: 50.0,
    radius: 25,
    color: '#4a5568',
    type: 'metal',
    drag: 0.98, // Low drag, bounces more
    dragging: false
  },
  plasma: {
    x: 400,
    y: 390,
    vx: 0,
    vy: 0,
    mass: 5.0,
    radius: 22,
    color: '#319795',
    type: 'plasma',
    drag: 0.90, // High damping, floats with jiggle
    dragging: false,
    plasmaEnergy: 1.0
  }
};

// Playground Mode: holds multiple spawned objects
let playgroundObjects = [];

// Tools for 'medidas' tab
let ruler = {
  x: 120,
  y: 120,
  width: 60,
  height: 280,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

let stopwatch = {
  x: 580,
  y: 50,
  width: 130,
  height: 90,
  dragging: false,
  offsetX: 0,
  offsetY: 0,
  running: false,
  elapsedTime: 0, // in ms
  lastUpdate: 0
};

// Real-time Graph history
let graphHistory = [];
const MAX_GRAPH_HISTORY = 300;

// Canvas & DOM Cache
let canvas, ctx;
let prevMouseX = 0, prevMouseY = 0;
let isMouseDown = false;

// 4. Initializer
window.addEventListener('DOMContentLoaded', () => {
  initDOM();
  initCanvas();
  resetSimulation();
  
  // Start Main Loop
  requestAnimationFrame(tick);
});

// Cache DOM Elements and bind events
function initDOM() {
  // Input Bindings
  const chkVisualizacion = document.getElementById('chk-visualizacion');
  const chkAutoestabilidad = document.getElementById('chk-autoestabilidad');
  const slideFuerza = document.getElementById('slide-fuerza');
  const slideFrecuencia = document.getElementById('slide-frecuencia');
  const slideVector = document.getElementById('slide-vector');
  const slideMasa = document.getElementById('slide-masa');
  
  const valFuerza = document.getElementById('val-fuerza');
  const valFrecuencia = document.getElementById('val-frecuencia');
  const valMasa = document.getElementById('val-masa');
  
  // Sync initial state
  chkVisualizacion.checked = state.visualizacionCampo;
  chkAutoestabilidad.checked = state.autoEstabilidad;
  slideFuerza.value = state.fuerzaCampo;
  slideFrecuencia.value = state.frecuenciaAcustica;
  slideVector.value = state.vectorScale;
  slideMasa.value = state.masa;
  
  valFuerza.textContent = `${state.fuerzaCampo} N`;
  valFrecuencia.textContent = `${state.frecuenciaAcustica} Hz`;
  valMasa.textContent = `${state.masa.toFixed(1)} kg`;

  // Events
  chkVisualizacion.addEventListener('change', (e) => {
    state.visualizacionCampo = e.target.checked;
  });
  
  chkAutoestabilidad.addEventListener('change', (e) => {
    state.autoEstabilidad = e.target.checked;
  });
  
  slideFuerza.addEventListener('input', (e) => {
    state.fuerzaCampo = parseInt(e.target.value);
    valFuerza.textContent = `${state.fuerzaCampo} N`;
  });

  slideFrecuencia.addEventListener('input', (e) => {
    state.frecuenciaAcustica = parseInt(e.target.value);
    valFrecuencia.textContent = `${state.frecuenciaAcustica} Hz`;
  });

  slideVector.addEventListener('input', (e) => {
    state.vectorScale = parseInt(e.target.value);
  });

  slideMasa.addEventListener('input', (e) => {
    state.masa = parseFloat(e.target.value);
    valMasa.textContent = `${state.masa.toFixed(1)} kg`;
    // Update active object mass
    let activeObj = getActiveObject();
    if (activeObj) activeObj.mass = state.masa;
  });

  // Sample Selectors
  const sampleBtns = document.querySelectorAll('.sample-btn');
  sampleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      sampleBtns.forEach(b => b.classList.remove('active'));
      const btnTarget = e.currentTarget;
      btnTarget.classList.add('active');
      
      const sampleType = btnTarget.dataset.sample;
      state.selectedSample = sampleType;
      
      // Load preset mass
      let presetMass = 15.0;
      if (sampleType === 'ceramic') presetMass = 15.0;
      else if (sampleType === 'metal') presetMass = 50.0;
      else if (sampleType === 'plasma') presetMass = 5.0;
      
      state.masa = presetMass;
      slideMasa.value = presetMass;
      valMasa.textContent = `${presetMass.toFixed(1)} kg`;
      
      let activeObj = getActiveObject();
      if (activeObj) {
        activeObj.mass = presetMass;
        // Place it inside the cylinder base for starting
        activeObj.x = state.cylinderX;
        activeObj.y = 390;
        activeObj.vx = 0;
        activeObj.vy = 0;
      }
      
      // Auto-recover collapsed status when changing samples
      if (state.collapsed) {
        state.collapsed = false;
        state.stability = 100;
      }
    });
  });

  // Reset Button
  document.getElementById('btn-reset').addEventListener('click', () => {
    resetSimulation();
  });

  // Play / Pause
  const btnPlayPause = document.getElementById('btn-play-pause');
  btnPlayPause.addEventListener('click', () => {
    state.paused = !state.paused;
    if (state.paused) {
      btnPlayPause.classList.remove('pause-mode');
      btnPlayPause.classList.add('play-mode');
    } else {
      btnPlayPause.classList.remove('play-mode');
      btnPlayPause.classList.add('pause-mode');
      stopwatch.lastUpdate = Date.now();
    }
  });

  // Speed Toggles
  const btnNormal = document.getElementById('btn-speed-normal');
  const btnSlow = document.getElementById('btn-speed-slow');
  
  btnNormal.addEventListener('click', () => {
    state.speed = 1.0;
    btnNormal.classList.add('active');
    btnSlow.classList.remove('active');
  });

  btnSlow.addEventListener('click', () => {
    state.speed = 0.25;
    btnSlow.classList.add('active');
    btnNormal.classList.remove('active');
  });

  // Navigation Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      const tabTarget = e.currentTarget;
      tabTarget.classList.add('active');
      
      state.tab = tabTarget.dataset.tab;
      
      // Update target cylinder X position based on tab (slide to the right on 'graficas')
      if (state.tab === 'graficas') {
        state.targetCylinderX = 620;
        // Colapsar panel flotante automáticamente para no obstruir el gráfico
        statusPanel.classList.add('collapsed');
        if (collapseBtn) collapseBtn.textContent = '+';
      } else {
        state.targetCylinderX = 400;
        // Expandir el panel automáticamente en la pestaña 'intro' para fácil visualización
        if (state.tab === 'intro') {
          statusPanel.classList.remove('collapsed');
          if (collapseBtn) collapseBtn.textContent = '—';
        }
      }
      
      // Reposition objects smoothly
      let activeObj = getActiveObject();
      if (activeObj && !activeObj.dragging) {
        activeObj.x = state.targetCylinderX;
      }
      
      // In playground mode, clone standard object or reset playground lists
      if (state.tab === 'playground') {
        initPlayground();
      }
    });
  });

  // Arrastre (Drag & Drop) y Colapso del Panel de Estado de Campo Zero
  const statusPanel = document.getElementById('floating-status-panel');
  const collapseBtn = document.getElementById('btn-collapse-status');
  const panelHeader = statusPanel.querySelector('.panel-header');
  
  collapseBtn.addEventListener('click', () => {
    statusPanel.classList.toggle('collapsed');
    collapseBtn.textContent = statusPanel.classList.contains('collapsed') ? '+' : '—';
  });
  
  let isDraggingPanel = false;
  let panelStartX, panelStartY;
  let panelStartLeft, panelStartTop;
  
  panelHeader.addEventListener('mousedown', dragPanelStart);
  panelHeader.addEventListener('touchstart', dragPanelStart, { passive: false });
  
  function dragPanelStart(e) {
    if (e.target.closest('button')) return; // No arrastrar si se hace clic en el botón de colapso
    
    isDraggingPanel = true;
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    
    panelStartX = clientX;
    panelStartY = clientY;
    
    const rect = statusPanel.getBoundingClientRect();
    const parentRect = statusPanel.parentElement.getBoundingClientRect();
    
    panelStartLeft = rect.left - parentRect.left;
    panelStartTop = rect.top - parentRect.top;
    
    document.addEventListener('mousemove', dragPanelMove);
    document.addEventListener('touchmove', dragPanelMove, { passive: false });
    document.addEventListener('mouseup', dragPanelEnd);
    document.addEventListener('touchend', dragPanelEnd);
    
    if (e.cancelable) e.preventDefault();
  }
  
  function dragPanelMove(e) {
    if (!isDraggingPanel) return;
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - panelStartX;
    const dy = clientY - panelStartY;
    
    let newLeft = panelStartLeft + dx;
    let newTop = panelStartTop + dy;
    
    // Contener el panel dentro del simulador (.simulation-view)
    const parentRect = statusPanel.parentElement.getBoundingClientRect();
    const rect = statusPanel.getBoundingClientRect();
    
    newLeft = Math.max(0, Math.min(parentRect.width - rect.width, newLeft));
    newTop = Math.max(0, Math.min(parentRect.height - rect.height, newTop));
    
    statusPanel.style.left = newLeft + 'px';
    statusPanel.style.top = newTop + 'px';
    statusPanel.style.right = 'auto';
    statusPanel.style.bottom = 'auto';
    
    if (e.cancelable) e.preventDefault();
  }
  
  function dragPanelEnd() {
    isDraggingPanel = false;
    document.removeEventListener('mousemove', dragPanelMove);
    document.removeEventListener('touchmove', dragPanelMove);
    document.removeEventListener('mouseup', dragPanelEnd);
    document.removeEventListener('touchend', dragPanelEnd);
  }
}

function initCanvas() {
  canvas = document.getElementById('physics-canvas');
  ctx = canvas.getContext('2d');
  
  // Mouse and Touch listeners
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd);
}

function resetSimulation() {
  state.paused = false;
  state.speed = 1.0;
  state.visualizacionCampo = true;
  state.autoEstabilidad = true;
  state.fuerzaCampo = 350;
  state.frecuenciaAcustica = 2500;
  state.vectorScale = 5;
  state.masa = 5.0;
  state.selectedSample = 'ceramic';
  state.stability = 100;
  state.collapsed = false;
  state.cylinderX = 400;
  state.targetCylinderX = 400;
  
  // Sync UI sliders
  document.getElementById('chk-visualizacion').checked = true;
  document.getElementById('chk-autoestabilidad').checked = true;
  document.getElementById('slide-fuerza').value = 350;
  document.getElementById('slide-frecuencia').value = 2500;
  document.getElementById('slide-vector').value = 5;
  document.getElementById('slide-masa').value = 5.0;
  
  document.getElementById('val-fuerza').textContent = '350 N';
  document.getElementById('val-frecuencia').textContent = '2500 Hz';
  document.getElementById('val-masa').textContent = '5.0 kg';
  
  // Active sample buttons
  document.querySelectorAll('.sample-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-sample-ceramic').classList.add('active');
  
  // Reset samples coordinates
  Object.keys(samples).forEach(k => {
    samples[k].x = 400;
    samples[k].y = 390;
    samples[k].vx = 0;
    samples[k].vy = 0;
    samples[k].dragging = false;
  });
  // Set default starting mass
  samples.ceramic.mass = 5.0;
  
  // Reset Playback UI
  const btnPlayPause = document.getElementById('btn-play-pause');
  btnPlayPause.classList.remove('play-mode');
  btnPlayPause.classList.add('pause-mode');
  
  document.getElementById('btn-speed-normal').classList.add('active');
  document.getElementById('btn-speed-slow').classList.remove('active');
  
  // Tools reset
  ruler.x = 120;
  ruler.y = 120;
  ruler.dragging = false;
  
  stopwatch.x = 580;
  stopwatch.y = 50;
  stopwatch.running = false;
  stopwatch.elapsedTime = 0;
  stopwatch.dragging = false;
  
  graphHistory = [];
  playgroundObjects = [];
  
  // Reset status panel style and state
  const statusPanel = document.getElementById('floating-status-panel');
  const collapseBtn = document.getElementById('btn-collapse-status');
  if (statusPanel) {
    statusPanel.classList.remove('collapsed');
    statusPanel.style.left = '15px';
    statusPanel.style.top = '15px';
    statusPanel.style.right = 'auto';
    statusPanel.style.bottom = 'auto';
  }
  if (collapseBtn) {
    collapseBtn.textContent = '—';
  }
}

// 5. Physics Engine Computations
function updatePhysics(dt) {
  if (state.paused) return;
  
  // Adjust time delta by speed factor
  const simDt = dt * state.speed;
  
  // 1. Calculate Stability & Energy Consumption
  updateStability(simDt);
  updateStatusBars();
  
  // 2. Active Tab updates
  if (state.tab === 'playground') {
    playgroundObjects.forEach(obj => {
      if (!obj.dragging) {
        computeObjectForces(obj, simDt);
      }
    });
  } else {
    let activeObj = getActiveObject();
    if (activeObj && !activeObj.dragging) {
      computeObjectForces(activeObj, simDt);
    }
  }
  
  // 3. Update Stopwatch if running
  if (stopwatch.running) {
    stopwatch.elapsedTime += simDt * 1000; // in simulation ms
  }
  
  // 4. Update Graph History
  let activeObj = getActiveObject();
  if (activeObj && state.tab === 'graficas') {
    // Height scaled between 0 and 100 (relative to cylinder height 280)
    let relativeHeight = (390 - activeObj.y) / 2.7;
    graphHistory.push({
      height: Math.max(0, relativeHeight),
      force: state.fuerzaCampo,
      acceleration: state.aceleracionLocal * 25 // scaling for drawing
    });
    if (graphHistory.length > MAX_GRAPH_HISTORY) {
      graphHistory.shift();
    }
  }
}

function updateStability(dt) {
  if (state.autoEstabilidad) {
    // Fast recovery
    state.stability += (99.0 - state.stability) * 0.08 * dt;
    if (state.collapsed && state.stability > 30) {
      state.collapsed = false; // recover
    }
  } else {
    // Manual mode: stability depends on field force, acoustic frequency, and mass resonant compatibility
    // High power (>750N) or very high/low frequencies induce decay
    let decayFactor = 0;
    
    if (state.fuerzaCampo > 750) {
      decayFactor += (state.fuerzaCampo - 750) * 0.003;
    }
    
    // Unstable frequency bands
    if (state.frecuenciaAcustica > 4000) {
      decayFactor += (state.frecuenciaAcustica - 4000) * 0.002;
    } else if (state.frecuenciaAcustica < 1500) {
      decayFactor += (1500 - state.frecuenciaAcustica) * 0.003;
    }
    
    // Plasma is naturally more volatile
    if (state.selectedSample === 'plasma') {
      decayFactor += 0.5;
    }
    
    if (decayFactor > 0) {
      state.stability -= decayFactor * dt * 0.5;
    } else {
      // Slow recovery in neutral state
      state.stability += (85.0 - state.stability) * 0.02 * dt;
    }
    
    state.stability = Math.max(0, Math.min(100, state.stability));
    
    // Collapse threshold
    if (state.stability < 5 && !state.collapsed) {
      state.collapsed = true;
    }
  }
}

function updateStatusBars() {
  // Potencia
  state.potencia = (state.fuerzaCampo / 1000) * 100;
  
  // Consumo Energético
  // Higher force and frequency increase consumption. Autoestabilidad adds 12% overhead
  let rawConsumo = (state.fuerzaCampo * 0.7 + (state.frecuenciaAcustica - 1000) * 0.07);
  state.consumo = Math.min(100, (rawConsumo / 980) * 100 + (state.autoEstabilidad ? 12 : 0));
  
  // Update DOM Bars
  document.getElementById('bar-potencia').style.width = `${state.potencia}%`;
  document.getElementById('label-potencia').textContent = `${Math.round(state.potencia)}%`;
  
  document.getElementById('bar-estabilidad').style.width = `${state.stability}%`;
  document.getElementById('label-estabilidad').textContent = `${Math.round(state.stability)}%`;
  
  document.getElementById('bar-consumo').style.width = `${state.consumo}%`;
  document.getElementById('label-consumo').textContent = `${Math.round(state.consumo)}%`;
}

function computeObjectForces(obj, dt) {
  // 1. Gravity Force
  const Fg = obj.mass * G_CONSTANT;
  
  // Chamber boundaries
  const chamberLeft = state.cylinderX - 85;
  const chamberRight = state.cylinderX + 85;
  const chamberTop = 120;
  const chamberBottom = 390;
  
  // Detect if inside containment field
  const inChamberX = (obj.x > chamberLeft && obj.x < chamberRight);
  const inChamberY = (obj.y > chamberTop && obj.y < chamberBottom);
  const insideChamber = inChamberX && inChamberY;
  
  let Flift = 0;
  let Facoustic = 0;
  let Fx = 0;
  
  if (insideChamber && !state.collapsed && state.fuerzaCampo > 0) {
    // 2. Electro-Magnetic Antigravity Lift
    // Strongest at center, drops at chamber walls (gaussian-like profile)
    let dx = obj.x - state.cylinderX;
    let distRatio = dx / 85;
    let fieldContainment = Math.exp(-distRatio * distRatio);
    
    // Scale lift by field strength and current stability
    Flift = (state.fuerzaCampo * 0.007) * fieldContainment * (state.stability / 100) * obj.mass;
    
    // Horizontal restoration spring force to keep it floating centered
    Fx = -0.008 * dx * obj.mass;
    
    // 3. Acoustic Standing Wave Force
    // standing wave has node intervals determined by frequency
    let chamberY = obj.y - chamberTop;
    // Wavelength lambda in pixels (1000Hz = ~300px, 5000Hz = ~60px)
    let lambda = 300 * (1500 / state.frecuenciaAcustica);
    // Standing wave radiation force: traps particle at pressure nodes
    Facoustic = - (state.fuerzaCampo * 0.002) * Math.sin((4 * Math.PI * chamberY) / lambda) * obj.mass;
  }
  
  // Total Forces
  let FyTotal = Flift + Facoustic - Fg;
  let FxTotal = Fx;
  
  // 4. Instability Jiggle (Brownian noise)
  if (state.stability < 90 && !state.collapsed && insideChamber) {
    let jiggleFactor = (100 - state.stability) * 0.008;
    // Plasma jiggles double
    if (obj.type === 'plasma') jiggleFactor *= 1.8;
    
    FxTotal += (Math.random() - 0.5) * jiggleFactor * obj.mass;
    FyTotal += (Math.random() - 0.5) * jiggleFactor * obj.mass;
  }
  
  // 5. Drag/Damping
  // Dampen velocities to simulate gas drag and acoustic wave trapping friction
  obj.vx = (obj.vx + (FxTotal / obj.mass)) * obj.drag;
  obj.vy = (obj.vy + (FyTotal / obj.mass)) * obj.drag;
  
  // Integrate
  obj.x += obj.vx * dt * 60;
  obj.y -= obj.vy * dt * 60; // subtract because canvas Y is downwards
  
  // Save dynamic vertical acceleration for display (in terms of gravity units)
  // local g unit = ay / G_CONSTANT
  if (obj === getActiveObject()) {
    let ay = (Flift + Facoustic - Fg) / obj.mass;
    state.aceleracionLocal = ay / G_CONSTANT;
    
    // Add micro-noise to the LED readout for a premium alive feel
    let ledReadout = document.getElementById('led-text');
    let displayedAcc = state.aceleracionLocal;
    
    // Resting on bottom boundary check
    let size = (obj.radius) ? obj.radius : obj.height / 2;
    if (obj.y + size >= 390 && Math.abs(obj.vy) < 0.05) {
      displayedAcc = -1.0; // sitting at 1g down relative to floating
    }
    
    // Let's format the readout string
    if (state.collapsed) {
      ledReadout.textContent = "ALERTA: COLAPSO DE CAMPO (0.00g)";
      ledReadout.style.color = "#ff3333";
      ledReadout.style.textShadow = "0 0 5px rgba(255, 51, 51, 0.5)";
    } else {
      ledReadout.style.color = "#39ff14";
      ledReadout.style.textShadow = "0 0 5px rgba(57, 255, 20, 0.5)";
      
      let noiseVal = (Math.random() - 0.5) * 0.01;
      let finalVal = displayedAcc + noiseVal;
      
      if (Math.abs(finalVal) < 0.01) finalVal = -0.01; // Force user's requested text
      
      let gravText = finalVal < -0.1 ? "(ANTIGRAVITY)" : "(GRAVEDAD NORM)";
      ledReadout.textContent = `Aceleración Local: ${finalVal.toFixed(2)}g ${gravText}`;
    }
  }
  
  // 6. Collision Boundaries
  handleCollisions(obj);
}

function handleCollisions(obj) {
  let sizeX = (obj.radius) ? obj.radius : obj.width / 2;
  let sizeY = (obj.radius) ? obj.radius : obj.height / 2;
  
  const groundY = 460;
  const ceilingY = 20;
  const chamberLeft = state.cylinderX - 85;
  const chamberRight = state.cylinderX + 85;
  const chamberTop = 115;
  const chamberBottom = 395;
  
  // Horizontal bounds (Canvas outer walls)
  if (obj.x - sizeX < 0) {
    obj.x = sizeX;
    obj.vx *= -0.5;
  }
  if (obj.x + sizeX > CANVAS_WIDTH) {
    obj.x = CANVAS_WIDTH - sizeX;
    obj.vx *= -0.5;
  }
  
  // Vertical bounds (Chamber limits or Ground outside)
  const isHorizontallyInChamber = (obj.x + sizeX > chamberLeft && obj.x - sizeX < chamberRight);
  
  if (isHorizontallyInChamber) {
    // Bottom Plate of Chamber
    if (obj.y + sizeY > chamberBottom - 5) {
      obj.y = chamberBottom - 5 - sizeY;
      obj.vy = Math.abs(obj.vy) * 0.3; // bounce slightly
      obj.vx *= 0.8; // friction
    }
    // Top Lid of Chamber
    if (obj.y - sizeY < chamberTop + 5) {
      obj.y = chamberTop + 5 + sizeY;
      obj.vy = -Math.abs(obj.vy) * 0.3;
    }
  } else {
    // Outside Chamber - Lands on desert floor
    if (obj.y + sizeY > groundY) {
      obj.y = groundY - sizeY;
      obj.vy = Math.abs(obj.vy) * 0.2; // soft bounce on sand
      obj.vx *= 0.7; // high friction
    }
  }
  
  // Outer ceiling
  if (obj.y - sizeY < ceilingY) {
    obj.y = ceilingY + sizeY;
    obj.vy = -Math.abs(obj.vy) * 0.3;
  }
}

// 6. Draw Loops
function tick() {
  // Compute frame dt
  const dt = 1 / 60;
  
  // Smooth cylinder X slide
  state.cylinderX += (state.targetCylinderX - state.cylinderX) * 0.1;
  
  // Update state time
  if (!state.paused) {
    state.time += dt * state.speed;
  }
  
  // Physics updates
  updatePhysics(dt);
  
  // Clear & Render
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  drawScenery();
  drawDevice();
  
  if (state.tab === 'playground') {
    playgroundObjects.forEach(obj => drawObject(obj));
  } else {
    let activeObj = getActiveObject();
    if (activeObj) drawObject(activeObj);
  }
  
  // Ruler & Stopwatch in Medidas tab
  if (state.tab === 'medidas') {
    drawRuler();
    drawStopwatch();
  }
  
  // Graph in Graficas tab
  if (state.tab === 'graficas') {
    drawRealTimeGraph();
  }
  
  requestAnimationFrame(tick);
}

// Scenery rendering (Desert background, mountains, sun, rails)
function drawScenery() {
  // 1. Sky Gradient
  let skyGrad = ctx.createLinearGradient(0, 0, 0, 380);
  skyGrad.addColorStop(0, '#5ea3d0'); // deep sky blue
  skyGrad.addColorStop(0.5, '#a1d4f2'); // bright blue
  skyGrad.addColorStop(0.8, '#f7dbad'); // soft sunset orange/yellow
  skyGrad.addColorStop(1, '#e5be85'); // desert horizon yellow
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // 2. Glowing Sun
  ctx.beginPath();
  let sunGrad = ctx.createRadialGradient(150, 100, 5, 150, 100, 50);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.2, '#fff1a8');
  sunGrad.addColorStop(1, 'rgba(255, 241, 168, 0)');
  ctx.fillStyle = sunGrad;
  ctx.arc(150, 100, 50, 0, Math.PI * 2);
  ctx.fill();
  
  // 3. Clouds (slowly drifting)
  let cloudOffset = (state.time * 2) % (CANVAS_WIDTH + 200);
  drawCloud(300 + cloudOffset - 200, 60, 25);
  drawCloud(100 + (cloudOffset*0.5) - 200, 90, 18);
  
  // 4. Far Mountains (Purple/Reddish silhouettes)
  ctx.fillStyle = '#654f5c';
  ctx.beginPath();
  ctx.moveTo(-50, 390);
  ctx.lineTo(80, 250);
  ctx.lineTo(220, 350);
  ctx.lineTo(380, 220);
  ctx.lineTo(550, 370);
  ctx.lineTo(680, 260);
  ctx.lineTo(850, 390);
  ctx.closePath();
  ctx.fill();

  // Near Mountains (Slightly warmer brown/orange)
  ctx.fillStyle = '#9b6e59';
  ctx.beginPath();
  ctx.moveTo(-50, 390);
  ctx.lineTo(150, 290);
  ctx.lineTo(280, 360);
  ctx.lineTo(480, 270);
  ctx.lineTo(650, 370);
  ctx.lineTo(750, 310);
  ctx.lineTo(850, 390);
  ctx.closePath();
  ctx.fill();
  
  // 5. Desert Sand floor
  let sandGrad = ctx.createLinearGradient(0, 380, 0, CANVAS_HEIGHT);
  sandGrad.addColorStop(0, '#dca671');
  sandGrad.addColorStop(0.3, '#c58d55');
  sandGrad.addColorStop(1, '#9b622b');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, 380, CANVAS_WIDTH, 120);
  
  // Draw Dune ridges
  ctx.strokeStyle = '#c58d55';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.quadraticCurveTo(200, 400, 450, 430);
  ctx.quadraticCurveTo(650, 450, 800, 410);
  ctx.stroke();
  
  // 6. Perspective Train Tracks
  drawTrainTracks();
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(x, y, scale, 0, Math.PI * 2);
  ctx.arc(x + scale * 0.7, y - scale * 0.5, scale * 0.8, 0, Math.PI * 2);
  ctx.arc(x + scale * 1.5, y, scale * 0.9, 0, Math.PI * 2);
  ctx.arc(x + scale * 0.8, y + scale * 0.3, scale * 0.7, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function drawTrainTracks() {
  // perspective center vanishing point: X=620, Y=340
  const vpX = 650;
  const vpY = 370;
  
  ctx.save();
  
  // Draw wooden ties
  ctx.fillStyle = '#4a2f13';
  ctx.lineWidth = 1;
  
  let numTies = 15;
  for (let i = 0; i <= numTies; i++) {
    // Interpolation factor (nonlinear for perspective)
    let t = i / numTies;
    let factor = Math.pow(t, 2.5); // packs ties tighter near vanishing point
    
    let y = 500 - factor * 120; // Y coordinate
    let tieWidth = 220 * (1 - factor); // narrower at distance
    let tieHeight = 10 * (1 - factor);
    let tieX = vpX - (vpX - 80) * factor - (tieWidth/2); // shift slightly
    
    // adjust tieX for slant
    let centerRailX = 200 + (vpX - 200) * factor;
    
    ctx.fillRect(centerRailX - tieWidth/2, y, tieWidth, Math.max(2, tieHeight));
  }
  
  // Draw Steel Rails
  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 4;
  ctx.beginPath();
  // Left Rail
  ctx.moveTo(30, 500);
  ctx.lineTo(vpX - 20, vpY);
  ctx.stroke();
  
  // Right Rail
  ctx.beginPath();
  ctx.moveTo(370, 500);
  ctx.lineTo(vpX + 20, vpY);
  ctx.stroke();
  
  // Highlights on rails
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 498);
  ctx.lineTo(vpX - 19, vpY + 1);
  ctx.moveTo(370, 498);
  ctx.lineTo(vpX + 21, vpY + 1);
  ctx.stroke();
  
  ctx.restore();
}

// Central Device: metallic base, copper coils, glass tube, blue field
function drawDevice() {
  const cyX = state.cylinderX;
  const baseWidth = 190;
  const chamberWidth = 170;
  const topY = 115;
  const botY = 395;
  const midH = botY - topY;
  
  ctx.save();
  
  // 1. Draw containment blue aura inside chamber (Antigravity field)
  if (state.visualizacionCampo && !state.collapsed && state.fuerzaCampo > 0) {
    let fieldAlpha = (state.fuerzaCampo / 1000) * 0.35 + 0.05;
    
    // Core radial glow
    let fieldGrad = ctx.createRadialGradient(cyX, topY + midH/2, 20, cyX, topY + midH/2, 100);
    fieldGrad.addColorStop(0, `rgba(66, 153, 225, ${fieldAlpha * 1.5})`);
    fieldGrad.addColorStop(0.5, `rgba(56, 178, 172, ${fieldAlpha})`);
    fieldGrad.addColorStop(1, 'rgba(66, 153, 225, 0)');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(cyX - chamberWidth/2, topY + 5, chamberWidth, midH - 10);
    
    // Wave pulses (if not paused)
    let waveSpacing = 30;
    let speedMult = state.frecuenciaAcustica / 1000;
    let offset = (state.time * 50 * speedMult) % waveSpacing;
    
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.25)';
    ctx.lineWidth = 2;
    for (let y = topY + 10 + offset; y < botY - 10; y += waveSpacing) {
      ctx.beginPath();
      // Wave shape
      for (let x = cyX - chamberWidth/2 + 5; x <= cyX + chamberWidth/2 - 5; x++) {
        let dx = x - cyX;
        let scale = Math.cos(dx / (chamberWidth/2) * Math.PI / 2); // pinch edges
        let dy = Math.sin((x + state.time * 400) * 0.04) * 5 * scale;
        if (x === cyX - chamberWidth/2 + 5) {
          ctx.moveTo(x, y + dy);
        } else {
          ctx.lineTo(x, y + dy);
        }
      }
      ctx.stroke();
    }
    
    // Acoustic Nodes overlay lines (standing waves)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#00ffff';
    ctx.lineWidth = 1.5;
    
    let lambda = 300 * (1500 / state.frecuenciaAcustica);
    let count = 0;
    for (let y = topY + 5; y < botY - 5; y += lambda / 4) {
      if (y > topY + 10 && y < botY - 10) {
        ctx.beginPath();
        // Draw standing wave node horizontal dashed grid
        ctx.setLineDash([4, 4]);
        ctx.moveTo(cyX - chamberWidth/2 + 10, y);
        ctx.lineTo(cyX + chamberWidth/2 - 10, y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Node marker symbol at the edge
        if (count % 2 === 0) {
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(cyX - chamberWidth/2 + 5, y, 2.5, 0, Math.PI * 2);
          ctx.arc(cyX + chamberWidth/2 - 5, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      count++;
    }
    ctx.shadowBlur = 0; // reset
  }
  
  // 2. Draw Copper coils (wrapping the side pillars)
  drawCoils(cyX - chamberWidth/2 - 10, topY + 20, midH - 40);
  drawCoils(cyX + chamberWidth/2 + 10, topY + 20, midH - 40);
  
  // 3. Draw Side metallic support pillars
  let metallicGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0); // local to pillars
  
  // Left Pillar
  let lpGrad = ctx.createLinearGradient(cyX - chamberWidth/2 - 18, 0, cyX - chamberWidth/2 - 2, 0);
  lpGrad.addColorStop(0, '#4a5568');
  lpGrad.addColorStop(0.3, '#cbd5e0');
  lpGrad.addColorStop(0.5, '#ffffff');
  lpGrad.addColorStop(0.8, '#718096');
  lpGrad.addColorStop(1, '#2d3748');
  ctx.fillStyle = lpGrad;
  ctx.fillRect(cyX - chamberWidth/2 - 18, topY, 12, midH);
  
  // Right Pillar
  let rpGrad = ctx.createLinearGradient(cyX + chamberWidth/2 + 6, 0, cyX + chamberWidth/2 + 22, 0);
  rpGrad.addColorStop(0, '#2d3748');
  rpGrad.addColorStop(0.2, '#718096');
  rpGrad.addColorStop(0.5, '#ffffff');
  rpGrad.addColorStop(0.7, '#cbd5e0');
  rpGrad.addColorStop(1, '#4a5568');
  ctx.fillStyle = rpGrad;
  ctx.fillRect(cyX + chamberWidth/2 + 6, topY, 12, midH);
  
  // 4. Glass Cylinder tube highlights (drawn on top of the field)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(cyX - chamberWidth/2, topY, chamberWidth, midH);
  
  // Vertical glassy highlight reflection
  let glassHighlight = ctx.createLinearGradient(cyX - chamberWidth/2, 0, cyX + chamberWidth/2, 0);
  glassHighlight.addColorStop(0, 'rgba(255,255,255,0)');
  glassHighlight.addColorStop(0.04, 'rgba(255,255,255,0.08)');
  glassHighlight.addColorStop(0.08, 'rgba(255,255,255,0.2)');
  glassHighlight.addColorStop(0.12, 'rgba(255,255,255,0.05)');
  glassHighlight.addColorStop(0.85, 'rgba(255,255,255,0)');
  glassHighlight.addColorStop(0.9, 'rgba(255,255,255,0.15)');
  glassHighlight.addColorStop(0.95, 'rgba(255,255,255,0)');
  ctx.fillStyle = glassHighlight;
  ctx.fillRect(cyX - chamberWidth/2 + 2, topY + 2, chamberWidth - 4, midH - 4);
  
  // 5. Heavy Pedestal Base
  let baseGrad = ctx.createLinearGradient(cyX - baseWidth/2, 0, cyX + baseWidth/2, 0);
  baseGrad.addColorStop(0, '#1a202c');
  baseGrad.addColorStop(0.2, '#4a5568');
  baseGrad.addColorStop(0.5, '#a0aec0');
  baseGrad.addColorStop(0.8, '#4a5568');
  baseGrad.addColorStop(1, '#1a202c');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.moveTo(cyX - baseWidth/2, botY);
  ctx.lineTo(cyX + baseWidth/2, botY);
  ctx.lineTo(cyX + baseWidth/2 - 10, botY + 25);
  ctx.lineTo(cyX - baseWidth/2 + 10, botY + 25);
  ctx.closePath();
  ctx.fill();
  
  // Sub-base plate
  ctx.fillStyle = '#101520';
  ctx.fillRect(cyX - baseWidth/2 - 15, botY + 25, baseWidth + 30, 10);
  
  // 6. Top Metallic Cap
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.moveTo(cyX - baseWidth/2 + 10, topY);
  ctx.lineTo(cyX + baseWidth/2 - 10, topY);
  ctx.lineTo(cyX + baseWidth/2, topY - 15);
  ctx.lineTo(cyX - baseWidth/2, topY - 15);
  ctx.closePath();
  ctx.fill();
  
  // Cap dome
  ctx.fillStyle = '#2d3748';
  ctx.beginPath();
  ctx.arc(cyX, topY - 15, 30, Math.PI, 0);
  ctx.fill();
  
  // Glowing status lights on Top Cap
  if (state.collapsed) {
    ctx.fillStyle = '#ff0000'; // red error blinking
    if (Math.floor(state.time * 4) % 2 === 0) ctx.fillStyle = '#300';
  } else {
    ctx.fillStyle = (state.fuerzaCampo > 0) ? '#00ffcc' : '#718096';
  }
  ctx.beginPath();
  ctx.arc(cyX - 25, topY - 8, 4, 0, Math.PI * 2);
  ctx.arc(cyX + 25, topY - 8, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Discharge Sparks under instability
  if (state.stability < 35 && !state.collapsed && !state.paused) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    
    // Draw 1-2 random zig-zag spark lines
    let numSparks = Math.random() > 0.5 ? 2 : 1;
    for (let s = 0; s < numSparks; s++) {
      ctx.beginPath();
      let startY = topY + 20 + Math.random() * (midH - 40);
      let side = Math.random() > 0.5 ? (cyX - chamberWidth/2 + 5) : (cyX + chamberWidth/2 - 5);
      ctx.moveTo(side, startY);
      
      let curX = side;
      let curY = startY;
      for (let j = 0; j < 5; j++) {
        curX += (side < cyX ? 1 : -1) * (10 + Math.random() * 20);
        curY += (Math.random() - 0.5) * 30;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  
  // Collapsed Error Message Display
  if (state.collapsed) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.font = `bold 14px ${state.fontMono}`;
    ctx.textAlign = 'center';
    ctx.fillText('CRITICAL ERROR', cyX, topY + midH/2 - 10);
    ctx.fillText('FIELD COLLAPSED', cyX, topY + midH/2 + 10);
  }
  
  ctx.restore();
}

function drawCoils(x, yStart, height) {
  ctx.save();
  let wireRad = 5;
  let turns = Math.floor(height / (wireRad * 2.2));
  
  // Draw copper turns
  for (let i = 0; i < turns; i++) {
    let y = yStart + i * (wireRad * 2.2);
    
    // Shiny Copper Gradient
    let coilGrad = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    coilGrad.addColorStop(0, '#8c3d10');
    coilGrad.addColorStop(0.3, '#d47a3c');
    coilGrad.addColorStop(0.5, '#ffd2a1');
    coilGrad.addColorStop(0.8, '#b8541e');
    coilGrad.addColorStop(1, '#5c2202');
    
    ctx.fillStyle = coilGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, 10, wireRad, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c2202';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

// Render active floating sample & force vectors
function drawObject(obj) {
  ctx.save();
  
  // 1. Draw Object
  if (obj.type === 'ceramic') {
    // Ceramic brick shape with text
    let x = obj.x - obj.width/2;
    let y = obj.y - obj.height/2;
    
    // Draw brick shadow
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(x + 2, y + 2, obj.width, obj.height);
    
    // Brick gradient
    let brickGrad = ctx.createLinearGradient(x, y, x, y + obj.height);
    brickGrad.addColorStop(0, '#cbd5e0');
    brickGrad.addColorStop(0.5, '#a0aec0');
    brickGrad.addColorStop(1, '#718096');
    ctx.fillStyle = brickGrad;
    ctx.fillRect(x, y, obj.width, obj.height);
    
    // Texture lines
    ctx.strokeStyle = '#edf2f7';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, obj.width, obj.height);
    
    // Mass label text
    ctx.fillStyle = '#2d3748';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${obj.mass.toFixed(1)} kg`, obj.x, obj.y);
  }
  else if (obj.type === 'metal') {
    // Highly reflective chrome sphere
    let sphereGrad = ctx.createRadialGradient(
      obj.x - obj.radius/3, obj.y - obj.radius/3, 2,
      obj.x, obj.y, obj.radius
    );
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.3, '#cbd5e0');
    sphereGrad.addColorStop(0.8, '#4a5568');
    sphereGrad.addColorStop(1, '#1a202c');
    
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Mass text
    ctx.fillStyle = '#f7fafc';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${obj.mass.toFixed(1)} kg`, obj.x, obj.y);
  }
  else if (obj.type === 'plasma') {
    // Encapsulated Plasma Core
    // Glass sphere
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Glass highlight reflections
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(obj.x - 3, obj.y - 3, obj.radius - 4, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
    
    // Pulsing plasma energy ball inside
    obj.plasmaEnergy += (state.paused ? 0 : (Math.random() - 0.5) * 0.1);
    obj.plasmaEnergy = Math.max(0.7, Math.min(1.3, obj.plasmaEnergy));
    
    let coreRadius = (obj.radius - 8) * obj.plasmaEnergy;
    
    let plasmaGrad = ctx.createRadialGradient(obj.x, obj.y, 1, obj.x, obj.y, coreRadius);
    plasmaGrad.addColorStop(0, '#ffffff');
    plasmaGrad.addColorStop(0.3, '#4fd1c5'); // bright cyan
    plasmaGrad.addColorStop(0.8, '#319795'); // darker cyan
    plasmaGrad.addColorStop(1, 'rgba(49, 151, 149, 0)');
    
    ctx.fillStyle = plasmaGrad;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Monospace status label
    ctx.fillStyle = '#2d3748';
    ctx.font = 'bold 10px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${obj.mass.toFixed(1)} kg`, obj.x, obj.y + obj.radius + 10);
  }
  
  // 2. Draw Force Vectors
  if (!obj.dragging) {
    drawForceVectors(obj);
  }
  
  ctx.restore();
}

function drawForceVectors(obj) {
  // Check if vectors are enabled visually by scale (at least size 1)
  const vecScale = state.vectorScale * 4; // visual multiplier
  
  // Gravity Force (Red arrow pointing down)
  const Fg = obj.mass * G_CONSTANT;
  drawArrow(obj.x, obj.y, obj.x, obj.y + Fg * vecScale, '#e53e3e', 'Fg', -15);
  
  // Lift Force + Acoustic forces
  const chamberLeft = state.cylinderX - 85;
  const chamberRight = state.cylinderX + 85;
  const chamberTop = 115;
  const chamberBottom = 395;
  
  const insideChamber = (obj.x > chamberLeft && obj.x < chamberRight && obj.y > chamberTop && obj.y < chamberBottom);
  
  let Flift = 0;
  let Facoustic = 0;
  
  if (insideChamber && !state.collapsed) {
    let dx = obj.x - state.cylinderX;
    let distRatio = dx / 85;
    let fieldContainment = Math.exp(-distRatio * distRatio);
    Flift = (state.fuerzaCampo * 0.007) * fieldContainment * (state.stability / 100) * obj.mass;
    
    let chamberY = obj.y - chamberTop;
    let lambda = 300 * (1500 / state.frecuenciaAcustica);
    Facoustic = - (state.fuerzaCampo * 0.002) * Math.sin((4 * Math.PI * chamberY) / lambda) * obj.mass;
  }
  
  const FupTotal = Flift + Facoustic;
  
  // Lift Force Arrow (Blue pointing up)
  if (FupTotal > 0.05) {
    drawArrow(obj.x, obj.y, obj.x, obj.y - FupTotal * vecScale, '#3182ce', 'Fcampo', 15);
  }
  
  // Net Force Arrow (Yellow/Green pointing in direction of net acceleration)
  const Fnet = FupTotal - Fg;
  if (Math.abs(Fnet) > 0.05) {
    let color = (Fnet > 0) ? '#d69e2e' : '#dd6b20';
    drawArrow(obj.x, obj.y, obj.x, obj.y - Fnet * vecScale, color, 'Fneta', 35);
  }
}

// Arrow drawing helper
function drawArrow(fromx, fromy, tox, toy, color, label, labelOffsetX) {
  let headlen = 8; // length of head in pixels
  let dx = tox - fromx;
  let dy = toy - fromy;
  
  // Don't draw tiny arrows
  if (Math.sqrt(dx*dx + dy*dy) < 5) return;
  
  let angle = Math.atan2(dy, dx);
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  
  // Draw shaft
  ctx.beginPath();
  ctx.moveTo(fromx, fromy);
  ctx.lineTo(tox, toy);
  ctx.stroke();
  
  // Draw head
  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  
  // Label text
  ctx.fillStyle = '#2d3748';
  ctx.font = 'bold 11px Outfit';
  ctx.fillText(label, tox + labelOffsetX, toy + (dy >= 0 ? 5 : -5));
  
  ctx.restore();
}

// 7. Draggable Ruler Drawing
function drawRuler() {
  ctx.save();
  
  // Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  
  // Yellow board
  let rx = ruler.x;
  let ry = ruler.y;
  let rw = ruler.width;
  let rh = ruler.height;
  
  ctx.fillStyle = '#fff4a3';
  ctx.strokeStyle = '#cca300';
  ctx.lineWidth = 2.5;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.shadowBlur = 0; // reset
  
  // Ruler ticks & markings
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.font = '9px Outfit';
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  
  let pixelInterval = 10; // every 10px = 1 unit (cm)
  let ticks = rh / pixelInterval;
  
  for (let i = 0; i <= ticks; i++) {
    let yPos = ry + i * pixelInterval;
    let tickLen = 6;
    
    if (i % 10 === 0) {
      tickLen = 15; // main scale
      ctx.fillText(`${i}`, rx + rw - 20, yPos);
    } else if (i % 5 === 0) {
      tickLen = 10; // mid scale
    }
    
    ctx.beginPath();
    ctx.moveTo(rx + rw, yPos);
    ctx.lineTo(rx + rw - tickLen, yPos);
    ctx.stroke();
  }
  
  // Vertical Label
  ctx.save();
  ctx.translate(rx + 15, ry + rh/2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 11px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('ALTURA (cm)', 0, 0);
  ctx.restore();
  
  ctx.restore();
}

// Draggable Stopwatch Drawing
function drawStopwatch() {
  ctx.save();
  
  let sx = stopwatch.x;
  let sy = stopwatch.y;
  let sw = stopwatch.width;
  let sh = stopwatch.height;
  
  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  
  // Metallic border
  let stopGrad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
  stopGrad.addColorStop(0, '#cbd5e0');
  stopGrad.addColorStop(0.5, '#718096');
  stopGrad.addColorStop(1, '#2d3748');
  ctx.fillStyle = stopGrad;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 3;
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.shadowBlur = 0;
  
  // Screen
  ctx.fillStyle = '#1a202c';
  ctx.fillRect(sx + 10, sy + 10, sw - 20, sh - 45);
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 10, sy + 10, sw - 20, sh - 45);
  
  // Format Time: MM:SS.cc (centiseconds)
  let ms = Math.floor(stopwatch.elapsedTime);
  let min = Math.floor(ms / 60000);
  let sec = Math.floor((ms % 60000) / 1000);
  let cent = Math.floor((ms % 1000) / 10);
  
  let timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${cent.toString().padStart(2, '0')}`;
  
  ctx.fillStyle = '#39ff14'; // neon green text
  ctx.font = `20px ${state.fontMono}`;
  ctx.fontFamily = 'Share Tech Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeStr, sx + sw/2, sy + sh/2 - 12);
  
  // Buttons at the bottom
  // Start/Stop button (Green)
  ctx.fillStyle = stopwatch.running ? '#e53e3e' : '#38a169'; // red if running, green if stopped
  ctx.fillRect(sx + 15, sy + sh - 30, 45, 20);
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 15, sy + sh - 30, 45, 20);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Outfit';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stopwatch.running ? 'Alto' : 'Iniciar', sx + 15 + 22.5, sy + sh - 20);
  
  // Reset button (Orange)
  ctx.fillStyle = '#dd6b20';
  ctx.fillRect(sx + sw - 60, sy + sh - 30, 45, 20);
  ctx.strokeRect(sx + sw - 60, sy + sh - 30, 45, 20);
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Reset', sx + sw - 60 + 22.5, sy + sh - 20);
  
  ctx.restore();
}

// Real-time Graph View rendering
function drawRealTimeGraph() {
  const gx = 60;
  const gy = 100;
  const gw = 350;
  const gh = 280;
  
  ctx.save();
  
  // 1. Grid Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(gx, gy, gw, gh);
  
  // Grid Lines
  ctx.strokeStyle = '#edf2f7';
  ctx.lineWidth = 1;
  for (let x = gx + 50; x < gx + gw; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy + gh);
    ctx.stroke();
  }
  for (let y = gy + 40; y < gy + gh; y += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
  }
  
  // 2. Axes labels
  ctx.fillStyle = '#4a5568';
  ctx.font = 'bold 11px Outfit';
  ctx.textAlign = 'center';
  
  // X axis: Time
  ctx.fillText('Tiempo →', gx + gw/2, gy + gh + 22);
  
  // Y axis: Altura (relative)
  ctx.save();
  ctx.translate(gx - 28, gy + gh/2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Altura de Muestra (cm)', 0, 0);
  ctx.restore();
  
  // 3. Draw Curves
  if (graphHistory.length > 1) {
    // Height line (Blue)
    ctx.strokeStyle = '#3182ce';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    let step = gw / MAX_GRAPH_HISTORY;
    for (let i = 0; i < graphHistory.length; i++) {
      let x = gx + i * step;
      // map height (0-100) to graph height (gy+gh to gy)
      let y = (gy + gh) - (graphHistory[i].height / 100) * (gh - 20) - 10;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Force Line (Orange, dotted/dashed)
    ctx.strokeStyle = '#e65c00';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < graphHistory.length; i++) {
      let x = gx + i * step;
      // map force (0-1000)
      let y = (gy + gh) - (graphHistory[i].force / 1000) * (gh - 40) - 20;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Legend Panel overlay
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(gx + 10, gy + 10, 150, 45);
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx + 10, gy + 10, 150, 45);
  
  // Height Legend
  ctx.strokeStyle = '#3182ce';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx + 18, gy + 22);
  ctx.lineTo(gx + 32, gy + 22);
  ctx.stroke();
  
  ctx.fillStyle = '#2d3748';
  ctx.font = '10px Outfit';
  ctx.textAlign = 'left';
  ctx.fillText('Altura (cm)', gx + 40, gy + 25);
  
  // Force Legend
  ctx.strokeStyle = '#e65c00';
  ctx.lineWidth = 2;
  ctx.setLineDash([3,3]);
  ctx.beginPath();
  ctx.moveTo(gx + 18, gy + 38);
  ctx.lineTo(gx + 32, gy + 38);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.fillStyle = '#2d3748';
  ctx.fillText('Fuerza Campo (N)', gx + 40, gy + 41);
  
  ctx.restore();
}

// 8. Playground Mode Init
function initPlayground() {
  playgroundObjects = [];
  
  // Spawn 3 default objects side by side
  // Ceramic brick
  playgroundObjects.push({
    x: 350,
    y: 390,
    vx: 0,
    vy: 0,
    mass: 15.0,
    width: 50,
    height: 30,
    color: '#a0aec0',
    type: 'ceramic',
    drag: 0.95,
    dragging: false
  });
  
  // Metal ball
  playgroundObjects.push({
    x: 400,
    y: 390,
    vx: 0,
    vy: 0,
    mass: 50.0,
    radius: 20,
    color: '#4a5568',
    type: 'metal',
    drag: 0.98,
    dragging: false
  });
  
  // Plasma ball
  playgroundObjects.push({
    x: 450,
    y: 390,
    vx: 0,
    vy: 0,
    mass: 5.0,
    radius: 18,
    color: '#319795',
    type: 'plasma',
    drag: 0.90,
    dragging: false,
    plasmaEnergy: 1.0
  });
}

// Helper: Get active sample object based on selector state
function getActiveObject() {
  return samples[state.selectedSample];
}

// 9. Input & Drag Event Handlers
function handleMouseDown(e) {
  const pos = getMousePos(canvas, e);
  prevMouseX = pos.x;
  prevMouseY = pos.y;
  isMouseDown = true;
  
  // 1. Check tab specific tools click
  if (state.tab === 'medidas') {
    // Stopwatch Iniciar/Reset buttons click
    let stopwatchBtnClicked = handleStopwatchClick(pos.x, pos.y);
    if (stopwatchBtnClicked) return;
    
    // Ruler drag check
    if (pos.x >= ruler.x && pos.x <= ruler.x + ruler.width &&
        pos.y >= ruler.y && pos.y <= ruler.y + ruler.height) {
      ruler.dragging = true;
      ruler.offsetX = pos.x - ruler.x;
      ruler.offsetY = pos.y - ruler.y;
      return;
    }
    
    // Stopwatch drag check
    if (pos.x >= stopwatch.x && pos.x <= stopwatch.x + stopwatch.width &&
        pos.y >= stopwatch.y && pos.y <= stopwatch.y + stopwatch.height) {
      stopwatch.dragging = true;
      stopwatch.offsetX = pos.x - stopwatch.x;
      stopwatch.offsetY = pos.y - stopwatch.y;
      return;
    }
  }
  
  // 2. Sample drag check
  if (state.tab === 'playground') {
    for (let i = playgroundObjects.length - 1; i >= 0; i--) {
      let obj = playgroundObjects[i];
      if (checkMouseCollision(pos.x, pos.y, obj)) {
        obj.dragging = true;
        obj.vx = 0;
        obj.vy = 0;
        break;
      }
    }
  } else {
    let activeObj = getActiveObject();
    if (activeObj && checkMouseCollision(pos.x, pos.y, activeObj)) {
      activeObj.dragging = true;
      activeObj.vx = 0;
      activeObj.vy = 0;
    }
  }
}

function handleMouseMove(e) {
  if (!isMouseDown) return;
  const pos = getMousePos(canvas, e);
  const dt = 1 / 60;
  
  // 1. Move ruler
  if (ruler.dragging) {
    ruler.x = pos.x - ruler.offsetX;
    ruler.y = pos.y - ruler.offsetY;
    // Bounds clamping
    ruler.x = Math.max(0, Math.min(CANVAS_WIDTH - ruler.width, ruler.x));
    ruler.y = Math.max(0, Math.min(CANVAS_HEIGHT - ruler.height, ruler.y));
  }
  
  // 2. Move stopwatch
  if (stopwatch.dragging) {
    stopwatch.x = pos.x - stopwatch.offsetX;
    stopwatch.y = pos.y - stopwatch.offsetY;
    stopwatch.x = Math.max(0, Math.min(CANVAS_WIDTH - stopwatch.width, stopwatch.x));
    stopwatch.y = Math.max(0, Math.min(CANVAS_HEIGHT - stopwatch.height, stopwatch.y));
  }
  
  // 3. Move sample object(s) with physical momentum release
  if (state.tab === 'playground') {
    playgroundObjects.forEach(obj => {
      if (obj.dragging) {
        obj.x = pos.x;
        obj.y = pos.y;
        obj.vx = (pos.x - prevMouseX) * dt * 30; // calculate momentum
        obj.vy = -(pos.y - prevMouseY) * dt * 30;
      }
    });
  } else {
    let activeObj = getActiveObject();
    if (activeObj && activeObj.dragging) {
      activeObj.x = pos.x;
      activeObj.y = pos.y;
      activeObj.vx = (pos.x - prevMouseX) * dt * 30;
      activeObj.vy = -(pos.y - prevMouseY) * dt * 30;
    }
  }
  
  prevMouseX = pos.x;
  prevMouseY = pos.y;
}

function handleMouseUp(e) {
  isMouseDown = false;
  
  // stop all drags
  ruler.dragging = false;
  stopwatch.dragging = false;
  
  if (state.tab === 'playground') {
    playgroundObjects.forEach(obj => obj.dragging = false);
  } else {
    let activeObj = getActiveObject();
    if (activeObj) activeObj.dragging = false;
  }
}

// Touch Handlers for mobile/tablet support
function handleTouchStart(e) {
  if (e.touches.length > 0) {
    e.preventDefault();
    handleMouseDown(e.touches[0]);
  }
}

function handleTouchMove(e) {
  if (e.touches.length > 0) {
    e.preventDefault();
    handleMouseMove(e.touches[0]);
  }
}

function handleTouchEnd(e) {
  handleMouseUp(null);
}

// Check if mouse point intersects a physical object shape
function checkMouseCollision(mx, my, obj) {
  if (obj.radius) {
    // Circle formula
    let dist = Math.sqrt((mx - obj.x)**2 + (my - obj.y)**2);
    return dist <= obj.radius;
  } else {
    // AABB Rectangle
    return (mx >= obj.x - obj.width/2 && mx <= obj.x + obj.width/2 &&
            my >= obj.y - obj.height/2 && my <= obj.y + obj.height/2);
  }
}

// Check click target on stopwatch buttons
function handleStopwatchClick(mx, my) {
  let sx = stopwatch.x;
  let sy = stopwatch.y;
  let sw = stopwatch.width;
  let sh = stopwatch.height;
  
  // Iniciar/Alto button bounding box
  let btnStartLeft = sx + 15;
  let btnStartRight = sx + 15 + 45;
  let btnStartTop = sy + sh - 30;
  let btnStartBottom = sy + sh - 10;
  
  if (mx >= btnStartLeft && mx <= btnStartRight && my >= btnStartTop && my <= btnStartBottom) {
    stopwatch.running = !stopwatch.running;
    if (stopwatch.running) {
      stopwatch.lastUpdate = Date.now();
    }
    return true; // Clicked
  }
  
  // Reset button bounding box
  let btnResetLeft = sx + sw - 60;
  let btnResetRight = sx + sw - 15;
  let btnResetTop = sy + sh - 30;
  let btnResetBottom = sy + sh - 10;
  
  if (mx >= btnResetLeft && mx <= btnResetRight && my >= btnResetTop && my <= btnResetBottom) {
    stopwatch.elapsedTime = 0;
    return true; // Clicked
  }
  
  return false;
}

// Utility: Map client click space coordinates to canvas pixel space coordinates
function getMousePos(canvasEl, evt) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) / rect.width * CANVAS_WIDTH,
    y: (evt.clientY - rect.top) / rect.height * CANVAS_HEIGHT
  };
}
