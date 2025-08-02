# Architecture Guide: Modular Web-Based Font Editor

This document outlines the software architecture for building a web-based graphic design tool that allows users to create and download their own fonts. The primary goal is to create a system that is modular, easy to understand, debug, and extend. This guide reflects the latest version, including user experience improvements and bug fixes.

## 1. Core Philosophy: Separation of Concerns

To achieve our goal, we will use a design pattern similar to **Model-View-Controller (MVC)**. This pattern separates the application's data (the Model) from the user interface (the View) and the application's logic (the Controller).

*   **Model:** The single source of truth for all data in the application.
*   **View:** The visual representation of the Model (the SVG on the screen).
*   **Controller:** The logic that handles user input and updates the Model.

This separation prevents complex bugs and makes adding new features (like `undo/redo`) much simpler in the future.

## 2. The Model: A Single Source of Truth

The most critical part of this architecture is that the application's state is not stored in the HTML/SVG DOM. Instead, it's held in a single, comprehensive JavaScript object. This object is the "Model".

### `AppState` Structure

The entire state of the font being designed will be stored in an object, let's call it `AppState`.

```json
{
    "fontSettings": {
        "familyName": "MyCustomFont",
        "styleName": "Regular",
        "unitsPerEm": 1000,
        "ascender": 800,
        "descender": -200
    },
    "glyphs": [
        {
            "character": "A",
            "unicode": 65,
            "shapes": [
                {
                    "id": "shape-168937498",
                    "vertices": [
                        { "x": 100, "y": 0 }, { "x": 0, "y": 200 }, { "x": 200, "y": 200 }
                    ]
                }
            ]
        }
    ]
}
```

**Key Advantages:**
*   **Persistence:** This object is automatically saved to the browser's `localStorage`. This means the user's work is preserved between sessions.
*   **Debugging:** At any point, we can `console.log(AppState)` to see the exact state of the entire application.
*   **Decoupling:** The data is not tied to SVG. We could use this same state to render to a `<canvas>` or any other format.

## 3. The Class Structure

We will structure our application into three main classes that embody the MVC pattern.

### `FontEditorApp` (The Main Orchestrator)
This class manages the overall application.

*   **Responsibilities:**
    *   Holds the master `AppState` object.
    *   On startup, it first tries to load state from `localStorage`. If no state is found, it creates a new default state.
    *   Initializes the application layout, creating an artboard instance for each glyph defined in the state.
    *   Creates and manages an array of `GlyphController` instances.
    *   Provides methods for controllers to call to update the central state (e.g., `addShapeToGlyph`, `resetGlyph`).
    *   Handles global actions via the **"Download Font"** and **"Start New Font"** buttons.

### `GlyphController` (The Logic)
An instance of this class is created for *each* letter's artboard.

*   **Responsibilities:**
    *   Manages the logic for a single glyph (e.g., the letter 'A').
    *   Listens for user input events (`click`) on its specific SVG artboard.
    *   Contains the logic for processing user input (e.g., calculating vertices for a new shape from clicks).
    *   When a new shape needs to be created, it **does not modify the DOM directly**. Instead, it calls a method on the main `FontEditorApp` instance, passing the new shape data.
    *   Holds an instance of a `GlyphView`.
    *   Triggers its `GlyphView` to re-render whenever its data changes.

### `GlyphView` (The Renderer)
This is a "dumb" class responsible only for visual representation.

*   **Responsibilities:**
    *   Manages a single SVG element.
    *   Has a `render(shapes)` method that takes an array of shape data.
    *   The `render` method first clears any previously drawn shapes. Then, it iterates through the `shapes` array and creates a `<polygon>` SVG element for each one.
    *   It knows *what* to draw, but not *why* or *how* the data was created.

## 4. The Data Flow: A Step-by-Step Example

Understanding the flow of data is key. Let's trace what happens when a user draws a new polygon on the letter 'B'.

1.  **User Action:** The user clicks twice on the grid within the SVG artboard for the letter 'B'.
2.  **Controller Catches Event:** The `GlyphController` for 'B' has an event listener on the SVG. Its `onCellClick` handler fires.
3.  **Controller Processes Logic:** The controller's logic runs, calculating the final vertices of the new polygon based on the two clicks.
4.  **Controller Updates Model (Indirectly):** The 'B' `GlyphController` calls `this.app.addShapeToGlyph('B', { id: '...', vertices: [...] })`.
5.  **Main App Updates State:** The `FontEditorApp` finds the 'B' object inside its `this.appState.glyphs` array and pushes the new shape object into its `shapes` array. The app automatically saves the updated `AppState` to `localStorage`.
6.  **View is Re-Rendered:** The `FontEditorApp` calls the `render()` method on the 'B' `GlyphController`.
7.  **Render Execution:** The `GlyphController` gets the fresh data for 'B' from the `AppState` and passes it to its `GlyphView`. The `GlyphView` redraws all the polygons for 'B', and the new shape appears on the screen.

## 5. Key Implementation Details

### Application Initialization
The application should be started from a `DOMContentLoaded` event listener.
1.  A helper function (`createAsciiGlyphSet`) generates an array of all printable ASCII characters (codes 33-126).
2.  This array is passed to the constructor of a new `FontEditorApp` instance, ensuring the tool is immediately useful with a full character set.

### Font Generation
Generating the downloadable font file is a two-step process handled inside `FontEditorApp`:
1.  **Merge Shapes:** The `mergePathsWithPaperJS` method takes the array of shapes for a glyph and uses the `paper.js` library to unite them into a single, combined shape. It returns this shape as an SVG path data string (e.g., `"M10 10 L20 20 Z"`).
2.  **Parse Path Data:** The `createFont` method iterates through each glyph. For each one, it creates a new `opentype.Path`. Since `opentype.js` does not have a built-in function to parse SVG path strings, we use a custom helper function, `parseSVGPath`, to read the string from the previous step and convert it into a series of `moveTo`, `lineTo`, etc. commands that `opentype.js` can understand.

### Starting a New Project
The "Start New Font" button provides a crucial user function:
*   It first asks the user for confirmation to prevent accidental data loss.
*   If confirmed, it calls `localStorage.removeItem('fontDesignerState')` to delete the saved work.
*   It then immediately calls `window.location.reload()` to restart the application. Since the saved state is gone, the app will initialize with the default ASCII character set.