use std::io::Cursor;
use std::io::Read;

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct IpaMetadata {
    pub item_id: Option<String>,
    pub item_name: Option<String>,
    pub bundle_display_name: Option<String>,
    pub bundle_id: Option<String>,
    pub bundle_short_version: Option<String>,
    pub bundle_version: Option<String>,
    pub artist_name: Option<String>,
    pub artist_id: Option<String>,
    pub genre: Option<String>,
    pub genre_id: Option<String>,
    pub release_date: Option<String>,
    pub copyright: Option<String>,
    pub icon_url: Option<String>,
    pub has_iap: Option<bool>,
    pub min_os_version: Option<String>,
    #[serde(skip)]
    pub primary_icon_bytes: Option<Vec<u8>>,
}

pub fn extract_itunes_metadata_from_bytes(bytes: &[u8]) -> Option<IpaMetadata> {
    let cursor = Cursor::new(bytes);
    let mut zip = zip::ZipArchive::new(cursor).ok()?;
    let mut metadata = IpaMetadata::default();

    if let Some(itunes_plist) = read_plist_from_zip(&mut zip, "iTunesMetadata.plist") {
        metadata.item_id = plist_string_value(&itunes_plist, "itemId");
        metadata.item_name = plist_string_value(&itunes_plist, "itemName");
        metadata.bundle_display_name = plist_string_value(&itunes_plist, "bundleDisplayName");
        metadata.bundle_id = plist_string_value(&itunes_plist, "softwareVersionBundleId");
        metadata.bundle_short_version =
            plist_string_value(&itunes_plist, "bundleShortVersionString");
        metadata.bundle_version = plist_string_value(&itunes_plist, "bundleVersion");
        metadata.artist_name = plist_string_value(&itunes_plist, "artistName");
        metadata.artist_id = plist_string_value(&itunes_plist, "artistId");
        metadata.genre = plist_string_value(&itunes_plist, "genre");
        metadata.genre_id = plist_string_value(&itunes_plist, "genreId");
        metadata.release_date = plist_string_value(&itunes_plist, "releaseDate");
        metadata.copyright = plist_string_value(&itunes_plist, "copyright");
        metadata.icon_url = plist_string_value(&itunes_plist, "softwareIcon57x57URL");
        metadata.has_iap = plist_bool_value(&itunes_plist, "hasOrEverHasHadIAP");
    }

    if let Some(app_bundle_name) = find_app_bundle_in_zip(&mut zip) {
        let info_path = format!("Payload/{}/Info.plist", app_bundle_name);
        if let Some(info_plist) = read_plist_from_zip(&mut zip, &info_path) {
            metadata.min_os_version = plist_string_value(&info_plist, "MinimumOSVersion");

            if metadata.bundle_id.is_none() {
                metadata.bundle_id = plist_string_value(&info_plist, "CFBundleIdentifier");
            }
            if metadata.bundle_display_name.is_none() {
                metadata.bundle_display_name =
                    plist_string_value(&info_plist, "CFBundleDisplayName")
                        .or_else(|| plist_string_value(&info_plist, "CFBundleName"));
            }
            if metadata.bundle_short_version.is_none() {
                metadata.bundle_short_version =
                    plist_string_value(&info_plist, "CFBundleShortVersionString");
            }
            if metadata.bundle_version.is_none() {
                metadata.bundle_version = plist_string_value(&info_plist, "CFBundleVersion");
            }
        }
        metadata.primary_icon_bytes = extract_largest_app_icon_from_zip(&mut zip, &app_bundle_name);
    }

    if metadata.bundle_id.is_none()
        && metadata.item_name.is_none()
        && metadata.bundle_display_name.is_none()
    {
        return None;
    }

    Some(metadata)
}

fn extract_largest_app_icon_from_zip<R: Read + std::io::Seek>(
    zip: &mut zip::ZipArchive<R>,
    app_bundle_name: &str,
) -> Option<Vec<u8>> {
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
            if entry.read_to_end(&mut data).is_ok() {
                if data.len() > 8 && data[0..4] == [0x89, 0x50, 0x4E, 0x47] {
                    return Some(data);
                }
            }
        }
    }

    let mut best_icon: Option<Vec<u8>> = None;
    let mut best_size: usize = 0;
    let count = zip.len();

    for i in 0..count {
        let name_opt = zip.by_index(i).ok().map(|e| e.name().to_string());
        let Some(name) = name_opt else { continue };
        if name.contains("AppIcon") && name.ends_with(".png") {
            let mut data = Vec::new();
            let Ok(mut entry) = zip.by_name(&name) else {
                continue;
            };
            if entry.read_to_end(&mut data).is_ok()
                && data.len() > best_size
                && data.len() > 8
                && data[0..4] == [0x89, 0x50, 0x4E, 0x47]
            {
                best_size = data.len();
                best_icon = Some(data);
            }
        }
    }

    best_icon
}

pub fn find_app_bundle_in_zip<R: Read + std::io::Seek>(
    zip: &mut zip::ZipArchive<R>,
) -> Option<String> {
    for i in 0..zip.len() {
        let zip_name = zip.by_index(i).ok()?.name().to_string();
        if zip_name.starts_with("Payload/") && zip_name.ends_with(".app/") {
            let bundle = zip_name
                .strip_prefix("Payload/")
                .and_then(|s| s.strip_suffix('/'))
                .unwrap_or(&zip_name)
                .to_string();
            return Some(bundle);
        }
    }
    for i in 0..zip.len() {
        let zip_name = zip.by_index(i).ok()?.name().to_string();
        if let Some(rest) = zip_name.strip_prefix("Payload/") {
            if let Some((bundle, _)) = rest.split_once('/') {
                if bundle.ends_with(".app") {
                    return Some(bundle.to_string());
                }
            }
        }
    }
    None
}

pub fn read_plist_from_zip<R: Read + std::io::Seek>(
    zip: &mut zip::ZipArchive<R>,
    path: &str,
) -> Option<plist::Value> {
    let mut file = zip.by_name(path).ok()?;
    let mut content = Vec::new();
    file.read_to_end(&mut content).ok()?;
    plist::from_bytes(&content).ok()
}

pub fn plist_string_value(plist: &plist::Value, key: &str) -> Option<String> {
    match plist {
        plist::Value::Dictionary(dict) => dict.get(key).and_then(|v| match v {
            plist::Value::String(s) => Some(s.to_string()),
            _ => None,
        }),
        _ => None,
    }
}

fn plist_bool_value(plist: &plist::Value, key: &str) -> Option<bool> {
    match plist {
        plist::Value::Dictionary(dict) => dict.get(key).and_then(|v| match v {
            plist::Value::Boolean(b) => Some(*b),
            plist::Value::Integer(i) => Some(i.as_unsigned() != Some(0)),
            _ => None,
        }),
        _ => None,
    }
}
