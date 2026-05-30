use crate::error::LauncherError;
use scraper::{Html, Selector};
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashSet;

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), LauncherError> {
    let url_lower = url.to_lowercase();
    if !url_lower.starts_with("http://") && !url_lower.starts_with("https://") {
        return Err(LauncherError::SecurityValidation("Only http/https URLs are allowed".into()));
    }
    webbrowser::open(&url).map_err(|e| LauncherError::Other(format!("opening URL {}: {}", url, e)))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftNewsEntry {
    pub title: String,
    pub category: String,
    pub date: String,
    pub text: String,
    #[serde(rename = "readMoreLink")]
    pub read_more_link: String,
    pub id: String,
    pub image_url: Option<String>,
    pub tag: Option<String>,
    #[serde(rename = "newsType")]
    pub news_type: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct NewsApiResponse {
    entries: Vec<NewsApiEntry>,
}

#[derive(Debug, Deserialize)]
struct NewsApiEntry {
    title: String,
    category: String,
    date: String,
    text: String,
    #[serde(rename = "readMoreLink")]
    read_more_link: String,
    id: String,
    #[serde(rename = "newsPageImage")]
    news_page_image: Option<NewsApiImage>,
    tag: Option<String>,
    #[serde(rename = "newsType")]
    news_type: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct NewsApiImage {
    url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticleImage {
    pub url: String,
    pub caption: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ArticleSection {
    pub heading: Option<String>,
    pub paragraphs: Vec<String>,
    pub images: Vec<ArticleImage>,
    pub list_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftArticle {
    pub title: String,
    pub subtitle: Option<String>,
    pub author: Option<String>,
    pub date: Option<String>,
    pub header_image: Option<String>,
    pub sections: Vec<ArticleSection>,
}

fn extract_text_from_html(html: &str) -> String {
    let document = Html::parse_document(html);
    let body_selector = Selector::parse("body").unwrap_or_else(|_| Selector::parse("*").unwrap());
    document
        .select(&body_selector)
        .next()
        .map(|el| el.text().collect::<Vec<_>>().join(""))
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn extract_images_from_html(html: &str, base_url: &str) -> Vec<ArticleImage> {
    let document = Html::parse_document(html);
    let img_selector = Selector::parse("img").unwrap();
    document
        .select(&img_selector)
        .filter_map(|img| {
            let src = img.value().attr("src")?;
            let url = normalize_url(src, base_url);
            let caption = img
                .value()
                .attr("alt")
                .filter(|a| !a.is_empty())
                .map(|a| a.to_string());
            Some(ArticleImage { url, caption })
        })
        .collect()
}

fn normalize_url(src: &str, base_url: &str) -> String {
    if src.starts_with("http://") || src.starts_with("https://") {
        src.to_string()
    } else if src.starts_with("//") {
        format!("https:{}", src)
    } else if !base_url.is_empty() {
        format!(
            "{}/{}",
            base_url.trim_end_matches('/'),
            src.trim_start_matches('/')
        )
    } else {
        src.to_string()
    }
}

#[tauri::command]
pub async fn get_minecraft_news() -> Result<Vec<MinecraftNewsEntry>, LauncherError> {
    let client = crate::http_client::build_client();
    let resp = client
        .get("https://launchercontent.mojang.com/news.json")
        .send()
        .await?;

    let api_data: NewsApiResponse = resp.json().await?;

    let entries = api_data
        .entries
        .into_iter()
        .take(10)
        .map(|entry| {
            let image_url = entry.news_page_image.and_then(|img| {
                if img.url.is_empty() {
                    None
                } else if img.url.starts_with("http://") || img.url.starts_with("https://") {
                    Some(img.url)
                } else if img.url.starts_with("//") {
                    Some(format!("https:{}", img.url))
                } else {
                    Some(format!("https://launchercontent.mojang.com{}", img.url))
                }
            });
            MinecraftNewsEntry {
                title: entry.title,
                category: entry.category,
                date: entry.date,
                text: entry.text,
                read_more_link: entry.read_more_link,
                id: entry.id,
                image_url,
                tag: entry.tag,
                news_type: entry.news_type,
            }
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub async fn get_minecraft_article(url: String) -> Result<MinecraftArticle, LauncherError> {
    let client = crate::http_client::build_client();
    let resp = client.get(&url).send().await?;
    let html = resp.text().await?;

    let document = Html::parse_document(&html);
    let base_url = "https://www.minecraft.net";

    let title = {
        let h1_sel = Selector::parse("h1").unwrap();
        let title_sel = Selector::parse("title").unwrap();
        document
            .select(&h1_sel)
            .next()
            .or_else(|| document.select(&title_sel).next())
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
            .unwrap_or_else(|| "Untitled Article".to_string())
    };

    let subtitle = {
        let h2_sel = Selector::parse("h2").unwrap();
        document
            .select(&h2_sel)
            .next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
            .filter(|t| *t != title)
    };

    let author = {
        let lower = html.to_lowercase();
        let mut found = None;
        for marker in &["written by", "writtenby", "author"] {
            if let Some(pos) = lower.find(marker) {
                let after = &html[pos + marker.len()..];
                let text = extract_text_from_html(after);
                let name = text
                    .split(['\n', '|'])
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !name.is_empty() && name.len() < 100 {
                    found = Some(name);
                    break;
                }
            }
        }
        found
    };

    let date = {
        let lower = html.to_lowercase();
        let mut found = None;
        for marker in &["published", "posted"] {
            if let Some(pos) = lower.find(marker) {
                let after = &html[pos + marker.len()..];
                let text = extract_text_from_html(after);
                let date_str = text
                    .split(['\n', '|'])
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !date_str.is_empty() && date_str.len() < 100 {
                    found = Some(date_str);
                    break;
                }
            }
        }
        found
    };

    let header_image = {
        let hero_sel =
            Selector::parse(".article-hero img, .hero-image img, .article-header img").unwrap();
        let body_img_sel = Selector::parse("body img").unwrap();
        document
            .select(&hero_sel)
            .next()
            .or_else(|| document.select(&body_img_sel).next())
            .and_then(|img| img.value().attr("src").map(|s| normalize_url(s, base_url)))
    };

    let article_sel = Selector::parse("article, .article, .post, .content").unwrap();
    let content_el = document.select(&article_sel).next();

    let content_selector = Selector::parse("h2, h3, p, img, figure, ul, ol").unwrap();
    let elements: Vec<_> = if let Some(el) = content_el {
        el.select(&content_selector).collect()
    } else {
        let body_sel = Selector::parse("body").unwrap();
        document
            .select(&body_sel)
            .next()
            .map(|body| body.select(&content_selector).collect())
            .unwrap_or_else(|| document.select(&content_selector).collect())
    };

    let mut sections: Vec<ArticleSection> = Vec::new();
    let mut current_section = ArticleSection {
        heading: None,
        paragraphs: Vec::new(),
        images: Vec::new(),
        list_items: Vec::new(),
    };
    let mut seen_image_urls: HashSet<String> = HashSet::new();

    for el in elements {
        match el.value().name() {
            "h2" | "h3" => {
                if !current_section.paragraphs.is_empty()
                    || !current_section.images.is_empty()
                    || !current_section.list_items.is_empty()
                    || current_section.heading.is_some()
                {
                    sections.push(std::mem::take(&mut current_section));
                }
                current_section.heading =
                    Some(el.text().collect::<Vec<_>>().join("").trim().to_string());
            }
            "p" => {
                let text = el.text().collect::<Vec<_>>().join("").trim().to_string();
                if !text.is_empty() {
                    current_section.paragraphs.push(text);
                }
            }
            "img" => {
                if let Some(src) = el.value().attr("src") {
                    let url = normalize_url(src, base_url);
                    if seen_image_urls.insert(url.clone()) {
                        current_section.images.push(ArticleImage {
                            url,
                            caption: el
                                .value()
                                .attr("alt")
                                .filter(|a| !a.is_empty())
                                .map(|a| a.to_string()),
                        });
                    }
                }
            }
            "figure" => {
                let img_sel = Selector::parse("img").unwrap();
                if let Some(img) = el.select(&img_sel).next() {
                    if let Some(src) = img.value().attr("src") {
                        let url = normalize_url(src, base_url);
                        if seen_image_urls.insert(url.clone()) {
                            let caption = {
                                let cap_sel = Selector::parse("figcaption, span").unwrap();
                                el.select(&cap_sel)
                                    .next()
                                    .map(|cap| {
                                        cap.text().collect::<Vec<_>>().join("").trim().to_string()
                                    })
                                    .filter(|t| !t.is_empty())
                            };
                            current_section.images.push(ArticleImage { url, caption });
                        }
                    }
                }
            }
            "ul" | "ol" => {
                let li_sel = Selector::parse("li").unwrap();
                for li in el.select(&li_sel) {
                    let text = li.text().collect::<Vec<_>>().join("").trim().to_string();
                    if !text.is_empty() {
                        current_section.list_items.push(text);
                    }
                }
            }
            _ => {}
        }
    }

    if !current_section.paragraphs.is_empty()
        || !current_section.images.is_empty()
        || !current_section.list_items.is_empty()
        || current_section.heading.is_some()
    {
        sections.push(current_section);
    }

    if sections.is_empty() {
        let content_html = content_el.map(|el| el.html()).unwrap_or(html);
        let text = extract_text_from_html(&content_html);
        if !text.is_empty() {
            sections.push(ArticleSection {
                heading: None,
                paragraphs: vec![text],
                images: extract_images_from_html(&content_html, base_url),
                list_items: Vec::new(),
            });
        }
    }

    Ok(MinecraftArticle {
        title,
        subtitle,
        author,
        date,
        header_image,
        sections,
    })
}
