pub mod ipa_utils;
pub mod ota_install;
pub mod signature;

use signature::{IpaInspection, SignatureClient};
use wasm_bindgen::prelude::*;

fn js_err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&format!("{}", e))
}

/// 检查 IPA 包内容（仅读取，不修改字节）
/// ipa_bytes: 完整 IPA 字节
/// 返回 IpaInspection（JSON 兼容）
#[wasm_bindgen]
pub fn inspect(ipa_bytes: &[u8]) -> Result<JsValue, JsValue> {
    let inspection: IpaInspection = signature::inspect_ipa(ipa_bytes).map_err(js_err)?;
    serde_wasm_bindgen::to_value(&inspection).map_err(js_err)
}

/// 提取 IPA 内的 iTunesMetadata.plist + Info.plist 元数据，返回 JSON 兼容的对象
/// 不返回 icon bytes（用 extract_icon 单独取）
#[wasm_bindgen(js_name = extractMetadata)]
pub fn extract_metadata(ipa_bytes: &[u8]) -> Result<JsValue, JsValue> {
    let metadata = ipa_utils::extract_itunes_metadata_from_bytes(ipa_bytes)
        .ok_or_else(|| JsValue::from_str("无法解析 IPA 元数据"))?;
    serde_wasm_bindgen::to_value(&metadata).map_err(js_err)
}

/// 提取 IPA 内最大的 AppIcon PNG，返回 Uint8Array（找不到返回空）
#[wasm_bindgen(js_name = extractIcon)]
pub fn extract_icon(ipa_bytes: &[u8]) -> Vec<u8> {
    let cursor = std::io::Cursor::new(ipa_bytes);
    let Ok(mut zip) = zip::ZipArchive::new(cursor) else {
        return Vec::new();
    };
    let Some(app_bundle_name) = ipa_utils::find_app_bundle_in_zip(&mut zip) else {
        return Vec::new();
    };
    extract_largest_app_icon(&mut zip, &app_bundle_name).unwrap_or_default()
}

fn extract_largest_app_icon<R: std::io::Read + std::io::Seek>(
    zip: &mut zip::ZipArchive<R>,
    app_bundle_name: &str,
) -> Option<Vec<u8>> {
    use std::io::Read;
    let icon_prefix = format!("Payload/{}/AppIcon60x60/", app_bundle_name);
    let priorities: &[&str] = &[
        "@3x~ipad.png",
        "@3x~iphone.png",
        "@3x.png",
        "@2x~ipad.png",
        "@2x~iphone.png",
        "@2x.png",
        "@1x~ipad.png",
        "@1x~iphone.png",
        "@1x.png",
        ".png",
    ];
    for suffix in priorities {
        let icon_path = format!("{}{}", icon_prefix, suffix);
        if let Ok(mut entry) = zip.by_name(&icon_path) {
            let mut data = Vec::new();
            if entry.read_to_end(&mut data).is_ok()
                && data.len() > 8
                && data[0..4] == [0x89, 0x50, 0x4E, 0x47]
            {
                return Some(data);
            }
        }
    }
    None
}

/// 在浏览器内对完整 IPA 字节做 sinf 注入 + iTunesMetadata 注入。
/// 输入：
///   ipa_bytes: 完整 IPA Uint8Array
///   song_list_0_json: Apple downloadProduct 响应里的 songList[0]（JSON 字符串）
///   email: Apple ID
/// 输出：patched IPA bytes（Uint8Array）
#[wasm_bindgen(js_name = applyPatch)]
pub fn apply_patch(
    ipa_bytes: Vec<u8>,
    song_list_0_json: &str,
    email: &str,
) -> Result<Vec<u8>, JsValue> {
    let song_list_0: serde_json::Value =
        serde_json::from_str(song_list_0_json).map_err(js_err)?;
    let mut client = SignatureClient::from_bytes(ipa_bytes, &song_list_0, email).map_err(js_err)?;
    client.append_metadata();
    let _ = client.append_signatures().map_err(js_err)?;
    Ok(client.into_bytes())
}

/// 单独执行 sinf 注入（不写 iTunesMetadata），返回 ApplyResult JSON + 新字节。
#[wasm_bindgen(js_name = applySignaturesOnly)]
pub fn apply_signatures_only(
    ipa_bytes: Vec<u8>,
    song_list_0_json: &str,
    email: &str,
) -> Result<JsValue, JsValue> {
    let song_list_0: serde_json::Value =
        serde_json::from_str(song_list_0_json).map_err(js_err)?;
    let mut client = SignatureClient::from_bytes(ipa_bytes, &song_list_0, email).map_err(js_err)?;
    let result = client.append_signatures().map_err(js_err)?;
    let bytes = client.into_bytes();
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(
        &obj,
        &"result".into(),
        &serde_wasm_bindgen::to_value(&result).map_err(js_err)?,
    )?;
    js_sys::Reflect::set(
        &obj,
        &"bytes".into(),
        &js_sys::Uint8Array::from(bytes.as_slice()).into(),
    )?;
    Ok(obj.into())
}

/// 生成 iOS OTA manifest.plist 字符串
#[wasm_bindgen(js_name = buildOtaManifest)]
pub fn build_ota_manifest(
    ipa_url: String,
    bundle_id: String,
    version: String,
    title: String,
) -> Result<String, JsValue> {
    ota_install::generate_plist(ipa_url, bundle_id, version, title).map_err(|e| js_err(e))
}

/// 生成 iOS .mobileconfig（包装 itms-services://）字符串
#[wasm_bindgen(js_name = buildMobileconfig)]
pub fn build_mobileconfig(manifest_url: String, display_name: String) -> Result<String, JsValue> {
    ota_install::generate_mobileconfig(manifest_url, display_name).map_err(|e| js_err(e))
}
