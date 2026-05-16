use sha1::{Digest, Sha1};
use std::path::Path;

pub fn verify_sha1(path: &Path, expected: &str) -> Result<bool, std::io::Error> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let result = hex::encode(hasher.finalize());
    Ok(result.eq_ignore_ascii_case(expected))
}
