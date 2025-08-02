class Artboard {
    constructor(containerElement) {
        this.artboard = containerElement.querySelector('.artboard');
        this.resetButton = containerElement.querySelector('.reset-button');
        this.svgNS = "http://www.w3.org/2000/svg";
        this.COLS = 6;
        this.ROWS = 8;
        this.CELL_SIZE = 100;
        this.firstSelection = null;
        this.previewPolyline = null;
        this.resetButton.addEventListener('click', this.resetAll.bind(this));
        this.createGrid();
    }
    createGrid() {
        this.artboard.innerHTML = '';
        const gridGroup = document.createElementNS(this.svgNS, 'g');
        gridGroup.setAttribute('class', 'grid-group');
        this.artboard.appendChild(gridGroup);
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                const cell = document.createElementNS(this.svgNS, 'rect');
                cell.setAttribute('class', 'grid-cell');
                cell.setAttribute('x', x * this.CELL_SIZE);
                cell.setAttribute('y', y * this.CELL_SIZE);
                cell.setAttribute('width', this.CELL_SIZE);
                cell.setAttribute('height', this.CELL_SIZE);
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.addEventListener('click', this.onCellClick.bind(this));
                gridGroup.appendChild(cell);
            }
        }
    }
    onCellClick(event) {
        const cell = event.target;
        const svgPoint = this.artboard.createSVGPoint();
        svgPoint.x = event.clientX;
        svgPoint.y = event.clientY;
        const pointInSVG = svgPoint.matrixTransform(this.artboard.getScreenCTM().inverse());
        const clickX = pointInSVG.x % this.CELL_SIZE;
        const clickY = pointInSVG.y % this.CELL_SIZE;
        const vertices = this.getVerticesFromClick(cell, clickX, clickY);
        if (!this.firstSelection) {
            this.firstSelection = { vertices: vertices, cell: cell };
            this.drawPreview(vertices);
        } else {
            const secondVertices = this.getVerticesFromClick(event.target, clickX, clickY);
            this.drawFinalShape(this.firstSelection.vertices, secondVertices);
            this.resetSelection();
        }
    }
    getVerticesFromClick(cell, clickX, clickY) {
        const cellX = parseInt(cell.dataset.x, 10) * this.CELL_SIZE;
        const cellY = parseInt(cell.dataset.y, 10) * this.CELL_SIZE;
        const corners = { tl: { x: cellX, y: cellY }, tr: { x: cellX + this.CELL_SIZE, y: cellY }, bl: { x: cellX, y: cellY + this.CELL_SIZE }, br: { x: cellX + this.CELL_SIZE, y: cellY + this.CELL_SIZE } };
        const isTop = clickY < this.CELL_SIZE / 2;
        const isLeft = clickX < this.CELL_SIZE / 2;
        if (isTop && isLeft) return [corners.tr, corners.tl, corners.bl];
        if (isTop && !isLeft) return [corners.tl, corners.tr, corners.br];
        if (!isTop && isLeft) return [corners.tl, corners.bl, corners.br];
        return [corners.bl, corners.br, corners.tr];
    }
    drawPreview(vertices) {
        if (this.previewPolyline) {
            this.artboard.removeChild(this.previewPolyline);
        }
        this.previewPolyline = document.createElementNS(this.svgNS, 'polyline');
        const pointsStr = vertices.map(p => `${p.x},${p.y}`).join(' ');
        this.previewPolyline.setAttribute('points', pointsStr);
        this.previewPolyline.setAttribute('class', 'selection-preview');
        this.artboard.appendChild(this.previewPolyline);
    }
    distSq(p1, p2) { return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2); }
    drawFinalShape(verts1, verts2) {
        const shape = document.createElementNS(this.svgNS, 'polygon');
        const [p1, , p3] = verts1;
        const [q1, , q3] = verts2;
        const pairing1_dist = this.distSq(p1, q1) + this.distSq(p3, q3);
        const pairing2_dist = this.distSq(p1, q3) + this.distSq(p3, q1);
        let allVertices = (pairing1_dist < pairing2_dist) ? [...verts1, ...[...verts2].reverse()] : [...verts1, ...verts2];
        const pointsStr = allVertices.map(p => `${p.x},${p.y}`).join(' ');
        shape.setAttribute('points', pointsStr);
        shape.setAttribute('class', 'generated-shape');
        this.artboard.appendChild(shape);
    }
    resetSelection() {
        this.firstSelection = null;
        if (this.previewPolyline) {
            this.artboard.removeChild(this.previewPolyline);
            this.previewPolyline = null;
        }
    }
    resetAll() { this.createGrid(); this.resetSelection(); }
}

function exportLayoutAsSVG() {
    const svgNS = "http://www.w3.org/2000/svg";
    const artboards = document.querySelectorAll('.artboard');

    const GAP = 40;
    const ARTBOARD_WIDTH = 600;
    const ARTBOARD_HEIGHT = 800;
    const TOTAL_WIDTH = (ARTBOARD_WIDTH * artboards.length) + (GAP * (artboards.length - 1));

    const finalSVG = document.createElementNS(svgNS, 'svg');
    finalSVG.setAttribute('width', TOTAL_WIDTH);
    finalSVG.setAttribute('height', ARTBOARD_HEIGHT);
    finalSVG.setAttribute('viewBox', `0 0 ${TOTAL_WIDTH} ${ARTBOARD_HEIGHT}`);
    finalSVG.setAttribute('xmlns', svgNS);

    const style = document.createElementNS(svgNS, 'style');
    style.textContent = `
                .grid-cell {
                    fill: #fff;
                    stroke: #000000;
                    stroke-width: 1;
                }
                .generated-shape {
                    fill: #000;
                    stroke: #000;
                    stroke-width: 1;
                }
            `;
    const defs = document.createElementNS(svgNS, 'defs');
    defs.appendChild(style);
    finalSVG.appendChild(defs);

    artboards.forEach((artboard, index) => {
        const group = document.createElementNS(svgNS, 'g');
        const xOffset = index * (ARTBOARD_WIDTH + GAP);
        group.setAttribute('transform', `translate(${xOffset}, 0)`);

        Array.from(artboard.children).forEach(child => {
            if (child.tagName.toLowerCase() !== 'defs' && child.tagName.toLowerCase() !== 'style') {
                group.appendChild(child.cloneNode(true));
            }
        });

        finalSVG.appendChild(group);
    });

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(finalSVG);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'generative-layout.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
    const artboardInstances = document.querySelectorAll('.artboard-instance');
    artboardInstances.forEach(instanceElement => {
        new Artboard(instanceElement);
    });
});

function parseSVGPath(pathData, opentypePath) {
    const commands = pathData.match(/[a-df-z][^a-df-z]*/ig);

    let currentX = 0, currentY = 0;
    let ctrlX = 0, ctrlY = 0;

    commands.forEach(commandString => {
        const command = commandString[0];
        const args = commandString.slice(1).trim().split(/[\s,]+/).map(parseFloat);

        const updateControlPoints = (x1, y1) => {
            ctrlX = x1;
            ctrlY = y1;
        };

        switch (command) {
            case 'M':
                currentX = args[0];
                currentY = args[1];
                opentypePath.moveTo(currentX, currentY);
                break;
            case 'm':
                currentX += args[0];
                currentY += args[1];
                opentypePath.moveTo(currentX, currentY);
                break;

            case 'L':
                currentX = args[0];
                currentY = args[1];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'l':
                currentX += args[0];
                currentY += args[1];
                opentypePath.lineTo(currentX, currentY);
                break;

            case 'H':
                currentX = args[0];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'h':
                currentX += args[0];
                opentypePath.lineTo(currentX, currentY);
                break;

            case 'V':
                currentY = args[0];
                opentypePath.lineTo(currentX, currentY);
                break;
            case 'v':
                currentY += args[0];
                opentypePath.lineTo(currentX, currentY);
                break;

            case 'Q':
                ctrlX = args[0];
                ctrlY = args[1];
                currentX = args[2];
                currentY = args[3];
                opentypePath.quadTo(ctrlX, ctrlY, currentX, currentY);
                break;
            case 'q':
                opentypePath.quadTo(currentX + args[0], currentY + args[1], currentX + args[2], currentY + args[3]);
                ctrlX = currentX + args[0];
                ctrlY = currentY + args[1];
                currentX += args[2];
                currentY += args[3];
                break;

            case 'C':
                ctrlX = args[2];
                ctrlY = args[3];
                currentX = args[4];
                currentY = args[5];
                opentypePath.curveTo(args[0], args[1], ctrlX, ctrlY, currentX, currentY);
                break;
            case 'c':
                opentypePath.curveTo(currentX + args[0], currentY + args[1], currentX + args[2], currentY + args[3], currentX + args[4], currentY + args[5]);
                ctrlX = currentX + args[2];
                ctrlY = currentY + args[3];
                currentX += args[4];
                currentY += args[5];
                break;

            case 'Z':
            case 'z':
                opentypePath.closePath();
                break;
        }
    });
}

function getPathDataFromArtboard() {
    const shapes = document.querySelectorAll('.artboard .generated-shape');
    let finalPathData = '';

    shapes.forEach(polygon => {
        const points = polygon.getAttribute('points').trim();
        if (points) {
            // Convert polygon points to a path string: M(ove) to the first point,
            // L(ine) to the subsequent points, and Z(close) the path.
            const pathSegment = 'M' + points.replace(/\s+/g, 'L') + 'Z';
            finalPathData += pathSegment + ' ';
        }
    });

    return finalPathData.trim();
}

function createFont() {
    const svgPathData = getPathDataFromArtboard();

    // If the user hasn't drawn anything, don't create a broken font.
    if (!svgPathData) {
        alert("The artboard is empty! Please draw a shape first.");
        return null; // Return null to indicate failure
    }

    const path = new opentype.Path();

    try {
        if (typeof path.fromSVG === 'function') {
            path.fromSVG(svgPathData);
        } else {
            throw new Error('fromSVG not available');
        }
    } catch (e) {
        console.log('Using manual SVG parsing');
        parseSVGPath(svgPathData, path);
    }

    const glyph = new opentype.Glyph({
        name: 'Triangle',
        unicode: 65,
        advanceWidth: 100,
        path: path
    });

    const notdefGlyph = new opentype.Glyph({
        name: '.notdef',
        unicode: 0,
        advanceWidth: 100,
        path: new opentype.Path()
    });

    const font = new opentype.Font({
        familyName: 'MyTriangleFont',
        styleName: 'Medium',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        glyphs: [notdefGlyph, glyph]
    });

    return font;
}

document.getElementById('downloadButton').addEventListener('click', function () {
    const font = createFont();
    if (font) {
        font.download();
    }
});
