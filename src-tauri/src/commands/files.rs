use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

fn validate_path(path: &str) -> Result<PathBuf, String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Invalid path '{}': {}", path, e))?;

    for component in canonical.components() {
        if let std::path::Component::ParentDir = component {
            return Err("Path traversal is not allowed".to_string());
        }
    }

    Ok(canonical)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let canonical = validate_path(&path)?;
    std::fs::read_to_string(&canonical)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let target = Path::new(&path);

    // For new files, validate the parent directory exists
    if target.exists() {
        validate_path(&path)?;
    } else {
        let parent = target.parent()
            .ok_or_else(|| format!("Invalid path '{}': no parent directory", path))?;
        let canonical_parent = std::fs::canonicalize(parent)
            .map_err(|e| format!("Invalid parent directory '{}': {}", parent.display(), e))?;
        for component in canonical_parent.components() {
            if let std::path::Component::ParentDir = component {
                return Err("Path traversal is not allowed".to_string());
            }
        }
    }

    std::fs::write(target, content)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let canonical = validate_path(&path)?;

    if !canonical.is_dir() {
        return Err(format!("'{}' is not a directory", path));
    }

    let mut entries = Vec::new();
    let dir = std::fs::read_dir(&canonical)
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

    for entry in dir {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn search_files(directory: String, pattern: String) -> Result<Vec<String>, String> {
    let canonical = validate_path(&directory)?;

    if !canonical.is_dir() {
        return Err(format!("'{}' is not a directory", directory));
    }

    let pattern_lower = pattern.to_lowercase();
    let mut results = Vec::new();
    search_recursive(&canonical, &pattern_lower, &mut results)?;
    Ok(results)
}

fn search_recursive(dir: &Path, pattern: &str, results: &mut Vec<String>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory '{}': {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();

        if file_name.to_lowercase().contains(pattern) {
            results.push(path.to_string_lossy().to_string());
        }

        if let Ok(metadata) = entry.metadata() {
            if metadata.is_dir() {
                search_recursive(&path, pattern, results)?;
            }
        }
    }

    Ok(())
}
