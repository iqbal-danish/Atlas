use std::fs;
use std::io::Read;
use std::path::Path;
use crate::models::FilePreview;

pub fn generate_preview(path_str: &str, max_bytes: usize) -> Result<FilePreview, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }

    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();

    let ext = path
        .extension()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Check images
    let image_extensions = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"];
    if image_extensions.contains(&ext.as_str()) {
        return Ok(FilePreview {
            path: path_str.to_string(),
            mime_type: format!("image/{}", if ext == "svg" { "svg+xml" } else { &ext }),
            preview_type: "image".to_string(),
            content: None,
            size: file_size,
            line_count: None,
            is_truncated: false,
        });
    }

    // Check PDF
    if ext == "pdf" {
        let max_pdf_bytes = 30 * 1024 * 1024; // 30 MB
        let (content, is_truncated) = if file_size <= max_pdf_bytes {
            match fs::read(path) {
                Ok(bytes) => {
                    use base64::Engine;
                    (Some(base64::engine::general_purpose::STANDARD.encode(&bytes)), false)
                }
                Err(_) => (None, false),
            }
        } else {
            (None, true)
        };

        return Ok(FilePreview {
            path: path_str.to_string(),
            mime_type: "application/pdf".to_string(),
            preview_type: "pdf".to_string(),
            content,
            size: file_size,
            line_count: None,
            is_truncated,
        });
    }

    // Check Word DOCX
    if ext == "docx" {
        if let Ok(file) = fs::File::open(path) {
            let reader = std::io::BufReader::new(file);
            if let Ok(mut zip) = zip::ZipArchive::new(reader) {
                if let Ok(mut doc_xml) = zip.by_name("word/document.xml") {
                    let mut xml_str = String::new();
                    if doc_xml.read_to_string(&mut xml_str).is_ok() {
                        let text = extract_xml_text(&xml_str);
                        let line_count = text.lines().count();
                        return Ok(FilePreview {
                            path: path_str.to_string(),
                            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
                            preview_type: "docx".to_string(),
                            content: Some(text),
                            size: file_size,
                            line_count: Some(line_count),
                            is_truncated: false,
                        });
                    }
                }
            }
        }
    }

    // Check PowerPoint PPTX
    if ext == "pptx" {
        if let Ok(file) = fs::File::open(path) {
            let reader = std::io::BufReader::new(file);
            if let Ok(mut zip) = zip::ZipArchive::new(reader) {
                let mut slide_texts = Vec::new();
                let mut slide_idx = 1;
                while let Ok(mut slide) = zip.by_name(&format!("ppt/slides/slide{}.xml", slide_idx)) {
                    let mut xml_str = String::new();
                    if slide.read_to_string(&mut xml_str).is_ok() {
                        let text = extract_xml_text(&xml_str);
                        if !text.trim().is_empty() {
                            slide_texts.push(format!("[Slide {}]\n{}", slide_idx, text.trim()));
                        }
                    }
                    slide_idx += 1;
                }
                if !slide_texts.is_empty() {
                    let full_text = slide_texts.join("\n\n---\n\n");
                    return Ok(FilePreview {
                        path: path_str.to_string(),
                        mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation".to_string(),
                        preview_type: "pptx".to_string(),
                        content: Some(full_text),
                        size: file_size,
                        line_count: Some(slide_texts.len()),
                        is_truncated: false,
                    });
                }
            }
        }
    }

    // Check Excel XLSX
    if ext == "xlsx" {
        if let Some(csv_content) = parse_xlsx_to_csv(path) {
            let line_count = csv_content.lines().count();
            return Ok(FilePreview {
                path: path_str.to_string(),
                mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
                preview_type: "csv".to_string(),
                content: Some(csv_content),
                size: file_size,
                line_count: Some(line_count),
                is_truncated: false,
            });
        }
    }

    // Check text/code/json/csv
    let text_extensions = [
        "txt", "md", "rs", "ts", "tsx", "js", "jsx", "json", "toml", "yaml", "yml", "html",
        "css", "scss", "py", "sh", "bat", "ps1", "c", "cpp", "h", "hpp", "sql", "xml", "csv", "tsv",
        "log", "ini", "env", "gitignore", "cargo.lock",
    ];

    let is_text = text_extensions.contains(&ext.as_str()) || file_size < 1024 * 1024;

    if is_text {
        let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
        let read_limit = std::cmp::min(file_size as usize, max_bytes);
        let mut buffer = vec![0u8; read_limit];
        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        buffer.truncate(bytes_read);

        // Check if content is valid UTF-8
        if let Ok(text) = String::from_utf8(buffer) {
            let line_count = text.lines().count();
            let preview_type = if ext == "json" {
                "json"
            } else if ["csv", "tsv"].contains(&ext.as_str()) {
                "csv"
            } else if ["rs", "ts", "tsx", "js", "jsx", "py", "html", "css", "sql"].contains(&ext.as_str()) {
                "code"
            } else {
                "text"
            };

            return Ok(FilePreview {
                path: path_str.to_string(),
                mime_type: "text/plain".to_string(),
                preview_type: preview_type.to_string(),
                content: Some(text),
                size: file_size,
                line_count: Some(line_count),
                is_truncated: file_size > read_limit as u64,
            });
        }
    }

    // Binary / Other
    Ok(FilePreview {
        path: path_str.to_string(),
        mime_type: "application/octet-stream".to_string(),
        preview_type: "binary".to_string(),
        content: None,
        size: file_size,
        line_count: None,
        is_truncated: false,
    })
}

fn parse_xlsx_to_csv(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let reader = std::io::BufReader::new(file);
    let mut zip = zip::ZipArchive::new(reader).ok()?;

    // 1. Extract shared strings if present
    let mut shared_strings = Vec::new();
    if let Ok(mut ss_entry) = zip.by_name("xl/sharedStrings.xml") {
        let mut ss_xml = String::new();
        if ss_entry.read_to_string(&mut ss_xml).is_ok() {
            shared_strings = extract_shared_strings(&ss_xml);
        }
    }

    // 2. Collect worksheet entry names
    let mut sheet_names = Vec::new();
    for i in 0..zip.len() {
        if let Ok(file) = zip.by_index(i) {
            let name = file.name();
            if name.starts_with("xl/worksheets/sheet") && name.ends_with(".xml") {
                sheet_names.push(name.to_string());
            }
        }
    }

    sheet_names.sort();
    if sheet_names.is_empty() {
        return None;
    }

    let mut combined_sheets = Vec::new();
    for (idx, sheet_name) in sheet_names.iter().take(8).enumerate() {
        if let Ok(mut s) = zip.by_name(sheet_name) {
            let mut sheet_xml = String::new();
            if s.read_to_string(&mut sheet_xml).is_ok() {
                if let Some(csv) = extract_sheet_rows_as_csv(&sheet_xml, &shared_strings) {
                    let display_name = format!("Sheet {}", idx + 1);
                    combined_sheets.push(format!("---SHEET:{}---\n{}", display_name, csv));
                }
            }
        }
    }

    if combined_sheets.is_empty() {
        None
    } else {
        Some(combined_sheets.join("\n\n"))
    }
}

fn extract_shared_strings(xml: &str) -> Vec<String> {
    let mut strings = Vec::new();
    for si_part in xml.split("<si>") {
        if !si_part.contains("</si>") {
            continue;
        }
        let si_content = si_part.split("</si>").next().unwrap_or("");
        let mut entry = String::new();
        let mut cur = si_content;
        while let Some(start_t) = cur.find("<t") {
            let after_start = &cur[start_t..];
            if let Some(close_tag) = after_start.find('>') {
                let text_start = &after_start[close_tag + 1..];
                if let Some(end_t) = text_start.find("</t>") {
                    let val = &text_start[..end_t];
                    entry.push_str(&html_escape_decode(val));
                    cur = &text_start[end_t + 4..];
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        strings.push(entry);
    }
    strings
}

fn extract_sheet_rows_as_csv(xml: &str, shared_strings: &[String]) -> Option<String> {
    let mut csv_lines = Vec::new();

    // Iterate through <row ...>...</row>
    for row_part in xml.split("<row") {
        if !row_part.contains("</row>") {
            continue;
        }
        let row_content = row_part.split("</row>").next().unwrap_or("");

        let mut row_cells: Vec<String> = Vec::new();
        for cell_part in row_content.split("<c") {
            if !cell_part.contains("</c>") && !cell_part.contains("/>") {
                continue;
            }
            let is_shared = cell_part.contains("t=\"s\"");
            let is_inline = cell_part.contains("t=\"inlineStr\"");

            let mut cell_value = String::new();
            if is_inline {
                if let Some(t_start) = cell_part.find("<t>") {
                    let after = &cell_part[t_start + 3..];
                    if let Some(t_end) = after.find("</t>") {
                        cell_value = html_escape_decode(&after[..t_end]);
                    }
                }
            } else if let Some(v_start) = cell_part.find("<v>") {
                let after = &cell_part[v_start + 3..];
                if let Some(v_end) = after.find("</v>") {
                    let raw_v = &after[..v_end];
                    if is_shared {
                        if let Ok(idx) = raw_v.parse::<usize>() {
                            if let Some(s) = shared_strings.get(idx) {
                                cell_value = s.clone();
                            }
                        }
                    } else {
                        cell_value = html_escape_decode(raw_v);
                    }
                }
            }

            // CSV escaping
            let escaped = if cell_value.contains(',') || cell_value.contains('"') || cell_value.contains('\n') {
                format!("\"{}\"", cell_value.replace('"', "\"\""))
            } else {
                cell_value
            };
            row_cells.push(escaped);
        }

        if !row_cells.is_empty() {
            csv_lines.push(row_cells.join(","));
        }

        if csv_lines.len() >= 600 {
            break;
        }
    }

    if csv_lines.is_empty() {
        None
    } else {
        Some(csv_lines.join("\n"))
    }
}

fn html_escape_decode(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

fn extract_xml_text(xml: &str) -> String {
    let mut in_tag = false;
    let mut result = String::with_capacity(xml.len() / 2);
    let mut prev_was_space = false;

    // Convert paragraph closing tags to newlines
    let normalized = xml.replace("</w:p>", "\n").replace("</a:p>", "\n");

    for ch in normalized.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            if ch == '\n' {
                result.push('\n');
                prev_was_space = true;
            } else if ch.is_whitespace() {
                if !prev_was_space {
                    result.push(' ');
                    prev_was_space = true;
                }
            } else {
                result.push(ch);
                prev_was_space = false;
            }
        }
    }
    result.trim().to_string()
}
