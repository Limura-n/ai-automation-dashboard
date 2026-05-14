/**
 * Free port 3000 before starting the dev server.
 * Runs automatically via npm's predev hook — zero user interaction needed.
 *
 * This checks if port 3000 is in use and kills the hogging process
 * so `npm run dev` never crashes with EADDRINUSE.
 */
const net = require('net');
const { execSync } = require('child_process');

const PORT = 3000;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '0.0.0.0');
  });
}

async function main() {
  const inUse = await isPortInUse(PORT);
  if (!inUse) {
    console.log(`\n✓ Port ${PORT} is free — starting dev server...\n`);
    return;
  }

  console.log(`\n⚠ Port ${PORT} is busy — freeing it up...`);

  // Strategy 1: lsof (macOS/Linux)
  try {
    const pid = execSync(`lsof -ti:${PORT}`, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (pid) {
      execSync(`kill -9 ${pid}`, { timeout: 5000 });
      // Give the OS a moment to release the port
      await new Promise((r) => setTimeout(r, 1000));
      console.log(`✓ Freed port ${PORT} (killed old process PID ${pid})\n`);
      return;
    }
  } catch {
    // lsof not available or failed — try next strategy
  }

  // Strategy 2: fuser (Linux)
  try {
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null`, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`✓ Freed port ${PORT}\n`);
    return;
  } catch {
    // fuser not available either
  }

  console.error(
    `✗ Could not free port ${PORT}.\n` +
    `  Close the application using it manually, then run npm run dev again.`
  );
  process.exit(1);
}

main();
