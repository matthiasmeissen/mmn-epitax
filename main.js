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