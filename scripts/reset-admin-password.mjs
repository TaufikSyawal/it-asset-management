#!/usr/bin/env node

import readline from 'readline';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

function askHidden(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    const oldMode = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (ch) => {
      ch = ch + '';
      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(oldMode);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit(1);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += ch;
          process.stdout.write('*');
          break;
      }
    };
    stdin.on('data', onData);
  });
}

function ask(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('  IT Asset Management System - Super Admin Password Tool         ');
  console.log('================================================================');
  console.log('This tool sets your password securely directly on Supabase PostgreSQL.');
  console.log('Your password is typed with hidden characters and is never logged.\n');

  const defaultEmail = 'syawalludint@gmail.com';
  const emailInput = await ask(`Enter Super Admin Email [default: ${defaultEmail}]: `);
  const email = (emailInput || defaultEmail).toLowerCase().trim();

  const newPassword = await askHidden('Enter New Password: ');
  if (!newPassword || newPassword.length < 6) {
    console.error('\nError: Password must be at least 6 characters.');
    process.exit(1);
  }

  const confirmPassword = await askHidden('Confirm New Password: ');
  if (newPassword !== confirmPassword) {
    console.error('\nError: Passwords do not match.');
    process.exit(1);
  }

  console.log('\nUpdating password securely on Supabase PostgreSQL...');

  // Escape single quotes in password for SQL string literal
  const escapedPassword = newPassword.replace(/'/g, "''");
  const sql = `
    update auth.users
    set encrypted_password = extensions.crypt('${escapedPassword}', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where lower(email) = '${email.replace(/'/g, "''")}';
  `;

  try {
    execSync(`supabase db query --remote --yes "${sql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    console.log('Password hash updated successfully in auth.users.');

    // Test sign in locally to confirm validity
    const url = 'https://dhwtybzvkhcsqzrtgohn.supabase.co';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRod3R5Ynp2a2hjc3F6cnRnb2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4OTg4NTMsImV4cCI6MjExMDQ3NDg1M30.FvdF1zetZ4g8QauwOySGnTFWKv_LnhEifuM7b3WmBQg';
    const client = createClient(url, anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: newPassword,
    });

    if (error || !data.user) {
      console.error('Verification warning:', error?.message || 'Could not verify login');
    } else {
      console.log(`\n🎉 Verification SUCCESSFUL! User ${data.user.email} authenticated cleanly.`);
      console.log('You can now log in at https://taufiksyawal.github.io/it-asset-management/\n');
    }
  } catch (err) {
    console.error('Database update failed:', err.message);
  }
}

main().catch(console.error);
