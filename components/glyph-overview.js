// IIFE wrapper to prevent global scope conflicts
(function() {

    const template = document.createElement('template');

    template.innerHTML = `
        <style>
            :host {
                display: block;
            }

            .overview-container {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 24px;
                align-items: start;
            }

            .preview-container {
                position: sticky;
                top: 24px;
            }

            .preview-pane {
                display: block;
                width: 100%;
                aspect-ratio: 1 / 1; 
                background-color: var(--color-background-subtle, #f0f0f0);
                border-radius: 4px;

                --grid-line-color: rgba(25, 25, 25, 0.1);
                --grid-line-width: 1px;
                
                border: var(--grid-line-width) solid var(--grid-line-color);

                background-image: 
                    linear-gradient(to right, var(--grid-line-color) var(--grid-line-width), transparent var(--grid-line-width)),
                    linear-gradient(to bottom, var(--grid-line-color) var(--grid-line-width), transparent var(--grid-line-width));
                
                background-size: calc(100% / 12) calc(100% / 12);
                
                background-position: -1px -1px;
            }
            
            .preview-glyph {
                font-family: var(--font-family-epitax);
                fill: var(--color-foreground-primary, #191919);
            }
            
            .info-overlay {
                position: absolute;
                top: 16px;
                left: 16px;
                font-family: var(--font-family-text, monospace);
                font-size: 0.875rem;
                color: var(--color-foreground-primary, #191919);
                background-color: var(--color-background-primary);
                padding: 4px 8px;
                border-radius: 4px;
                pointer-events: none;
            }

            .glyph-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 12px;
            }

            .glyph-cell {
                display: flex;
                align-items: center;
                justify-content: center;
                aspect-ratio: 1 / 1;
                font-family: var(--font-family-epitax);
                font-size: 2.5rem;
                background-color: var(--color-background-subtle);
                color: var(--color-foreground-primary, #191919);
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s, color 0.2s, transform 0.2s;
                border: 2px solid transparent;
            }

            .glyph-cell:hover {
                transform: scale(1.4) rotate(10deg);
                background-color: var(--color-foreground-primary, #191919);
                color: var(--color-foreground-accent, #ff2200);
                z-index: 10;
            }
            
            .glyph-cell.selected {
                border-color: var(--color-foreground-accent, #ff2200);
            }

            /* --- Media Query for Mobile Screens --- */
            @media (max-width: 768px) {
                .overview-container {
                    grid-template-columns: 1fr;
                }
            }
        </style>

        <div class="overview-container">
            <div class="preview-container">
                <svg id="preview-pane" class="preview-pane" viewBox="0 0 600 800">
                    <text id="preview-glyph" class="preview-glyph" x="50%" y="50%" font-size="700" dominant-baseline="central" text-anchor="middle">
                    </text>
                </svg>
                <div id="info-overlay" class="info-overlay"></div>
            </div>
            <div id="glyph-grid" class="glyph-grid">
            </div>
        </div>
    `;


    class GlyphOverview extends HTMLElement {
        // --- NO CHANGES TO ANY JAVASCRIPT ---
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.shadowRoot.appendChild(template.content.cloneNode(true));
            this.ASCII_START = 33;
            this.ASCII_END = 126;
            this.selectedCell = null;
        }

        connectedCallback() {
            this.previewPane = this.shadowRoot.querySelector('#preview-pane');
            this.previewGlyph = this.shadowRoot.querySelector('#preview-glyph');
            this.infoOverlay = this.shadowRoot.querySelector('#info-overlay');
            this.glyphGrid = this.shadowRoot.querySelector('#glyph-grid');
            this.populateGrid();
            this.selectRandomGlyph();
            this.handleMouseOver = this.handleMouseOver.bind(this);
            this.handleMouseOut = this.handleMouseOut.bind(this);
            this.handleClick = this.handleClick.bind(this);
            this.glyphGrid.addEventListener('mouseover', this.handleMouseOver);
            this.glyphGrid.addEventListener('mouseout', this.handleMouseOut);
            this.glyphGrid.addEventListener('click', this.handleClick);
        }

        disconnectedCallback() {
            this.glyphGrid.removeEventListener('mouseover', this.handleMouseOver);
            this.glyphGrid.removeEventListener('mouseout', this.handleMouseOut);
            this.glyphGrid.removeEventListener('click', this.handleClick);
        }

        populateGrid() {
            const fragment = document.createDocumentFragment();
            for (let i = this.ASCII_START; i <= this.ASCII_END; i++) {
                const char = String.fromCharCode(i);
                const cell = document.createElement('div');
                cell.classList.add('glyph-cell');
                cell.dataset.glyph = char;
                cell.textContent = char;
                fragment.appendChild(cell);
            }
            this.glyphGrid.appendChild(fragment);
        }

        selectRandomGlyph() {
            const cells = this.shadowRoot.querySelectorAll('.glyph-cell');
            const randomIndex = Math.floor(Math.random() * cells.length);
            const randomCell = cells[randomIndex];
            this.setSelected(randomCell);
        }
        
        setSelected(cellElement) {
            if (!cellElement) return;
            if (this.selectedCell) {
                this.selectedCell.classList.remove('selected');
            }
            cellElement.classList.add('selected');
            this.selectedCell = cellElement;
            this.updatePreview(cellElement.dataset.glyph);
        }

        updatePreview(char) {
            if (!char) return;
            this.previewGlyph.textContent = char;
            const charCode = char.charCodeAt(0);
            const unicodeString = `U+${charCode.toString(16).padStart(4, '0').toUpperCase()}`;
            this.infoOverlay.textContent = `${char} — ${unicodeString}`;
        }

        handleMouseOver(event) {
            const targetCell = event.target.closest('.glyph-cell');
            if (targetCell) {
                this.updatePreview(targetCell.dataset.glyph);
            }
        }

        handleMouseOut() {
            if (this.selectedCell) {
                this.updatePreview(this.selectedCell.dataset.glyph);
            }
        }
        
        handleClick(event) {
            const targetCell = event.target.closest('.glyph-cell');
            if (targetCell) {
                this.setSelected(targetCell);
            }
        }
    }

    window.customElements.define('glyph-overview', GlyphOverview);

})();