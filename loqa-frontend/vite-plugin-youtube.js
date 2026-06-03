// Vite plugin: YouTube API proxy
// Adds server middlewares for YouTube search, trending, suggestions, and related videos.
// All use YouTube's InnerTube API (open source, no keys needed).

const INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CLIENT_CONTEXT = {
  client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "en", gl: "US" }
};

function parseVideoRenderers(contents) {
  const items = [];
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (obj.videoRenderer && obj.videoRenderer.videoId) {
      const v = obj.videoRenderer;
      const durParts = (v.lengthText?.simpleText || "0:00").split(":").map(Number);
      let dur = 0;
      if (durParts.length === 3) dur = durParts[0] * 3600 + durParts[1] * 60 + durParts[2];
      else if (durParts.length === 2) dur = durParts[0] * 60 + durParts[1];
      if (dur < 10) return; // skip very short clips
      items.push({
        id: v.videoId,
        title: v.title?.runs?.map(r => r.text).join("") || "Unknown",
        artist: v.ownerText?.runs?.map(r => r.text).join("") || "Unknown",
        album: "YouTube",
        artistId: v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "",
        albumId: "yt",
        dur,
        ci: items.length % 8,
        ai: items.length,
        thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "",
        views: v.viewCountText?.simpleText || "",
      });
      return;
    }
    if (obj.compactVideoRenderer && obj.compactVideoRenderer.videoId) {
      const v = obj.compactVideoRenderer;
      const durParts = (v.lengthText?.simpleText || "0:00").split(":").map(Number);
      let dur = 0;
      if (durParts.length === 3) dur = durParts[0] * 3600 + durParts[1] * 60 + durParts[2];
      else if (durParts.length === 2) dur = durParts[0] * 60 + durParts[1];
      if (dur < 10) return;
      items.push({
        id: v.videoId,
        title: v.title?.simpleText || v.title?.runs?.map(r => r.text).join("") || "Unknown",
        artist: v.longBylineText?.runs?.map(r => r.text).join("") || v.shortBylineText?.runs?.map(r => r.text).join("") || "Unknown",
        album: "YouTube",
        artistId: "", albumId: "yt",
        dur, ci: items.length % 8, ai: items.length,
        thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "",
      });
      return;
    }
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) obj[key].forEach(walk);
      else if (typeof obj[key] === "object") walk(obj[key]);
    }
  }
  walk(contents);
  return items;
}

async function innerTubePost(endpoint, body) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`InnerTube ${endpoint} failed: ${res.status}`);
  return res.json();
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

export default function youtubeSearchPlugin() {
  return {
    name: "youtube-api-proxy",
    configureServer(server) {

      // ── Search ──────────────────────────────────────────────
      server.middlewares.use("/api/youtube/search", async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const query = url.searchParams.get("q");
        if (!query) return jsonResponse(res, 400, { error: "Missing ?q=" });
        try {
          const data = await innerTubePost("search", {
            context: CLIENT_CONTEXT, query,
            params: "EgWKAQIIAWoMEAMQBBAJEAoQBRAW",
          });
          jsonResponse(res, 200, { items: parseVideoRenderers(data.contents) });
        } catch (err) { jsonResponse(res, 500, { error: err.message }); }
      });

      // ── Trending / Charts ──────────────────────────────────
      server.middlewares.use("/api/youtube/trending", async (_req, res) => {
        try {
          const data = await innerTubePost("browse", {
            context: CLIENT_CONTEXT,
            browseId: "FEtrending",
            params: "6gQJRkVleHBsb3Jl", // Music tab
          });
          const items = parseVideoRenderers(data);
          jsonResponse(res, 200, { items: items.slice(0, 30) });
        } catch (err) { jsonResponse(res, 500, { error: err.message }); }
      });

      // ── Related / Recommendations (based on a video) ───────
      server.middlewares.use("/api/youtube/related", async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const videoId = url.searchParams.get("v");
        if (!videoId) return jsonResponse(res, 400, { error: "Missing ?v=" });
        try {
          const data = await innerTubePost("next", {
            context: CLIENT_CONTEXT, videoId,
          });
          const items = parseVideoRenderers(data);
          jsonResponse(res, 200, { items: items.slice(0, 20) });
        } catch (err) { jsonResponse(res, 500, { error: err.message }); }
      });

      // ── Search Suggestions / Autocomplete ──────────────────
      server.middlewares.use("/api/youtube/suggestions", async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const query = url.searchParams.get("q");
        if (!query) return jsonResponse(res, 200, { suggestions: [] });
        try {
          const ytRes = await fetch(
            `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`,
            { headers: { "User-Agent": "Mozilla/5.0" } }
          );
          const text = await ytRes.text();
          // Response is JSONP: window.google.ac.h([...])
          const match = text.match(/\[.+\]/s);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const suggestions = (parsed[1] || []).map(s => s[0]).filter(Boolean).slice(0, 10);
            jsonResponse(res, 200, { suggestions });
          } else {
            jsonResponse(res, 200, { suggestions: [] });
          }
        } catch { jsonResponse(res, 200, { suggestions: [] }); }
      });

      // ── Curated genre search ───────────────────────────────
      server.middlewares.use("/api/youtube/genre", async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const genre = url.searchParams.get("g") || "pop hits";
        try {
          const data = await innerTubePost("search", {
            context: CLIENT_CONTEXT,
            query: `${genre} songs 2024`,
            params: "EgWKAQIIAWoMEAMQBBAJEAoQBRAW",
          });
          jsonResponse(res, 200, { items: parseVideoRenderers(data.contents).slice(0, 12) });
        } catch (err) { jsonResponse(res, 500, { error: err.message }); }
      });
    },
  };
}
