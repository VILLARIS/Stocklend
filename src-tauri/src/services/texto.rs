//! Utilidades de texto compartidas por los servicios.
//!
//! La normalización de nombres es la misma para categorías (RN-10) y artículos
//! (RN-09): comparar ignorando mayúsculas y espacios sobrantes. Se centraliza
//! aquí para que ambos servicios no puedan divergir.

/// Normaliza un nombre para comparar duplicados: recorta, colapsa los espacios
/// internos a uno solo y pasa a minúsculas.
pub fn normalizar_nombre(nombre: &str) -> String {
    nombre.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
}

/// Recorta un texto opcional y convierte el vacío en `None`.
pub fn limpiar_opcional(texto: Option<&str>) -> Option<&str> {
    texto.map(str::trim).filter(|valor| !valor.is_empty())
}
