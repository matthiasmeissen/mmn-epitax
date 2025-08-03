const template = document.createElement('template');

template.innerHTML = `
    <style>
        :host {
            display: block;
            position: relative;
            height: 80vh;
            box-sizing: border-box;

            background-color: var(--color-background-subtle);
            color: var(--color-foreground-primary);
            transition: background-color 0.3s, color 0.3s;
            
            --selection-bg: var(--color-foreground-accent);
            --selection-color: var(--color-background-primary);
            
            --slider-color: var(--color-foreground-primary);
            --slider-bg: var(--color-background-subtle);
        }

        .previewer-wrapper {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        
        .text-editor {
            flex-grow: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            
            background-color: transparent;
            color: inherit;
            font-family: var(--font-family-epitax);
            
            text-align: center;
            font-size: 48px;
            line-height: 1.2;
            outline: none;
            overflow: hidden;
        }
        
        .text-editor::selection {
            background-color: var(--selection-bg);
            color: var(--selection-color);
        }

        .controls {
            position: absolute;
            top: 32px;
            left: 32px;
            right: 32px;
            width: auto;
            
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 24px;
            align-items: center;
            
            font-family: var(--font-family-text, monospace);
            color: inherit;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        input[type="range"] {
            -webkit-appearance: none;
            appearance: none;
            width: 150px;
            height: 4px;
            background: transparent;
            border: 2px solid var(--slider-color);
            border-radius: 2px;
            transition: box-shadow 0.2s, border-color 0.3s;
        }
        
        input[type="range"]:focus {
            outline: none;
            box-shadow: 0 0 0 3px var(--color-foreground-accent);
        }
        
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: var(--slider-color);
            cursor: pointer;
            border-radius: 50%;
            transition: background-color 0.3s;
        }
        
        input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: var(--slider-color);
            border: none;
            cursor: pointer;
            border-radius: 50%;
            transition: background-color 0.3s;
        }

        #font-size-value {
            min-width: 4ch; 
            font-weight: bold;
        }
        
        .theme-button {
            background: transparent;
            color: currentColor;
            border: 2px solid currentColor;
            padding: 8px 12px;
            font-family: inherit;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.3s, border-color 0.3s;
        }
        
        .theme-button:focus {
            outline: 2px solid var(--color-foreground-accent, #ff2200);
            outline-offset: 2px;
        }
    </style>

    <div class="previewer-wrapper">
        <div class="controls">
            <div class="control-group">
                <input type="range" id="font-size" min="16" max="250" value="48" />
                <span id="font-size-value">48px</span>
            </div>
            <div class="control-group">
                <button id="theme-toggle" class="theme-button">Toggle Theme</button>
            </div>
        </div>
        <div id="text-editor" class="text-editor" contenteditable="true">Type anything</div>
    </div>
`;

class FontPreview extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.themes = [
            { 
                color: 'var(--color-foreground-primary)', 
                background: 'var(--color-background-subtle)',
                selectionColor: 'var(--color-background-primary)',
                selectionBg: 'var(--color-foreground-accent)',
                sliderColor: 'var(--color-foreground-primary)'
            },
            { 
                color: 'var(--color-background-subtle)', 
                background: 'var(--color-foreground-primary)',
                selectionColor: 'var(--color-foreground-primary)',
                selectionBg: 'var(--color-background-subtle)',
                sliderColor: 'var(--color-background-subtle)'
            },
            { 
                color: 'var(--color-foreground-accent)', 
                background: 'var(--color-foreground-primary)',
                selectionColor: 'var(--color-foreground-primary)',
                selectionBg: 'var(--color-background-subtle)',
                sliderColor: 'var(--color-foreground-accent)'
            }
        ];
        this.currentThemeIndex = 0;

        this.boundUpdateFontSize = this.updateFontSize.bind(this);
        this.boundToggleTheme = this.toggleTheme.bind(this);
    }

    connectedCallback() {
        this.textEditor = this.shadowRoot.querySelector('#text-editor');
        this.fontSizeSlider = this.shadowRoot.querySelector('#font-size');
        this.fontSizeValue = this.shadowRoot.querySelector('#font-size-value');
        this.themeToggleButton = this.shadowRoot.querySelector('#theme-toggle');

        this.fontSizeSlider.addEventListener('input', this.boundUpdateFontSize);
        this.themeToggleButton.addEventListener('click', this.boundToggleTheme);

        this.updateFontSize();
        this.applyTheme();
    }

    disconnectedCallback() {
        this.fontSizeSlider.removeEventListener('input', this.boundUpdateFontSize);
        this.themeToggleButton.removeEventListener('click', this.boundToggleTheme);
    }

    updateFontSize() {
        const newSize = this.fontSizeSlider.value;
        this.textEditor.style.fontSize = `${newSize}px`;
        this.fontSizeValue.textContent = `${newSize}px`;
    }

    toggleTheme() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        this.applyTheme();
    }
    
    applyTheme() {
        const theme = this.themes[this.currentThemeIndex];

        this.style.backgroundColor = theme.background;
        this.style.color = theme.color;

        this.style.setProperty('--selection-bg', theme.selectionBg);
        this.style.setProperty('--selection-color', theme.selectionColor);
        
        this.style.setProperty('--slider-color', theme.sliderColor);
    }
}

window.customElements.define('font-preview', FontPreview);