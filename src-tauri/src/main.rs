// No console window beside Servos's own in the program people install.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    servos_lib::run()
}
