(function () {

    const template = document.createElement('template');

    template.innerHTML = `
        <style>
            :host {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
                padding: 80px 24px;
                box-sizing: border-box;
                background-color: var(--color-background-subtle);
            }

            p {
                max-width: 620px;
                text-align: center;
                line-height: 1.5;
            }

            .artboard {
                width: 300px; 
                height: 400px;
                border: 2px solid var(--color-foreground-primary, #191919);
                background-color: var(--color-background-primary, #ffffff);
                border-radius: 4px;
            }

            .grid-cell {
                fill: var(--color-background-primary, #ffffff);
                stroke: var(--color-foreground-primary, #191919);
                stroke-width: 2;
            }

            .generated-shape {
                fill: var(--color-foreground-primary, #191919);
                stroke: none;
                pointer-events: none;
            }

            .grid-cell:hover {
                fill: var(--color-foreground-accent, #ff2200);
                cursor: pointer;
            }

            .selection-preview {
                fill: none;
                stroke: var(--color-foreground-accent, #ff2200);
                stroke-width: 3;
                stroke-linejoin: round;
                pointer-events: none;
            }
            
            .controls {
                display: flex;
                gap: 12px;
            }

            .button {
                min-width: 140px;
                text-decoration: none;
                text-align: center;
                color: var(--color-foreground-primary, #191919);
                background-color: transparent;
                padding: 12px 16px;
                border: 2px solid var(--color-foreground-primary, #191919);
                border-radius: 4px;
                font-family: var(--font-family-text, monospace);
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
            }

            .button:hover, 
            .button:focus {
                outline: 2px solid var(--color-foreground-accent, #ff2200);
                outline-offset: 2px;
            }
        </style>
        
        <p>Epitax is constructed by growing elongated hexagons on a grid. Create your own by clicking in the corner of one rectangle on the grid and then in another.</p>
        <svg class="artboard" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid meet"></svg>
        <div class="controls">
            <button id="reset-button" class="button">Reset</button>
            <button id="download-button" class="button">Download SVG</button>
        </div>
    `;


    class GlyphEditor extends HTMLElement {
        // Constructor and most methods are unchanged
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.shadowRoot.appendChild(template.content.cloneNode(true));

            this.svgNS = "http://www.w3.org/2000/svg";
            this.COLS = 6;
            this.ROWS = 8;
            this.CELL_SIZE = 100;

            this.firstSelection = null;
            this.previewPolyline = null;
        }

        connectedCallback() {
            this.artboard = this.shadowRoot.querySelector('.artboard');
            this.resetButton = this.shadowRoot.querySelector('#reset-button');
            this.downloadButton = this.shadowRoot.querySelector('#download-button');

            this.handleResetClick = this.resetAll.bind(this);
            this.handleDownloadClick = this.exportSingleSVG.bind(this);

            this.resetButton.addEventListener('click', this.handleResetClick);
            this.downloadButton.addEventListener('click', this.handleDownloadClick);

            this.createGrid();
        }

        disconnectedCallback() {
            this.resetButton.removeEventListener('click', this.handleResetClick);
            this.downloadButton.removeEventListener('click', this.handleDownloadClick);
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
            const cellX = parseInt(cell.dataset.x) * this.CELL_SIZE;
            const cellY = parseInt(cell.dataset.y) * this.CELL_SIZE;
            const clickX = pointInSVG.x - cellX;
            const clickY = pointInSVG.y - cellY;
            const vertices = this.getVerticesFromClick(cell, clickX, clickY);
            if (!this.firstSelection) {
                this.firstSelection = { vertices: vertices };
                this.drawPreview(vertices);
            } else {
                this.drawFinalShape(this.firstSelection.vertices, vertices);
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
            if (this.previewPolyline) { this.artboard.removeChild(this.previewPolyline); }
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
            const allVertices = (pairing1_dist < pairing2_dist) ? [...verts1, ...[...verts2].reverse()] : [...verts1, ...verts2];
            const pointsStr = allVertices.map(p => `${p.x},${p.y}`).join(' ');
            shape.setAttribute('points', pointsStr);
            shape.setAttribute('class', 'generated-shape');
            this.artboard.appendChild(shape);
        }

        resetSelection() {
            this.firstSelection = null;
            if (this.previewPolyline) { this.artboard.removeChild(this.previewPolyline); this.previewPolyline = null; }
        }

        resetAll() { this.createGrid(); this.resetSelection(); }

        // --- FINAL EXPORT FUNCTION ---
        exportSingleSVG() {
            const computedStyles = getComputedStyle(this);
            const foreground = computedStyles.getPropertyValue('--color-foreground-primary').trim();
            const background = computedStyles.getPropertyValue('--color-background-primary').trim();

            const svgToExport = this.artboard.cloneNode(true);
            svgToExport.setAttribute('xmlns', this.svgNS);

            // Remove any interactive-only elements
            const preview = svgToExport.querySelector('.selection-preview');
            if (preview) {
                preview.remove();
            }

            // --- KEY CHANGE: REMOVE THE GRID ---
            const gridGroup = svgToExport.querySelector('.grid-group');
            if (gridGroup) {
                gridGroup.remove();
            }

            // Create a <style> block with only the styles needed for the shapes
            const style = document.createElementNS(this.svgNS, 'style');
            style.textContent = `
                /* Add a background color to the SVG itself */
                svg {
                    background-color: ${background};
                }
                .generated-shape {
                    fill: ${foreground};
                    stroke: none;
                }
            `;

            const defs = document.createElementNS(this.svgNS, 'defs');
            defs.appendChild(style);
            svgToExport.prepend(defs);

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgToExport);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'glyph.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    window.customElements.define('glyph-editor', GlyphEditor);

})();