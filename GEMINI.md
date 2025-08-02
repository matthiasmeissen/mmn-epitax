# Architecture Guide: Modular Web-Based Font Editor

This document outlines the software architecture for building a web-based graphic design tool that allows users to create and download their own fonts. The primary goal is to create a system that is modular, easy to understand, debug, and extend. This guide reflects the latest version, including a modular typographic grid and other user experience improvements.

## 1. Core Philosophy: Separation of Concerns

To achieve our goal, we use a design pattern similar to **Model-View-Controller (MVC)**. This pattern separates the application's data from its UI and logic.

*   **Model:** The application's data and configuration. This is the single source of truth.
*   **View:** The visual representation of the Model (the SVG grids and shapes on the screen).
*   **Controller:** The logic that handles user input and updates the Model.

This separation prevents complex bugs and makes adding new features much simpler.

## 2. The Model & Configuration

The application has two primary data structures: a central configuration that defines the environment, and the application state that holds the user's work.

### The Configuration (`config` and `metrics`)
To make the tool flexible, we define a single `config` object in the main `FontEditorApp`. This object controls the entire grid system and typographic rules. From this, a `metrics` object is derived to calculate values used throughout the app.

```javascript
// Example config in FontEditorApp
this.config = {
    GRID_ROWS: 8,
    GRID_COLS: 6,
    CELL_SIZE: 100,
    DESCENDER_ROWS: 2, // Rows below the baseline
    X_HEIGHT_ROWS: 4,  // Rows from baseline to x-height
};
```
This single object dictates the size of the artboards, the position of the baseline, the ascender/descender values for the font, and the position of visual guides.

### The Application State (`AppState`)
The `AppState` object holds all the user-created data.

```json
{
    "fontSettings": { /* Derived from the metrics object */ },
    "glyphs": [
        {
            "character": "A",
            "unicode": 65,
            "shapes": [ /* Array of user-drawn shapes */ ]
        }
    ]
}
```

**Key Advantages:**
*   **Modularity:** To change the entire tool's typographic layout (e.g., a 3-row x-height), only one value in the `config` object needs to be changed.
*   **Persistence:** The `AppState` object is automatically saved to `localStorage`, preserving the user's work between sessions.
*   **Decoupling:** The data is not tied to SVG. The same state could be rendered in other ways.

## 3. The Class Structure

The application is structured into three classes that embody the MVC pattern.

### `FontEditorApp` (The Main Orchestrator)
*   **Responsibilities:**
    *   Defines the master `config` object and calculates the derived `metrics`.
    *   Holds the `AppState` object (loading from `localStorage` or creating a default state).
    *   Initializes the DOM and creates a `GlyphController` for each glyph, passing the `config` to it.
    *   Handles global actions like **"Download Font"** and **"Start New Font"**.

### `GlyphController` (The Logic)
*   **Responsibilities:**
    *   Receives the `config` object from the `FontEditorApp`.
    *   Manages user interaction logic for a single glyph's artboard.
    *   Uses the `config` for its internal calculations (e.g., detecting click location).
    *   When a shape is created, it tells `FontEditorApp` to update the state.
    *   Instantiates and manages a `GlyphView`, passing the `config` to it.

### `GlyphView` (The Renderer)
*   **Responsibilities:**
    *   Receives the `config` object from its `GlyphController`.
    *   Dynamically draws the grid and typographic guides (baseline, x-height) based on the rules in the `config`.
    *   Renders the user-created shapes from the `AppState` onto the SVG artboard.

## 4. The Data Flow: A Step-by-Step Example

1.  **Initialization:** `FontEditorApp` creates its `config` object. It then loops through the glyphs, creating a `GlyphController` for each and passing the `config` down. The controller, in turn, creates a `GlyphView`, also passing the `config`. The view uses the config to draw its grid and guides.
2.  **User Action:** A user clicks on the grid for the letter 'B'.
3.  **Controller Catches Event:** The `GlyphController` for 'B' handles the click. It uses its copy of the `config` to correctly calculate which part of the grid was clicked.
4.  **Controller Processes Logic:** After two clicks, the controller calculates the final vertices for the new polygon.
5.  **Controller Updates Model (Indirectly):** The controller calls `this.app.addShapeToGlyph('B', { ...shapeData })`.
6.  **Main App Updates State:** `FontEditorApp` pushes the new shape into the `AppState`. The app then periodically saves the entire `AppState` to `localStorage`.
7.  **View is Re-Rendered:** `FontEditorApp` tells the 'B' controller to re-render. The controller gets the latest shape data and passes it to its `GlyphView`, which draws the new polygon on screen.

## 5. Key Implementation Details

### Centralized Configuration
The `config` object in `FontEditorApp` is the single source of truth for all layout and typographic rules. This makes the entire application highly modular and easy to adjust.

### Dynamic Typographic Guides
The `GlyphView` does not contain any hardcoded numbers for layout. It calculates the `y` positions for the baseline and x-height lines based entirely on the `config` object it receives, ensuring the visual guides always match the underlying font metrics.

### Font Generation & Coordinate System
Generating the downloadable font file requires a crucial coordinate transformation:
1.  **Merge Shapes:** `mergePathsWithPaperJS` uses `paper.js` to unite a glyph's shapes into a single SVG path data string.
2.  **Transform Coordinates:** During this process, it converts the SVG's top-down coordinate system to `opentype.js`'s baseline-centric system. It does this using the `baselineY` value from the `metrics` object, ensuring a point drawn on the visual baseline becomes `y=0` in the final font.
3.  **Parse Path Data:** The custom `parseSVGPath` function reads the generated SVG path string and translates it into commands for `opentype.js`.

### Application Initialization & Reset
*   **Initialization:** The app starts by generating the full printable ASCII character set, making it useful immediately.
*   **Reset:** The "Start New Font" button allows users to clear the `localStorage` and reload the application, giving them a clean slate based on the default ASCII set.