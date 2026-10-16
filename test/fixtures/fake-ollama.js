/* Falošná Ollama na testy: počúva na OLLAMA_HOST, zapisuje posledné požiadavky do súboru. */
const http = require('http');
const fs = require('fs');
const host = String(process.env.OLLAMA_HOST || '127.0.0.1:11434').replace(/^https?:\/\//, '');
const [h, port] = host.split(':');
const logFile = process.env.FAKE_OLLAMA_LOG;
const log = (o) => { if (logFile) fs.appendFileSync(logFile, JSON.stringify(o) + '\n'); };
const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    log({ url: req.url, body: j });
    if (req.url === '/api/version') return res.end(JSON.stringify({ version: '0.40.4' }));
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'gemma4:12b-it-qat', size: 7.2e9, details: { family: 'gemma4', parameter_size: '12B' } }, { name: 'nothink:latest', size: 1e9 }] }));
    if (req.url === '/api/ps') return res.end(JSON.stringify({ models: [] }));
    if (req.url === '/api/show') return res.end(JSON.stringify({ capabilities: (j.model || j.name) === 'nothink:latest' ? ['completion'] : ['completion', 'thinking'] }));
    if (req.url === '/api/chat') {
      if ('think' in j && j.model === 'strict:latest') { res.statusCode = 400; return res.end(JSON.stringify({ error: '"strict" does not support thinking' })); }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      if (j.think) res.write(JSON.stringify({ message: { thinking: 'hmm…' } }) + '\n');
      res.write(JSON.stringify({ message: { content: 'Ahoj' } }) + '\n');
      res.end(JSON.stringify({ message: { content: ' kamoš' }, done: true }) + '\n');
      return;
    }
    if (req.url === '/api/pull') {
      if ((j.model || j.name) === 'neexistuje:1b') { res.statusCode = 500; return res.end(JSON.stringify({ error: 'pull model manifest: file does not exist' })); }
      res.writeHead(200);
      res.write(JSON.stringify({ status: 'pulling abc', total: 10, completed: 5 }) + '\n');
      res.end(JSON.stringify({ status: 'success' }) + '\n');
      return;
    }
    if (req.url === '/shutdown') { res.end('{}'); setTimeout(() => process.exit(0), 20); return; }
    res.statusCode = 404; res.end('{}');
  });
});
srv.listen(Number(port), h);
