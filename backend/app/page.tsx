export default function Home() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>EduGenie API Backend</h1>
      <p>Backend server is running successfully!</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li><code>POST /api/chat</code> - Send a message to the AI tutor</li>
        <li><code>GET /api/notes</code> - Get all notes</li>
        <li><code>POST /api/notes</code> - Create a note</li>
        <li><code>POST /api/notes/ai-generate</code> - Generate note with AI</li>
        <li><code>POST /api/notes/url-convert</code> - Convert URL to notes</li>
        <li><code>POST /api/notes/youtube-convert</code> - Convert YouTube transcript to notes</li>
      </ul>
    </div>
  );
}
