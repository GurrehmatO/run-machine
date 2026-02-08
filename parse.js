const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Configuration: Add your source URLs here
const SOURCES = [
    { name: 'Prime Eng', url: 'https://cricketstan.github.io/Allrounder-/prame' },
    { name: 'Star 2 Hindi', url: 'https://allrounderlive.pages.dev/channel/star-sports-2-hindi' },
    { name: 'Star 2 HD', url: 'https://cricketstan.github.io/Channel-14/'},
    { name: 'Willow', url: 'https://allrounderlive.pages.dev/willow'}

];

const OUTPUT_DIR = path.join(__dirname, 'docs');

async function fetchAndParse() {
    try {
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
                        headers: headerString
                    });
                } else {
                    console.warn(`Could not find stream URL for ${source.name}`);
                }
            } catch (err) {
                console.error(`Failed to fetch ${source.name}:`, err.message);
            }
        }

        // Generate M3U files
        // 1. One master file with all channels
        if (results.length > 0) {
            fs.writeFileSync(path.join(OUTPUT_DIR, 'all_channels.m3u'), createM3U(results));
            console.log('Generated: all_channels.m3u');

            // 2. Individual files for each channel/path (as requested: 5-10 small files)
            results.forEach(item => {
                const fileName = `${item.name.toLowerCase().replace(/\s+/g, '_')}.m3u`;
                fs.writeFileSync(path.join(OUTPUT_DIR, fileName), createM3U([item]));
                console.log(`Generated: ${fileName}`);
            });
        }

        console.log('Successfully updated M3U files.');

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

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

fetchAndParse();
