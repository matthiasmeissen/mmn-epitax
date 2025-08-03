
function parseSVGPath(pathData, opentypePath) {
    const commands = pathData.match(/[a-df-z][^a-df-z]*/ig);
    if (!commands) return;

    let currentX = 0, currentY = 0;

    commands.forEach(commandString => {
        const command = commandString[0];
        // Split arguments by spaces or commas
        const args = commandString.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));

        switch (command) {
            case 'M': // MoveTo (absolute)
                currentX = args[0];
                currentY = args[1];
                opentypePath.moveTo(currentX, currentY);
                break;
            case 'm': // MoveTo (relative)
                currentX += args[0];
                currentY += args[1];
                opentypePath.moveTo(currentX, currentY);
                break;
            case 'L': // LineTo (absolute)
                currentX = args[0];
                currentY = args[1];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'l': // LineTo (relative)
                currentX += args[0];
                currentY += args[1];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'H': // Horizontal LineTo (absolute)
                currentX = args[0];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'h': // Horizontal LineTo (relative)
                currentX += args[0];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'V': // Vertical LineTo (absolute)
                currentY = args[0];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'v': // Vertical LineTo (relative)
                currentY += args[0];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'Q': // Quadratic Bezier (absolute)
                opentypePath.quadTo(args[0], args[1], args[2], args[3]);
                currentX = args[2];
                currentY = args[3];
                break;
            case 'q': // Quadratic Bezier (relative)
                opentypePath.quadTo(currentX + args[0], currentY + args[1], currentX + args[2], currentY + args[3]);
                currentX += args[2];
                currentY += args[3];
                break;
            case 'C': // Cubic Bezier (absolute)
                opentypePath.curveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
                currentX = args[4];
                currentY = args[5];
                break;
            case 'c': // Cubic Bezier (relative)
                opentypePath.curveTo(currentX + args[0], currentY + args[1], currentX + args[2], currentY + args[3], currentX + args[4], currentY + args[5]);
                currentX += args[4];
                currentY += args[5];
                break;
            case 'Z': // ClosePath
            case 'z':
                opentypePath.closePath();
                break;
        }
    });
}

// --- MODEL (The Data) ---
// --- MAIN APP (The Orchestrator) ---
class FontEditorApp {
    constructor(containerId, initialGlyphs) {
        this.config = {
            GRID_ROWS: 8,
            GRID_COLS: 6,
            CELL_SIZE: 100,
            DESCENDER_ROWS: 2, // Rows below the baseline
            X_HEIGHT_ROWS: 4,  // Rows from baseline to x-height line (CHANGED from 3 to 4)
        };

        this.metrics = {
            artboardWidth: this.config.GRID_COLS * this.config.CELL_SIZE,
            artboardHeight: this.config.GRID_ROWS * this.config.CELL_SIZE,
            // Calculate the baseline's Y position in the SVG coordinate system
            baselineY: (this.config.GRID_ROWS - this.config.DESCENDER_ROWS) * this.config.CELL_SIZE,
            // The font's ascender value is the space above the baseline
            ascender: (this.config.GRID_ROWS - this.config.DESCENDER_ROWS) * this.config.CELL_SIZE,
            // The font's descender value is the space below (must be negative)
            descender: -(this.config.DESCENDER_ROWS * this.config.CELL_SIZE),
        };

        this.container = document.getElementById(containerId);
        this.appState = this.loadState() || this.createInitialState(initialGlyphs);
        this.glyphControllers = [];

        this.initDOM();
        this.setupGlobalListeners();

        setInterval(() => this.saveState(), 2000);
    }

    //
    // --- 1. STATE MANAGEMENT ---
    //

    createInitialState(glyphs) {
        return {
            fontSettings: {
                familyName: "MyCustomFont",
                styleName: "Regular",
                unitsPerEm: 1000,
                ascender: this.metrics.ascender,
                descender: this.metrics.descender,
            },
            glyphs: glyphs.map(g => ({
                character: g.letter,
                unicode: g.unicode,
                shapes: []
            }))
        };
    }

    saveState() {
        localStorage.setItem('fontDesignerState', JSON.stringify(this.appState));
    }

    loadState() {
        const state = localStorage.getItem('fontDesignerState');
        if (state) {
            console.log("State loaded from localStorage.");
            return JSON.parse(state);
        }
        return null;
    }

    //
    // --- 2. INITIALIZATION ---
    //

    initDOM() {
        this.container.innerHTML = '';
        this.appState.glyphs.forEach(glyphData => {
            const instanceDiv = document.createElement('div');
            instanceDiv.className = 'artboard-instance';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'artbord-title';
            titleDiv.textContent = glyphData.character;

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute('class', 'artboard');
            svg.setAttribute('viewBox', '0 0 600 800');
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            const button = document.createElement('button');
            button.className = 'reset-button';
            button.textContent = 'Reset';

            instanceDiv.appendChild(titleDiv);
            instanceDiv.appendChild(svg);
            instanceDiv.appendChild(button);
            this.container.appendChild(instanceDiv);

            const controller = new GlyphController(glyphData, { svg, button }, this, this.config);
            this.glyphControllers.push(controller);
        });
    }

    setupGlobalListeners() {
        document.getElementById('downloadButton').addEventListener('click', () => {
            const font = this.createFont();
            if (font) {
                font.download();
            }
        });

        document.getElementById('resetAppButton').addEventListener('click', () => {
            const isConfirmed = confirm("Are you sure you want to start over? All unsaved work will be lost.");

            if (isConfirmed) {
                localStorage.removeItem('fontDesignerState');
                window.location.reload();
            }
        });
    }

    //
    // --- 3. STATE UPDATE METHODS (called by controllers) ---
    //

    addShapeToGlyph(character, shapeData) {
        const glyph = this.appState.glyphs.find(g => g.character === character);
        if (glyph) {
            glyph.shapes.push(shapeData);
            this.rerenderGlyph(character);
        }
    }

    resetGlyph(character) {
        const glyph = this.appState.glyphs.find(g => g.character === character);
        if (glyph) {
            glyph.shapes = [];
            this.rerenderGlyph(character);
        }
    }

    rerenderGlyph(character) {
        const controller = this.glyphControllers.find(c => c.character === character);
        if (controller) {
            controller.render();
        }
    }

    //
    // --- 4. FONT GENERATION (uses the state) ---
    //

    mergePathsWithPaperJS(shapes) {
        const baselineY = this.metrics.baselineY;

        if (shapes.length === 0) return "";

        paper.setup(new paper.Size(this.metrics.artboardWidth, this.metrics.artboardHeight));
        let mergedPath = null;

        shapes.forEach(shape => {
            const pathPoints = shape.vertices.map(point => {
                const finalY = baselineY - point.y;
                return new paper.Point(point.x, finalY);
            });

            const newPath = new paper.Path(pathPoints);
            mergedPath = mergedPath ? mergedPath.unite(newPath) : newPath;
            if (mergedPath !== newPath) newPath.remove();
        });

        const finalPathData = mergedPath ? mergedPath.pathData : '';
        paper.project.clear();
        return finalPathData;
    }

    createFont() {
        const glyphs = [];
        const notdefPath = new opentype.Path();
        const notdefGlyph = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 600, path: notdefPath });
        glyphs.push(notdefGlyph);

        this.appState.glyphs.forEach(glyphData => {
            const svgPathData = this.mergePathsWithPaperJS(glyphData.shapes);

            if (svgPathData && glyphData.character && !isNaN(glyphData.unicode)) {
                const path = new opentype.Path();

                parseSVGPath(svgPathData, path);

                const glyph = new opentype.Glyph({
                    name: glyphData.character,
                    unicode: glyphData.unicode,
                    advanceWidth: 600,
                    path: path
                });
                glyphs.push(glyph);
            }
        });

        if (glyphs.length <= 1) {
            alert("No characters have been drawn.");
            return null;
        }

        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const uniqueId = `${year}${month}${day}-${hours}${minutes}`;
        const fontName = `MMN Epitax ${uniqueId}`;

        const font = new opentype.Font({
            familyName: "MMN Epitax v0.1.0",
            styleName: this.appState.fontSettings.styleName,
            unitsPerEm: this.appState.fontSettings.unitsPerEm,
            ascender: this.appState.fontSettings.ascender,
            descender: this.appState.fontSettings.descender,
            glyphs: glyphs
        });

        return font;
    }
}

// --- VIEW (The Renderer) ---
class GlyphView {
    constructor(svgElement, config) {
        this.svg = svgElement;
        this.svgNS = "http://www.w3.org/2000/svg";
        this.config = config;

        this.createGrid();
    }


    createGrid() {
        this.svg.innerHTML = '';

        const gridGroup = document.createElementNS(this.svgNS, 'g');
        gridGroup.setAttribute('class', 'grid-group');
        this.svg.appendChild(gridGroup);

        for (let y = 0; y < this.config.GRID_ROWS; y++) {
            for (let x = 0; x < this.config.GRID_COLS; x++) {
                const cell = document.createElementNS(this.svgNS, 'rect');
                cell.setAttribute('class', 'grid-cell');
                cell.setAttribute('x', x * this.config.CELL_SIZE);
                cell.setAttribute('y', y * this.config.CELL_SIZE);
                cell.setAttribute('width', this.config.CELL_SIZE);
                cell.setAttribute('height', this.config.CELL_SIZE);
                cell.dataset.x = x;
                cell.dataset.y = y;
                gridGroup.appendChild(cell);
            }
        }

        const baselineY = (this.config.GRID_ROWS - this.config.DESCENDER_ROWS) * this.config.CELL_SIZE;
        const xHeightY = baselineY - (this.config.X_HEIGHT_ROWS * this.config.CELL_SIZE);
        const artboardWidth = this.config.GRID_COLS * this.config.CELL_SIZE;

        const baseline = document.createElementNS(this.svgNS, 'line');
        baseline.setAttribute('class', 'baseline');
        baseline.setAttribute('x1', 0);
        baseline.setAttribute('y1', baselineY);
        baseline.setAttribute('x2', artboardWidth);
        baseline.setAttribute('y2', baselineY);
        this.svg.appendChild(baseline);

        const xHeightLine = document.createElementNS(this.svgNS, 'line');
        xHeightLine.setAttribute('class', 'x-height-line');
        xHeightLine.setAttribute('x1', 0);
        xHeightLine.setAttribute('y1', xHeightY);
        xHeightLine.setAttribute('x2', artboardWidth);
        xHeightLine.setAttribute('y2', xHeightY);
        this.svg.appendChild(xHeightLine);
    }

    render(shapes) {
        this.svg.querySelectorAll('.generated-shape').forEach(el => el.remove());

        shapes.forEach(shape => {
            const polygon = document.createElementNS(this.svgNS, 'polygon');
            const pointsStr = shape.vertices.map(p => `${p.x},${p.y}`).join(' ');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('class', 'generated-shape');
            this.svg.appendChild(polygon);
        });
    }

    drawPreview(vertices) {
        this.removePreview();
        const previewPolyline = document.createElementNS(this.svgNS, 'polyline');
        const pointsStr = vertices.map(p => `${p.x},${p.y}`).join(' ');
        previewPolyline.setAttribute('points', pointsStr);
        previewPolyline.setAttribute('class', 'selection-preview');
        this.svg.appendChild(previewPolyline);
    }

    removePreview() {
        const existingPreview = this.svg.querySelector('.selection-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
    }
}

// --- CONTROLLER (The Logic) ---
class GlyphController {
    constructor(glyphData, domElements, app, config) {
        this.character = glyphData.character;
        this.dom = domElements;
        this.app = app;

        this.config = config;
        this.view = new GlyphView(this.dom.svg, config);

        this.firstSelection = null;
        this.attachEventListeners();
        this.render();
    }

    getData() {
        return this.app.appState.glyphs.find(g => g.character === this.character);
    }

    render() {
        this.view.render(this.getData().shapes);
    }

    attachEventListeners() {
        this.dom.svg.addEventListener('click', this.onCellClick.bind(this));
        this.dom.button.addEventListener('click', () => {
            this.app.resetGlyph(this.character);
        });
    }

    onCellClick(event) {
        if (!event.target.classList.contains('grid-cell')) return;

        const cell = event.target;
        const svgPoint = this.dom.svg.createSVGPoint();
        svgPoint.x = event.clientX;
        svgPoint.y = event.clientY;
        const pointInSVG = svgPoint.matrixTransform(this.dom.svg.getScreenCTM().inverse());

        const viewBox = this.dom.svg.viewBox.baseVal;
        const svgWidth = this.dom.svg.clientWidth;
        const scale = viewBox.width / svgWidth;

        const clickX = (pointInSVG.x * scale) % this.config.CELL_SIZE;
        const clickY = (pointInSVG.y * scale) % this.config.CELL_SIZE;

        const vertices = this.getVerticesFromClick(cell, clickX, clickY);

        if (!this.firstSelection) {
            this.firstSelection = { vertices: vertices };
            this.view.drawPreview(vertices);
        } else {
            const secondVertices = this.getVerticesFromClick(cell, clickX, clickY);

            const [p1, , p3] = this.firstSelection.vertices;
            const [q1, , q3] = secondVertices;
            const distSq = (p1, p2) => Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);

            const pairing1_dist = distSq(p1, q1) + distSq(p3, q3);
            const pairing2_dist = distSq(p1, q3) + distSq(p3, q1);

            const allVertices = (pairing1_dist < pairing2_dist)
                ? [...this.firstSelection.vertices, ...[...secondVertices].reverse()]
                : [...this.firstSelection.vertices, ...secondVertices];

            const newShape = { id: `shape-${Date.now()}`, vertices: allVertices };
            this.app.addShapeToGlyph(this.character, newShape);

            this.resetSelection();
        }
    }

    resetSelection() {
        this.firstSelection = null;
        this.view.removePreview();
    }

    getVerticesFromClick(cell, clickX, clickY) {
        const { CELL_SIZE } = this.config;

        const cellX = parseInt(cell.dataset.x, 10) * CELL_SIZE;
        const cellY = parseInt(cell.dataset.y, 10) * CELL_SIZE;
        const corners = { tl: { x: cellX, y: cellY }, tr: { x: cellX + CELL_SIZE, y: cellY }, bl: { x: cellX, y: cellY + CELL_SIZE }, br: { x: cellX + CELL_SIZE, y: cellY + CELL_SIZE } };
        const isTop = clickY < CELL_SIZE / 2;
        const isLeft = clickX < CELL_SIZE / 2;
        const key = `${isTop ? 't' : 'b'}${isLeft ? 'l' : 'r'}`;

        const vertexMap = {
            'tl': [corners.tr, corners.tl, corners.bl],
            'tr': [corners.tl, corners.tr, corners.br],
            'bl': [corners.tl, corners.bl, corners.br],
            'br': [corners.bl, corners.br, corners.tr]
        };

        return vertexMap[key];
    }
}

// --- APP INITIALIZATION ---

function createAsciiGlyphSet() {
    const glyphs = [];
    // Printable ASCII characters range from 33 (!) to 126 (~)
    for (let i = 33; i <= 126; i++) {
        glyphs.push({
            letter: String.fromCharCode(i),
            unicode: i
        });
    }
    return glyphs;
}

document.addEventListener('DOMContentLoaded', () => {
    const initialGlyphSet = createAsciiGlyphSet();

    new FontEditorApp('artboard-container', initialGlyphSet);
});