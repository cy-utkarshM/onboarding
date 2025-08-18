
import customtkinter
import subprocess
import os
import threading

# --- Constants ---
# Build the path to the CLI executable relative to this script's location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CLI_EXECUTABLE = os.path.join(SCRIPT_DIR, '../bin/run')

# --- Main Application Class ---
class App(customtkinter.CTk):
    def __init__(self):
        super().__init__()

        self.title("Device Onboarding GUI")
        self.geometry("800x600")

        # --- Configure grid layout ---
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # --- Top Frame for Controls ---
        self.control_frame = customtkinter.CTkFrame(self)
        self.control_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")

        self.auth_button = customtkinter.CTkButton(self.control_frame, text="Device Auth", command=lambda: self.run_command(["device", "auth"]))
        self.auth_button.pack(side="left", padx=5, pady=5)

        self.logs_button = customtkinter.CTkButton(self.control_frame, text="Device Logs", command=lambda: self.run_command(["device", "logs"]))
        self.logs_button.pack(side="left", padx=5, pady=5)

        self.update_button = customtkinter.CTkButton(self.control_frame, text="Device Update", command=lambda: self.run_command(["device", "update"]))
        self.update_button.pack(side="left", padx=5, pady=5)

        self.onboarding_button = customtkinter.CTkButton(self.control_frame, text="Onboarding Setup", command=lambda: self.run_command(["onboarding", "setup"]))
        self.onboarding_button.pack(side="left", padx=5, pady=5)

        self.onboard_multiple_button = customtkinter.CTkButton(self.control_frame, text="Onboard Multiple", command=lambda: self.run_command(['onboarding:setup-multiple']))
        self.onboard_multiple_button.pack(side="left", padx=5, pady=5)

        # --- Output Textbox ---
        self.output_textbox = customtkinter.CTkTextbox(self, wrap="word")
        self.output_textbox.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        self.output_textbox.configure(state="disabled")

    def run_command_thread(self, command):
        """Runs the command in a separate thread to keep the GUI responsive."""
        self.output_textbox.configure(state="normal")
        self.output_textbox.delete("1.0", "end")
        self.output_textbox.insert("1.0", f"Running command: {' '.join(command)}\n\n")
        self.output_textbox.configure(state="disabled")

        try:
            # Prepend the path to the CLI executable
            full_command = [CLI_EXECUTABLE] + command
            process = subprocess.Popen(
                full_command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                errors='replace'
            )

            # Read output line by line to stream it to the GUI
            self.stream_output(process.stdout)
            self.stream_output(process.stderr)
            
            process.wait()

        except FileNotFoundError:
            self.update_output(f"Error: The command '{CLI_EXECUTABLE}' was not found.\n")
            self.update_output("Please ensure the CLI is built and accessible.")
        except Exception as e:
            self.update_output(f"An unexpected error occurred: {e}\n")

    def stream_output(self, pipe):
        """Reads from a pipe and schedules an update to the textbox."""
        for line in iter(pipe.readline, ''):
            self.after(10, self.update_output, line)
        pipe.close()

    def update_output(self, text):
        """Appends text to the output textbox in a thread-safe way."""
        self.output_textbox.configure(state="normal")
        self.output_textbox.insert("end", text)
        self.output_textbox.see("end")
        self.output_textbox.configure(state="disabled")

    def run_command(self, command):
        """Starts the command execution in a new thread."""
        thread = threading.Thread(target=self.run_command_thread, args=(command,))
        thread.daemon = True  # Allows main app to exit even if threads are running
        thread.start()


# --- Run the application ---
if __name__ == "__main__":
    app = App()
    app.mainloop()
