# Device Onboarding CLI & GUI

This project contains a command-line interface (CLI) and a Python-based graphical user interface (GUI) for onboarding devices.

## CLI Usage

To use the command-line interface:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/cy-utkarshM/onboarding/
    cd onboarding
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

4.  **Run commands:**
    *   **On Linux/macOS:**
        ```bash
        ./bin/run [COMMAND]
        ```
    *   **On Windows:**
        ```bash
        node .\bin\run.js [COMMAND]
        ```
    *   **Example:**
        ```bash
        ./bin/run onboarding:setup
        ```

---

## Python GUI

A Python-based GUI is available to provide a more user-friendly way to interact with the device onboarding tools.

### How to Run the GUI

1.  **Set up a Python virtual environment (recommended):**
    *This ensures that the GUI's dependencies do not conflict with other Python projects.*
    ```bash
    python3 -m venv python-gui/venv
    ```

2.  **Activate the virtual environment:**
    *   **On Linux/macOS:**
        ```bash
        source python-gui/venv/bin/activate
        ```
    *   **On Windows:**
        ```bash
        python-gui\venv\Scripts\activate
        ```

3.  **Install dependencies:**
    ```bash
    pip install -r python-gui/requirements.txt
    ```

4.  **Launch the application:**
    ```bash
    python3 python-gui/app.py
    ```

Once launched, you can use the buttons to perform device actions, including single and concurrent device onboarding.