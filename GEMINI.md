# Architecture Guide: Modular Web-Based Font Editor

This document outlines the software architecture for building a web-based graphic design tool that allows users to create and download their own fonts. The primary goal is to create a system that is modular, easy to understand, debug, and extend. This guide reflects the latest version, including a compact data format, data portability features, and other user experience improvements.

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
The `AppState` object holds all user-created data, including the font name and all drawn shapes. To significantly reduce storage size and improve efficiency, shapes and vertices are stored in a compact array-based format.

```json
{
    "fontSettings": {
        "familyName": "My Cool Font v1.2",
        "styleName": "Regular",
        "unitsPerEm": 1000,
        "ascender": 600,
        "descender": -200
    },
    "glyphs": [
        {
            "character": "A",
            "unicode": 65,
            "shapes": [
                [ [100,600], [200,600], [300,0] ],
                [ [400,600], [500,600], [400,0] ]
            ]
        }
    ]
}
```

**Key Advantages:**
*   **Modularity:** To change the entire tool's typographic layout (e.g., a 3-row x-height), only one value in the `config` object needs to be changed.
*   **Persistence:** The `AppState` object is automatically saved to `localStorage`, preserving the user's work between sessions.
*   **Data-Efficiency:** The compact, array-based format for shapes and vertices drastically reduces the size of the saved data, making it faster to load and store.
*   **Decoupling:** The data is not tied to SVG. The same state could be rendered in other ways.

## 3. The Class Structure

The application is structured into three classes that embody the MVC pattern.

### `FontEditorApp` (The Main Orchestrator)
*   **Responsibilities:**
    *   Defines the master `config` object and calculates the derived `metrics`.
    *   Holds the `AppState` object, loading it from `localStorage` or creating a default state.
    *   **Performs on-the-fly migration of data from older formats stored in `localStorage`**.
    *   Initializes the DOM and creates a `GlyphController` for each glyph.
    *   **Handles global actions like "Download Font", "Export Data", "Import Data", and "Start New Font"**.
    *   **Manages the font's name, updating the `AppState` as the user types**.
    *   **Sanitizes the font name to create safe, web-friendly filenames for downloads**.

### `GlyphController` (The Logic)
*   **Responsibilities:**
    *   Receives the `config` object from the `FontEditorApp`.
    *   Manages user interaction logic for a single glyph's artboard.
    *   Uses the `config` for its internal calculations, detecting click location and generating vertices in the compact `[x, y]` format.
    *   When a shape is created, it tells `FontEditorApp` to update the state.
    *   Instantiates and manages a `GlyphView`, passing the `config` to it.

### `GlyphView` (The Renderer)
*   **Responsibilities:**
    *   Receives the `config` object from its `GlyphController`.
    *   Dynamically draws the grid and typographic guides (baseline, x-height) based on the rules in the `config`.
    *   Renders the user-created shapes from the `AppState` onto the SVG artboard, reading the compact `[x, y]` vertex format.

## 4. The Data Flow: A Step-by-Step Example

1.  **Initialization:** `FontEditorApp` loads its state. If it finds data in an old format in `localStorage`, it migrates it to the new compact format. It then creates a `GlyphController` for each glyph.
2.  **User Action:** A user clicks twice on the grid for the letter 'B'.
3.  **Controller Catches Events:** The `GlyphController` for 'B' handles the clicks, calculating the vertices for the new shape.
4.  **Controller Processes Logic:** The controller finalizes the list of vertices for the new polygon, for example: `[ [100,100], [200,100], [200,200] ]`.
5.  **Controller Updates Model (Indirectly):** The controller calls `this.app.addShapeToGlyph('B', [ [100,100], ... ])`.
6.  **Main App Updates State:** `FontEditorApp` pushes the new vertex array into the `shapes` array for glyph 'B' in the `AppState`. The app then periodically saves the entire `AppState` to `localStorage`.
7.  **View is Re-Rendered:** `FontEditorApp` tells the 'B' controller to re-render. The controller passes the latest shape data to its `GlyphView`, which draws the new polygon.

## 5. Key Implementation Details

### Data Persistence and Migration
The `loadState` method in `FontEditorApp` is designed for backward compatibility. It checks if the data loaded from `localStorage` is in the old, verbose object format. If it is, it silently calls the `_convertToCompactFormat` helper method to migrate the data to the new, efficient array-based format before the application proceeds. This ensures users with previously saved work do not experience data loss.

### Data Portability (Import/Export)
*   **Export:** The "Export Data" button serializes the entire `appState` object into a human-readable JSON string and triggers a file download.
*   **Import:** The "Import Data" button allows a user to select a JSON file. The application parses this file, validates that it has the expected structure, and then replaces the current `appState`. The page is then reloaded to reflect the newly imported font data.

### Font Generation & Coordinate System
Generating the downloadable font file requires a crucial coordinate transformation:
1.  **Merge Shapes:** `mergePathsWithPaperJS` uses `paper.js` to unite a glyph's shapes (each represented by an array of `[x, y]` vertices) into a single SVG path data string.
2.  **Transform Coordinates:** During this process, it converts the SVG's top-down coordinate system to `opentype.js`'s baseline-centric system. It does this using the `baselineY` value from the `metrics` object, ensuring a point drawn on the visual baseline becomes `y=0` in the final font.
3.  **Parse Path Data:** The custom `parseSVGPath` function reads the generated SVG path string and translates it into commands for `opentype.js`.

### Filename Sanitization
To ensure maximum compatibility and prevent errors, a dedicated `_sanitizeFilename` helper function is used before any file is downloaded. When the user clicks "Export Data" or "Download Font", this function takes the user-provided font name, replaces all spaces with hyphens (`-`), and removes any characters that are not alphanumeric or a period (`.`). This produces a clean, web-safe filename (e.g., `My-Cool-Font-v1.2.otf`) while leaving the internal `familyName` in the font data untouched.