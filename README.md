# Home Theater Designer

A web-based tool to visually design and plan home theater speaker layouts.

## Features

*   Interactive canvas for room layout.
*   Place and move speakers and the listener position.
*   Measurement tool with distance display and snapping to objects and axes.
*   Angle calculation guides (inferred).
*   Real-time visual feedback.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (which includes npm)
*   [pnpm](https://pnpm.io/installation) (can be installed via `npm install -g pnpm`)

### Installation

1.  Clone the repository (if applicable).
2.  Navigate to the project directory:
    ```bash
    cd /Users/witek/projects/hometheater
    ```
3.  Install the dependencies using pnpm:
    ```bash
    pnpm install
    ```

### Running the Development Server

To run the application locally with hot-reloading for development:

```bash
pnpm run dev
```

This will start a local development server (usually at `http://localhost:5173` or the next available port). Open the provided URL in your web browser.

### Building for Production

To create an optimized static build of the application:

```bash
pnpm run build
```

The output files will be placed in the `dist` directory.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
