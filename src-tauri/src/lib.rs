pub mod commands;
pub mod core;
pub mod db;
pub mod models;
pub mod repositories;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::diagnostics::diagnosticar_bd,
            commands::dashboard::obtener_panel,
            commands::inventory::listar_articulos,
            commands::inventory::listar_unidades,
            commands::inventory::listar_categorias,
            commands::inventory::obtener_estadisticas_inventario,
            commands::inventory::crear_categoria,
            commands::inventory::actualizar_categoria,
            commands::inventory::cambiar_estado_categoria,
            commands::inventory::crear_articulo,
            commands::inventory::actualizar_articulo,
            commands::inventory::ajustar_existencias,
            commands::inventory::agregar_unidad,
            commands::inventory::actualizar_unidad,
            commands::inventory::cambiar_estado_unidad
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
