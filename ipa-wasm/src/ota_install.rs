use plist::{Dictionary, Value, XmlWriteOptions};

/// 生成 OTA manifest.plist
pub fn generate_plist(
    url: String,
    bundle_identifier: String,
    bundle_version: String,
    title: String,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut root = Dictionary::new();

    let mut asset = Dictionary::new();
    asset.insert("kind".into(), Value::String("software-package".into()));
    asset.insert("url".into(), Value::String(url));

    let mut metadata = Dictionary::new();
    metadata.insert("bundle-identifier".into(), Value::String(bundle_identifier));
    metadata.insert("bundle-version".into(), Value::String(bundle_version));
    metadata.insert("kind".into(), Value::String("software".into()));
    metadata.insert("title".into(), Value::String(title));

    let mut item = Dictionary::new();
    item.insert(
        "assets".into(),
        Value::Array(vec![Value::Dictionary(asset)]),
    );
    item.insert("metadata".into(), Value::Dictionary(metadata));

    root.insert("items".into(), Value::Array(vec![Value::Dictionary(item)]));

    let plist_value = Value::Dictionary(root);
    let mut plist_bytes = Vec::new();
    plist::to_writer_xml_with_options(&mut plist_bytes, &plist_value, &XmlWriteOptions::default())?;
    Ok(String::from_utf8(plist_bytes)?)
}

fn url_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 3);
    for byte in input.as_bytes() {
        let c = *byte;
        let is_unreserved = c.is_ascii_alphanumeric()
            || c == b'-'
            || c == b'_'
            || c == b'.'
            || c == b'~';
        if is_unreserved {
            out.push(c as char);
        } else {
            out.push('%');
            out.push_str(&format!("{:02X}", c));
        }
    }
    out
}

fn pseudo_uuid() -> String {
    // simple v4-style UUID using js_sys::Math::random when available; on test we just use a deterministic-ish stub.
    #[cfg(target_arch = "wasm32")]
    {
        let mut bytes = [0u8; 16];
        for byte in bytes.iter_mut() {
            *byte = (js_sys::Math::random() * 256.0) as u8;
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        format!(
            "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5],
            bytes[6], bytes[7],
            bytes[8], bytes[9],
            bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15],
        )
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        format!("00000000-0000-4000-8000-{:012x}", nanos & 0xffff_ffff_ffff)
    }
}

pub fn generate_mobileconfig(
    manifest_url: String,
    display_name: String,
) -> Result<String, Box<dyn std::error::Error>> {
    let encoded_manifest_url = url_encode(&manifest_url);
    let itms_url = format!(
        "itms-services://?action=download-manifest&url={}",
        encoded_manifest_url
    );

    let mut content_dict = Dictionary::new();
    content_dict.insert("URL".into(), Value::String(itms_url));

    let mut payload_dict = Dictionary::new();
    payload_dict.insert("Content".into(), Value::Dictionary(content_dict));
    payload_dict.insert("Description".into(), Value::String("Install app".into()));
    payload_dict.insert("DisplayName".into(), Value::String(display_name.clone()));
    payload_dict.insert(
        "Identifier".into(),
        Value::String(format!("com.ipatool.install.{}", pseudo_uuid())),
    );
    payload_dict.insert(
        "PayloadType".into(),
        Value::String("com.apple.developer.ota-install".into()),
    );
    payload_dict.insert("PayloadUUID".into(), Value::String(pseudo_uuid()));
    payload_dict.insert("PayloadVersion".into(), Value::Integer(1.into()));

    let mut mobileconfig_dict = Dictionary::new();
    mobileconfig_dict.insert("PayloadContent".into(), Value::Dictionary(payload_dict));
    mobileconfig_dict.insert(
        "PayloadDescription".into(),
        Value::String("Install app via OTA".into()),
    );
    mobileconfig_dict.insert("PayloadDisplayName".into(), Value::String(display_name));
    mobileconfig_dict.insert(
        "PayloadIdentifier".into(),
        Value::String(format!("com.ipatool.config.{}", pseudo_uuid())),
    );
    mobileconfig_dict.insert(
        "PayloadOrganization".into(),
        Value::String("ipaTool".into()),
    );
    mobileconfig_dict.insert("PayloadRemovalDisallowed".into(), Value::Boolean(false));
    mobileconfig_dict.insert("PayloadType".into(), Value::String("Configuration".into()));
    mobileconfig_dict.insert("PayloadUUID".into(), Value::String(pseudo_uuid()));
    mobileconfig_dict.insert("PayloadVersion".into(), Value::Integer(1.into()));

    let mobileconfig_value = Value::Dictionary(mobileconfig_dict);
    let mut mobileconfig_bytes = Vec::new();
    plist::to_writer_xml_with_options(
        &mut mobileconfig_bytes,
        &mobileconfig_value,
        &XmlWriteOptions::default(),
    )?;
    Ok(String::from_utf8(mobileconfig_bytes)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_plist() {
        let result = generate_plist(
            "https://example.com/app.ipa".to_string(),
            "com.example.app".to_string(),
            "1.0.0".to_string(),
            "Test App".to_string(),
        );
        assert!(result.is_ok());
        let plist = result.unwrap();
        assert!(plist.contains("<key>items</key>"));
        assert!(plist.contains("software-package"));
        assert!(plist.contains("bundle-identifier"));
    }

    #[test]
    fn test_generate_mobileconfig() {
        let result = generate_mobileconfig(
            "https://example.com/manifest.plist".to_string(),
            "Test App".to_string(),
        );
        assert!(result.is_ok());
        let mc = result.unwrap();
        assert!(mc.contains("itms-services://"));
        assert!(mc.contains("PayloadType"));
    }
}
