use crate::error::LauncherError;
use crate::loader::LoaderInstallResult;
use crate::version::resolver::{LibraryArtifact, VersionDetails};

const FORGE_MAVEN: &str = "https://maven.minecraftforge.net";
const FORGE_PROMO_URL: &str = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

#[derive(Debug, serde::Deserialize)]
struct ForgePromotions {
    promos: std::collections::HashMap<String, String>,
}

/// Fetch available Forge versions for the latest Minecraft releases.
/// Forge versions are keyed as "{mc_version}-{forge_version}" (e.g., "1.21-51.0.0").
pub async fn fetch_versions() -> Result<Vec<String>, LauncherError> {
    let client = crate::http_client::build_client();

    let promos: ForgePromotions = client
        .get(FORGE_PROMO_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    // Collect unique Forge versions, filtering to "recommended" and "latest" entries
    let mut versions = std::collections::BTreeSet::new();
    for (key, value) in &promos.promos {
        if key.ends_with("-recommended") || key.ends_with("-latest") {
            // Key format: "1.21-recommended" -> value: "1.21-51.0.15"
            versions.insert(value.clone());
        }
    }

    Ok(versions.into_iter().collect())
}

/// Install Forge for a given Minecraft version.
/// For Forge 1.17+, the version JSON can be fetched from the Forge maven.
pub async fn install(
    minecraft_version: &VersionDetails,
    forge_version: &str,
    _instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    let client = crate::http_client::build_client();

    // Forge version format: "1.21-51.0.15" where "1.21" is MC version and "51.0.15" is Forge version
    let (mc_ver, forge_ver) = if let Some((mc, forge)) = forge_version.split_once('-') {
        (mc, forge)
    } else {
        // Assume current version
        (minecraft_version.id.as_str(), forge_version)
    };

    let version_id = format!("forge-{}", forge_version);

    // Forge 1.17+ uses a version JSON hosted in maven
    let version_json_url = format!(
        "{}/net/minecraftforge/forge/{}/forge-{}-client.json",
        FORGE_MAVEN, forge_version, forge_version
    );

    // Try to fetch the Forge version JSON
    let forge_version_json: serde_json::Value = match client
        .get(&version_json_url)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => resp.json().await?,
        _ => {
            // Fallback: Forge 1.16 and below need a different approach
            // For now, return a basic result with Forge installer as a library
            return build_legacy_forge_result(mc_ver, forge_ver);
        }
    };

    let main_class = forge_version_json["mainClass"]
        .as_str()
        .unwrap_or("net.minecraftforge.bootstrap.ForgeBootstrap")
        .to_string();

    let mut extra_libraries = Vec::new();
    if let Some(libs) = forge_version_json["libraries"].as_array() {
        for lib in libs {
            let name = lib["name"].as_str().unwrap_or("");
            if let Some(artifact) = parse_forge_maven_lib(name) {
                extra_libraries.push(artifact);
            }
        }
    }

    // Add the Forge client JAR as an additional library
    let forge_jar_path = format!(
        "net/minecraftforge/forge/{}/forge-{}-client.jar",
        forge_version, forge_version
    );
    let forge_jar_url = format!(
        "{}/{}",
        FORGE_MAVEN, forge_jar_path
    );
    extra_libraries.push(LibraryArtifact {
        path: forge_jar_path,
        sha1: String::new(),
        size: 0,
        url: forge_jar_url,
        is_native: false,
    });

    let extra_jvm_args = Vec::new();
    let extra_game_args = if let Some(args) = forge_version_json["arguments"]["game"].as_array() {
        args.iter()
            .filter_map(|a| a.as_str().map(String::from))
            .collect()
    } else {
        vec!["--launchTarget".to_string(), "forgeclient".to_string()]
    };

    Ok(LoaderInstallResult {
        version_id,
        main_class,
        extra_libraries,
        extra_jvm_args,
        extra_game_args,
    })
}

/// Parse a Forge-style Maven library name.
fn parse_forge_maven_lib(name: &str) -> Option<LibraryArtifact> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() > 3 { parts[3] } else { "" };

    let jar_name = if classifier.is_empty() {
        format!("{}-{}.jar", artifact, version)
    } else {
        format!("{}-{}-{}.jar", artifact, version, classifier)
    };

    let path = format!("{}/{}/{}/{}", group, artifact, version, jar_name);
    let url = if name.contains("net.minecraftforge") {
        format!("{}/{}", FORGE_MAVEN, path)
    } else {
        format!("https://libraries.minecraft.net/{}", path)
    };

    Some(LibraryArtifact {
        path,
        sha1: String::new(),
        size: 0,
        url,
        is_native: false,
    })
}

/// Build a basic Forge result for legacy versions (1.16 and below).
fn build_legacy_forge_result(mc_ver: &str, forge_ver: &str) -> Result<LoaderInstallResult, LauncherError> {
    let version_id = format!("forge-{}-{}", mc_ver, forge_ver);
    let jar_name = format!("forge-{}-{}-client.jar", mc_ver, forge_ver);

    let extra_libraries = vec![LibraryArtifact {
        path: format!("net/minecraftforge/forge/{}-{}/{}", mc_ver, forge_ver, jar_name),
        sha1: String::new(),
        size: 0,
        url: format!(
            "{}/net/minecraftforge/forge/{}-{}/{}",
            FORGE_MAVEN, mc_ver, forge_ver, jar_name
        ),
        is_native: false,
    }];

    Ok(LoaderInstallResult {
        version_id,
        main_class: "net.minecraftforge.bootstrap.ForgeBootstrap".to_string(),
        extra_libraries,
        extra_jvm_args: vec![],
        extra_game_args: vec!["--launchTarget".to_string(), "forgeclient".to_string()],
    })
}
