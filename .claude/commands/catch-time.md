---
name: catch-time
description: Show an inline clock widget with system time
---
Return the following HTML fragment directly in your response (not as a code block — raw HTML so the Companion renders it inline):

<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, monospace; background: #0d1117; display: flex; align-items: center; justify-content: center; height: 100vh; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px 32px; text-align: center; }
  #out { font-size: 42px; font-weight: 800; color: #58a6ff; min-height: 50px; }
  #sub { font-size: 13px; color: #8b949e; margin-top: 6px; min-height: 20px; }
  button { margin-top: 16px; background: #238636; color: white; border: none; padding: 10px 28px; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 600; }
  button:hover { background: #2ea043; }
</style>
</head>
<body>
<div class="card">
  <div id="out">?</div>
  <div id="sub">tap to catch the time</div>
  <button onclick="go()">Catch!</button>
</div>
<script>
async function go() {
  if (!window.vibe) { document.getElementById('out').textContent = 'need YOLO'; return; }
  var r = await vibe.command('date "+%H:%M:%S"');
  document.getElementById('out').textContent = r.success ? r.output.trim() : 'err';
  var d = await vibe.command('date "+%A %d %B"');
  if (d.success) document.getElementById('sub').textContent = d.output.trim();
}
</script>
</body>
</html>
