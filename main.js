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


function createArtboardsFromArray(glyphDataArray) {
    const container = document.getElementById('artboard-container');
    if (!container) { console.error("Artboard container not found!"); return; }
    container.innerHTML = '';
    glyphDataArray.forEach(glyphInfo => {
        const instanceDiv = document.createElement('div');
        instanceDiv.className = 'artboard-instance';
        const titleDiv = document.createElement('div');
        titleDiv.className = 'artbord-title';
        titleDiv.textContent = glyphInfo.letter;
        titleDiv.dataset.unicode = glyphInfo.unicode;
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
        container.appendChild(instanceDiv);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const myGlyphs = [
        { letter: 'A', unicode: 65 }, { letter: 'B', unicode: 66 }, { letter: 'C', unicode: 67 },
    ];
    createArtboardsFromArray(myGlyphs);
    const artboardInstances = document.querySelectorAll('.artboard-instance');
    artboardInstances.forEach(instanceElement => {
        new Artboard(instanceElement);
    });
});

function parseSVGPath(pathData, opentypePath) {
    const commands = pathData.match(/[a-df-z][^a-df-z]*/ig);
    if (!commands) return;
    let currentX = 0, currentY = 0, ctrlX = 0, ctrlY = 0;
    commands.forEach(commandString => {
        const command = commandString[0];
        const args = commandString.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
        switch (command) {
            case 'M': currentX = args[0]; currentY = args[1]; opentypePath.moveTo(currentX, currentY); break;
            case 'm': currentX += args[0]; currentY += args[1]; opentypePath.moveTo(currentX, currentY); break;
            case 'L': currentX = args[0]; currentY = args[1]; opentypePath.lineTo(currentX, currentY); break;
            case 'l': currentX += args[0]; currentY += args[1]; opentypePath.lineTo(currentX, currentY); break;
            case 'H': currentX = args[0]; opentypePath.lineTo(currentX, currentY); break;
            case 'h': currentX += args[0]; opentypePath.lineTo(currentX, currentY); break;
            case 'V': currentY = args[0]; opentypePath.lineTo(currentX, currentY); break;
            case 'v': currentY += args[0]; opentypePath.lineTo(currentX, currentY); break;
            case 'Q': ctrlX = args[0]; ctrlY = args[1]; currentX = args[2]; currentY = args[3]; opentypePath.quadTo(ctrlX, ctrlY, currentX, currentY); break;
            case 'q': opentypePath.quadTo(currentX + args[0], currentY + args[1], currentX + args[2], currentY + args[3]); ctrlX = currentX + args[0]; ctrlY = currentY + args[1]; currentX += args[2]; currentY += args[3]; break;
            case 'C': ctrlX = args[2]; ctrlY = args[3]; currentX = args[4]; currentY = args[5]; opentypePath.curveTo(args[0], args[1], ctrlX, ctrlY, currentX, currentY); break;
            case 'c': opentypePath.curveTo(currentX + args[0], currentY + args[1], currentX + args[2], currentY + args[3], currentX + args[4], currentY + args[5]); ctrlX = currentX + args[2]; ctrlY = currentY + args[3]; currentX += args[4]; currentY += args[5]; break;
            case 'Z': case 'z': opentypePath.closePath(); break;
        }
    });
}


function mergePathsWithPaperJS(artboardElement) {
    const shapes = artboardElement.querySelectorAll('.generated-shape');
    const artboardHeight = 800;

    if (shapes.length === 0) {
        return "";
    }

    paper.setup(new paper.Size(600, 800));

    let mergedPath = null;

    shapes.forEach(polygon => {
        const pointsStr = polygon.getAttribute('points').trim();
        const pointsArr = pointsStr.split(/\s+/);

        const pathPoints = pointsArr.map(point => {
            const [x, y] = point.split(',').map(Number);
            const flippedY = artboardHeight - y;
            return new paper.Point(x, flippedY);
        });

        const newPath = new paper.Path(pathPoints);

        if (!mergedPath) {
            mergedPath = newPath;
        } else {
            mergedPath = mergedPath.unite(newPath);
            newPath.remove();
        }
    });

    let finalPathData = '';
    if (mergedPath) {
        finalPathData = mergedPath.pathData;
    }

    paper.project.clear();

    return finalPathData;
}


function createFont() {
    const artboardInstances = document.querySelectorAll('.artboard-instance');
    const glyphs = [];

    const notdefGlyph = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 600, path: new opentype.Path() });
    glyphs.push(notdefGlyph);

    artboardInstances.forEach(instance => {
        const artboardElement = instance.querySelector('.artboard');
        const titleElement = instance.querySelector('.artbord-title');
        const character = titleElement.textContent.trim();
        const unicode = parseInt(titleElement.dataset.unicode, 10);

        const svgPathData = mergePathsWithPaperJS(artboardElement);

        if (svgPathData && character && !isNaN(unicode)) {
            const path = new opentype.Path();
             try {
                if (typeof path.fromSVG === 'function') {
                    path.fromSVG(svgPathData);
                } else {
                    throw new Error('fromSVG not available');
                }
            } catch (e) {
                console.log('Using manual SVG parsing fallback for character:', character);
                parseSVGPath(svgPathData, path);
            }
            const glyph = new opentype.Glyph({ name: character, unicode: unicode, advanceWidth: 600, path: path });
            glyphs.push(glyph);
        }
    });

    if (glyphs.length <= 1) {
        alert("No characters have been drawn. Please draw on at least one artboard.");
        return null;
    }

    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const uniqueId = `${year}${month}${day}-${hours}${minutes}`;
    const fontName = `MMN Epitaxy ${uniqueId}`;

    const font = new opentype.Font({
        familyName: fontName,
        styleName: 'Medium',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        glyphs: glyphs
    });

    return font;
}

document.getElementById('downloadButton').addEventListener('click', function () {
    const font = createFont();
    if (font) {
        font.download();
    }
});