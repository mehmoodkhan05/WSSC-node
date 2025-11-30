const { spawnSync } = require('node:child_process');

function runExpoDoctor() {
  const isWindows = process.platform === 'win32';
  const executable = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows ? ['/d', '/s', '/c', 'npx expo-doctor'] : ['expo-doctor'];

  const child = spawnSync(executable, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (child.error) {
    console.warn('[postinstall] Failed to run expo-doctor:', child.error.message);
    return;
  }

  if (child.status !== 0) {
    console.warn('[postinstall] expo-doctor reported issues (exit code', child.status, ')');
  }
}

runExpoDoctor();

