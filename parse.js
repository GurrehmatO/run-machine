const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const SOURCE_URL = process.env.SOURCE_URL;

if (!SOURCE_URL) {
    console.error('SOURCE_URL environment variable is not defined.');
    process.exit(1);
}

async function getSources() {
    try {
        console.log(`Fetching sources from: ${SOURCE_URL}`);
        const response = await axios.get(SOURCE_URL);
        const data = response.data;
        
        if (!data || !data.iframes || !Array.isArray(data.iframes)) {
            throw new Error('Invalid JSON structure from external source');
        }

        return data.iframes.map(item => ({
            name: item.name,
            url: item.iframeSrc
        }));
    } catch (err) {
        console.error('Error fetching external sources:', err.message);
        return [];
    }
}

const OUTPUT_DIR = path.join(__dirname, 'docs');

async function fetchAndParse() {
    try {
        const SOURCES = await getSources();

        if (SOURCES.length === 0) {
            console.error('No sources found to process.');
            process.exit(1);
        }

        const results = [];

        for (const source of SOURCES) {
            console.log(`Fetching data for ${source.name} from: ${source.url}`);
            try {
                const response = await axios.get(source.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                const html = response.data;
                const $ = cheerio.load(html);
                const scriptContent = $('script').map((i, el) => $(el).html()).get().join('\n');

                // Improved Regex to be tolerant of mid-line breaks and whitespace
                const drmRegex = /let\s+drmConfig\s*=\s*({[\s\S]*?});/m;
                const urlRegex = /let\s+streamUrl\s*=\s*[\s\n]*['"](.*?)['"]/m;
                const cookieRegex = /let\s+cookieHeader\s*=\s*[\s\n]*['"](.*?)['"]/m;
                
                const uaRegex = /request\.headers\['User-Agent'\]\s*=\s*[\s\n]*['"](.*?)['"]/m;
                const refRegex = /request\.headers\['Referer'\]\s*=\s*[\s\n]*['"](.*?)['"]/m;

                const drmMatch = scriptContent.match(drmRegex);
                const urlMatch = scriptContent.match(urlRegex);
                const cookieMatch = scriptContent.match(cookieRegex);
                const uaMatch = scriptContent.match(uaRegex);
                const refMatch = scriptContent.match(refRegex);

                if (urlMatch) {
                    let streamUrl = urlMatch[1];
                    let drmInfo = '';
                    let headers = [];
                    
                    if (drmMatch) {
                        const clearKeyRegex = /"([a-f0-9]{32})"\s*:\s*"([a-f0-9]{32})"/g;
                        let keyMatch;
                        const keys = [];
                        while ((keyMatch = clearKeyRegex.exec(drmMatch[1])) !== null) {
                            keys.push(`${keyMatch[1]}:${keyMatch[2]}`);
                        }
                        if (keys.length > 0) {
                            drmInfo = `#KODIPROP:inputstream.adaptive.license_type=clearkey\n#KODIPROP:inputstream.adaptive.license_key=${keys.join(',')}`;
                        }
                    }

                    // Handle Cookie
                    if (cookieMatch) {
                        const cookie = cookieMatch[1];
                        headers.push(`Cookie=${cookie}`);
                        
                        // Some streams append cookie to URL as well
                        if (!streamUrl.includes('__hdnea=')) {
                            const sep = streamUrl.includes('?') ? '&' : '?';
                            streamUrl += `${sep}${cookie}`;
                        }
                    }

                    // Handle other headers
                    if (uaMatch) headers.push(`User-Agent=${uaMatch[1]}`);
                    if (refMatch) headers.push(`Referer=${refMatch[1]}`);

                    let headerString = headers.length > 0 ? `#KODIPROP:inputstream.adaptive.stream_headers=${headers.join('|')}` : '';

                    results.push({
                        name: source.name,
                        url: streamUrl,
                        drm: drmInfo,
                        headers: headerString,
                        fileName: `${source.name.toLowerCase().replace(/\s+/g, '_')}.m3u`
                    });
                } else {
                    console.warn(`Could not find stream URL for ${source.name}`);
                }
            } catch (err) {
                console.error(`Failed to fetch ${source.name}:`, err.message);
            }
        }

        if (results.length > 0) {
            // Master Playlist
            fs.writeFileSync(path.join(OUTPUT_DIR, 'all_channels.m3u'), createM3U(results));
            
            // Individual Playlists
            results.forEach(item => {
                fs.writeFileSync(path.join(OUTPUT_DIR, item.fileName), createM3U([item]));
            });

            // Landing Page
            fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), createIndexHTML(results));
            
            console.log('Successfully updated M3U and HTML files.');
        }

    } catch (error) {
        console.error('Error during update:', error.message);
        process.exit(1);
    }
}

function createM3U(items) {
    let content = '#EXTM3U\n';
    items.forEach(item => {
        if (item.drm) content += `${item.drm}\n`;
        if (item.headers) content += `${item.headers}\n`;
        content += `#EXTINF:-1,${item.name}\n${item.url}\n`;
    });
    return content;
}

function createIndexHTML(items) {
    const listItems = items.map(item => `
        <li class="item">
            <span class="name">${item.name}</span>
            <div class="actions">
                <button onclick="copyToClipboard('${item.fileName}', this)" class="icon-btn" title="Copy URL">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <a href="${item.fileName}" download class="icon-btn" title="Download">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
            </div>
        </li>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Run-Machine</title>
    <style>
        body {
            background-color: #0f172a;
            color: #f8fafc;
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 2rem;
        }
        h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #38bdf8; }
        ul { list-style: none; padding: 0; }
        .item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid #334155;
        }
        .item:last-child { border-bottom: none; }
        .name { font-weight: 500; }
        .actions { display: flex; gap: 0.75rem; }
        .icon-btn {
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            transition: color 0.2s;
            text-decoration: none;
        }
        .icon-btn:hover { color: #38bdf8; }
        .master { border-bottom: 2px solid #38bdf8; margin-bottom: 1rem; padding-bottom: 1rem; }
        .refresh-btn {
            display: inline-flex;
            align-items: center;
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
            border: 1px solid #38bdf8;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 500;
            transition: background 0.2s;
        }
        .refresh-btn:hover { background: rgba(56, 189, 248, 0.2); }
        .footer { margin-top: 2rem; font-size: 0.75rem; color: #475569; }
    </style>
</head>
<body>
    <h1>Run-Machine Playlists</h1>
    <ul>
        <li class="item master">
            <span class="name"><strong>Master Playlist (All)</strong></span>
            <div class="actions">
                <button onclick="copyToClipboard('all_channels.m3u', this)" class="icon-btn" title="Copy URL">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <a href="all_channels.m3u" download class="icon-btn" title="Download">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
            </div>
        </li>
        ${listItems}
    </ul>
    <div style="margin-top: 2rem; text-align: center;">
        <a href="https://github.com/GurrehmatO/run-machine/actions/workflows/refresh.yml" target="_blank" class="refresh-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l5.64 5.64A9 9 0 0 0 20.49 15"></path></svg>
            Trigger Manual Refresh
        </a>
    </div>
    <div class="footer">Updated: ${new Date().toLocaleString()} UTC</div>
    <script>
        function copyToClipboard(filename, btn) {
            const url = new URL(filename, window.location.href).href;
            navigator.clipboard.writeText(url).then(() => {
                const original = btn.innerHTML;
                btn.innerHTML = '<span style="font-size: 10px; color: #10b981;">COPIED</span>';
                setTimeout(() => btn.innerHTML = original, 1500);
            });
        }
    </script>
</body>
</html>
    `;
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

fetchAndParse();
