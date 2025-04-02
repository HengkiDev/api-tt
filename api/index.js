const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Set header untuk CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Jika method OPTIONS, hanya kembalikan header dan status 200
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }

  // Dapatkan URL dari query parameter
  const tiktokUrl = req.query.url;

  // Validasi URL
  if (!tiktokUrl) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL parameter diperlukan"
    });
  }

  try {
    // Validasi format URL TikTok
    if (!tiktokUrl.match(/^https?:\/\/(www\.|vm\.)?tiktok\.com/)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "URL tidak valid. Harap berikan URL TikTok yang valid"
      });
    }

    // Langkah 1: Dapatkan halaman TikTok untuk mendapatkan ID video
    const response = await axios.get(tiktokUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Gunakan Cheerio untuk mengekstrak ID video atau informasi lainnya
    const $ = cheerio.load(response.data);
    
    // Metode ekstraksi - cari tag meta untuk ID video & informasi lainnya
    const videoId = $('meta[property="og:url"]').attr('content')?.split('/').pop() || '';
    const videoTitle = $('meta[property="og:title"]').attr('content') || '';
    const thumbnailUrl = $('meta[property="og:image"]').attr('content') || '';
    const authorName = $('meta[property="og:author"]').attr('content') || '';
    
    // Untuk mendapatkan URL video, kita perlu ekstrak dari skrip pada halaman
    // Ini adalah salah satu pendekatan: ekstrak dari tag script yang memiliki data video
    let videoUrl = '';
    let musicUrl = '';
    
    // Cari dalam tag script untuk menemukan URL video tanpa watermark
    const scripts = $('script').filter(function() {
      return $(this).text().includes('videoData');
    });
    
    // Coba ekstrak URL video & musik dari skrip yang ditemukan
    if (scripts.length > 0) {
      const scriptContent = scripts.first().html();
      try {
        // Coba ekstrak URL video dengan regex
        const videoRegex = /"playAddr":"([^"]+)"/;
        const musicRegex = /"musicUrl":"([^"]+)"/;
        
        const videoMatch = scriptContent.match(videoRegex);
        const musicMatch = scriptContent.match(musicRegex);
        
        if (videoMatch && videoMatch[1]) {
          videoUrl = videoMatch[1].replace(/\\u002F/g, '/');
        }
        
        if (musicMatch && musicMatch[1]) {
          musicUrl = musicMatch[1].replace(/\\u002F/g, '/');
        }
      } catch (err) {
        console.error("Error parsing script content:", err);
      }
    }
    
    // Jika tidak dapat menemukan URL video, gunakan API alternatif
    if (!videoUrl) {
      // Menggunakan API alternatif untuk mendapatkan URL video
      const apiResponse = await axios.get(`https://www.tikwm.com/api/?url=${tiktokUrl}`);
      
      if (apiResponse.data.data) {
        videoUrl = apiResponse.data.data.play;
        musicUrl = apiResponse.data.data.music;
      }
    }

    // Jika masih tidak dapat menemukan URL video
    if (!videoUrl) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Tidak dapat menemukan URL video"
      });
    }

    // Mengembalikan hasil
    return res.status(200).json({
      status: true,
      code: 200,
      author: {
        name: authorName
      },
      data: {
        id: videoId,
        title: videoTitle,
        thumbnail: thumbnailUrl,
        video: videoUrl,
        music: musicUrl,
        source: "TikTok"
      }
    });

  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({
      status: false,
      code: 500,
      message: "Terjadi kesalahan saat memproses permintaan",
      error: error.message
    });
  }
};
