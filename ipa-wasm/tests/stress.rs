//! Memory + correctness stress tests for the IPA patcher.
//! Run with: `cargo test --release --test stress -- --nocapture`
use ipa_wasm::ipa_utils;
use ipa_wasm::signature::{
    self, ManifestTargets, SignatureClient, SignatureMetadata, Sinf,
};
use std::io::{Cursor, Read, Write};

fn write_zip(entries: &[(&str, Vec<u8>)]) -> Vec<u8> {
    let mut out = Vec::new();
    {
        let cursor = Cursor::new(&mut out);
        let mut zip = zip::ZipWriter::new(cursor);
        let opts: zip::write::FileOptions<'_, ()> =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (path, data) in entries {
            if path.ends_with('/') {
                zip.add_directory(*path, opts).unwrap();
            } else {
                zip.start_file(*path, opts).unwrap();
                zip.write_all(data).unwrap();
            }
        }
        zip.finish().unwrap();
    }
    out
}

fn synth_info_plist(executable: &str, bundle_id: &str, version: &str, name: &str) -> Vec<u8> {
    let mut dict = plist::Dictionary::new();
    dict.insert(
        "CFBundleExecutable".to_string(),
        plist::Value::String(executable.to_string()),
    );
    dict.insert(
        "CFBundleIdentifier".to_string(),
        plist::Value::String(bundle_id.to_string()),
    );
    dict.insert(
        "CFBundleShortVersionString".to_string(),
        plist::Value::String(version.to_string()),
    );
    dict.insert(
        "CFBundleDisplayName".to_string(),
        plist::Value::String(name.to_string()),
    );
    let mut out = Vec::new();
    plist::to_writer_xml(&mut out, &plist::Value::Dictionary(dict)).unwrap();
    out
}

fn synth_manifest(paths: &[&str]) -> Vec<u8> {
    let mut dict = plist::Dictionary::new();
    dict.insert(
        "SinfPaths".to_string(),
        plist::Value::Array(
            paths
                .iter()
                .map(|p| plist::Value::String(p.to_string()))
                .collect(),
        ),
    );
    let mut out = Vec::new();
    plist::to_writer_xml(&mut out, &plist::Value::Dictionary(dict)).unwrap();
    out
}

#[test]
fn full_pipeline_inspect_patch_roundtrip() {
    // Synthesize a small but realistic IPA structure and run inspect→patch→reinspect.
    let info = synth_info_plist("Test", "com.test.app", "1.2.3", "TestApp");
    let manifest = synth_manifest(&["SC_Info/Test.sinf"]);
    let archive = write_zip(&[
        ("Payload/Test.app/", Vec::new()),
        ("Payload/Test.app/Info.plist", info),
        ("Payload/Test.app/SC_Info/Manifest.plist", manifest),
        ("Payload/Test.app/Assets.car", vec![0u8; 100 * 1024]),
        ("Payload/Test.app/Test", vec![0u8; 200 * 1024]),
    ]);

    let inspection_before = signature::inspect_ipa(&archive).unwrap();
    assert_eq!(inspection_before.bundle_id.as_deref(), Some("com.test.app"));
    assert_eq!(inspection_before.bundle_short_version.as_deref(), Some("1.2.3"));
    assert!(!inspection_before.declared_sinf_paths.is_empty());

    // Build a synthetic Apple downloadProduct response shape
    let sinf_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        b"my-real-sinf-bytes",
    );
    let song_list_0 = serde_json::json!({
        "metadata": {
            "bundleDisplayName": "TestApp",
            "bundleShortVersionString": "1.2.3",
            "bundleId": "com.test.app",
            "artistName": "Tester",
        },
        "sinfs": [
            {"id": 0, "sinf": sinf_b64}
        ]
    });

    let mut client = SignatureClient::from_bytes(archive, &song_list_0, "tester@example.com")
        .expect("from_bytes");
    client.append_metadata();
    let result = client.append_signatures().expect("append_signatures");
    assert!(result.warning.is_none(), "warning: {:?}", result.warning);

    let patched = client.into_bytes();

    // Verify the sinf is in the right place
    let mut zip = zip::ZipArchive::new(Cursor::new(&patched)).unwrap();
    let mut sinf = zip
        .by_name("Payload/Test.app/SC_Info/Test.sinf")
        .expect("sinf entry");
    let mut sinf_bytes = Vec::new();
    sinf.read_to_end(&mut sinf_bytes).unwrap();
    assert_eq!(sinf_bytes, b"my-real-sinf-bytes");

    // Verify iTunesMetadata.plist was injected
    drop(sinf);
    let mut metadata = zip.by_name("iTunesMetadata.plist").unwrap();
    let mut metadata_bytes = Vec::new();
    metadata.read_to_end(&mut metadata_bytes).unwrap();
    let parsed = plist::from_bytes::<plist::Value>(&metadata_bytes).unwrap();
    let dict = parsed.as_dictionary().unwrap();
    assert_eq!(
        dict.get("apple-id").and_then(|v| v.as_string()),
        Some("tester@example.com")
    );
    drop(metadata);

    // Verify metadata extraction
    let extracted = ipa_utils::extract_itunes_metadata_from_bytes(&patched).unwrap();
    assert_eq!(extracted.bundle_id.as_deref(), Some("com.test.app"));
    assert_eq!(extracted.bundle_short_version.as_deref(), Some("1.2.3"));
}

#[test]
fn replace_zip_entries_handles_50mb_archive() {
    // 50 MB synthetic — fast enough to run in CI, exercises memory paths.
    let big = vec![0xAB; 50 * 1024 * 1024];
    let info = synth_info_plist("Big", "com.big.app", "9.9", "BigApp");
    let mut archive = write_zip(&[
        ("Payload/Big.app/", Vec::new()),
        ("Payload/Big.app/Info.plist", info),
        ("Payload/Big.app/SC_Info/Manifest.plist", synth_manifest(&["SC_Info/Big.sinf"])),
        ("Payload/Big.app/Big", big),
    ]);

    let replacements = vec![(
        "Payload/Big.app/SC_Info/Big.sinf".to_string(),
        b"sinf-data".to_vec(),
    )];
    signature::replace_zip_entries(&mut archive, &replacements).unwrap();

    let mut zip = zip::ZipArchive::new(Cursor::new(&archive)).unwrap();
    let mut sinf = zip.by_name("Payload/Big.app/SC_Info/Big.sinf").unwrap();
    let mut sinf_bytes = Vec::new();
    sinf.read_to_end(&mut sinf_bytes).unwrap();
    assert_eq!(sinf_bytes, b"sinf-data");

    drop(sinf);
    let mut big_entry = zip.by_name("Payload/Big.app/Big").unwrap();
    assert_eq!(big_entry.size(), 50 * 1024 * 1024);
}

#[test]
fn build_injection_plan_handles_empty_signatures_with_targets() {
    let plan = signature::build_injection_plan(
        &Vec::<Sinf>::new(),
        &ManifestTargets {
            sinf_paths: vec!["SC_Info/Foo.sinf".to_string()],
            sinf_replication_paths: vec![],
        },
    )
    .unwrap();
    assert!(plan.applied_paths.is_empty());
    assert!(plan.warning.is_some());
}

#[test]
fn signature_metadata_smoke() {
    let _m = SignatureMetadata {
        bundle_display_name: None,
        bundle_short_version_string: None,
        bundle_id: None,
        artwork_url: None,
        artist_name: None,
        apple_id: None,
        user_name: None,
    };
}
