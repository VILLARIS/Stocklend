fn main() {
    tauri_build::build();

    // En Windows, `tauri`/`tao`/`muda` enlazan funciones de `comctl32` que solo
    // existen en la versión 6 (Common Controls v6). La aplicación final recibe
    // ese manifiesto de `tauri-build`, pero los binarios de test no, por lo que
    // al cargarse fallan con STATUS_ENTRYPOINT_NOT_FOUND. Se incrusta aquí un
    // manifiesto solo para los targets de test.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest.display()
        );
    }
}
