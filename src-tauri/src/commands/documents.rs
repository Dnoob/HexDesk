use serde::Deserialize;
use std::fs::File;
use std::path::Path;

#[derive(Deserialize)]
pub struct ExcelData {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[tauri::command]
pub fn generate_word(path: String, title: String, content: String) -> Result<(), String> {
    use docx_rs::*;

    let mut docx = Docx::new();

    // Title paragraph: large bold text
    let title_run = Run::new().add_text(&title).bold().size(48); // 24pt
    let title_para = Paragraph::new().add_run(title_run);
    docx = docx.add_paragraph(title_para);

    // Empty line after title
    docx = docx.add_paragraph(Paragraph::new());

    // Content: split by newlines into paragraphs
    for line in content.split('\n') {
        let run = Run::new().add_text(line).size(24); // 12pt
        let para = Paragraph::new().add_run(run);
        docx = docx.add_paragraph(para);
    }

    let file = File::create(&path).map_err(|e| format!("Failed to create file: {e}"))?;
    docx.build()
        .pack(file)
        .map_err(|e| format!("Failed to write Word document: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn generate_excel(path: String, data: ExcelData) -> Result<(), String> {
    use rust_xlsxwriter::*;

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Bold format for headers
    let bold = Format::new().set_bold();

    // Write headers
    for (col, header) in data.headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, header, &bold)
            .map_err(|e| format!("Failed to write header: {e}"))?;
    }

    // Write data rows
    for (row_idx, row) in data.rows.iter().enumerate() {
        for (col_idx, cell) in row.iter().enumerate() {
            worksheet
                .write_string((row_idx + 1) as u32, col_idx as u16, cell)
                .map_err(|e| format!("Failed to write cell: {e}"))?;
        }
    }

    workbook
        .save(&path)
        .map_err(|e| format!("Failed to save Excel file: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn generate_pdf(path: String, title: String, content: String) -> Result<(), String> {
    // Try to load a system font, fall back to built-in font
    let font_family = load_font_family().map_err(|e| format!("Failed to load font: {e}"))?;

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title(&title);

    // Title
    let mut title_style = genpdf::style::Style::new();
    title_style.set_bold();
    title_style.set_font_size(18);
    let title_elem =
        genpdf::elements::Paragraph::new(genpdf::style::StyledString::new(title, title_style));
    doc.push(title_elem);

    // Spacing
    doc.push(genpdf::elements::Break::new(1.0));

    // Content paragraphs
    for line in content.split('\n') {
        if line.is_empty() {
            doc.push(genpdf::elements::Break::new(0.5));
        } else {
            let para = genpdf::elements::Paragraph::new(line);
            doc.push(para);
        }
    }

    doc.render_to_file(&path)
        .map_err(|e| format!("Failed to render PDF: {e}"))?;

    Ok(())
}

fn load_font_family() -> Result<genpdf::fonts::FontFamily<genpdf::fonts::FontData>, String> {
    // Try common system font directories for a sans-serif font
    let font_dirs = [
        "/usr/share/fonts/truetype/liberation",
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/TTF",
        "/usr/share/fonts/liberation-sans",
    ];
    let font_names = ["LiberationSans-Regular", "DejaVuSans"];

    for dir in &font_dirs {
        let dir_path = Path::new(dir);
        if !dir_path.exists() {
            continue;
        }
        for font_name in &font_names {
            let regular_path = dir_path.join(format!("{font_name}.ttf"));
            if regular_path.exists() {
                let family = genpdf::fonts::from_files(dir, font_name, None)
                    .map_err(|e| format!("Failed to load font from {dir}: {e}"))?;
                return Ok(family);
            }
        }
    }

    // Fall back: use genpdf's built-in default font (Courier-like)
    // genpdf doesn't have a built-in font, so we need at least one font file.
    // Create a minimal error message guiding the user.
    Err("No suitable font found. Please install liberation-fonts or dejavu-fonts.".to_string())
}
