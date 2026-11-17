#!/usr/bin/env node

import readline from 'readline';
import { execSync } from 'child_process';

function askHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.openStdin();
    process.stdin.on('data', (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.pause();
          break;
        default:
          process.stdout.clearLine(0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(query + '*'.repeat(rl.line.length));
          break;
      }
    });

    rl.question(query, (value) => {
      rl.history = rl.history.slice(1);
      rl.close();
      resolve(value);
    });
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
  console.log('  IT Asset Management System - Secure Super Admin Provisioning   ');
  console.log('================================================================');
  console.log('Note: This command runs locally on your machine and communicates');
  console.log('directly with your Supabase project. Zero credentials are logged.\n');

  const email = await ask('Enter Super Admin Email: ');
  if (!email || !email.includes('@')) {
    console.error('Invalid email address.');
    process.exit(1);
  }

  const name = await ask('Enter Admin Full Name (e.g. IT Administrator): ');

  console.log('\nOptions to create/promote user:');
  console.log('1. If you created the user in Supabase Dashboard (Auth -> Users):');
  console.log('   We will promote that email to SUPER_ADMIN with full multi-company access.');
  console.log('2. Auto-provision via SQL trigger:');
  console.log('   Creating any user in Supabase Dashboard will automatically set role=SUPER_ADMIN');
  console.log('   if it is the first account in the system.\n');

  const sql = `
    do $$
    declare
      v_uid uuid;
    begin
      select id into v_uid from auth.users where email = '${email.replace(/'/g, "''")}';
      if v_uid is null then
        raise notice 'User % not found in auth.users yet. Please create it under Authentication -> Users in the Supabase Dashboard.', '${email.replace(/'/g, "''")}';
      else
        insert into public.user_profiles (id, email, name, role, all_companies, allowed_companies)
        values (v_uid, '${email.replace(/'/g, "''")}', '${(name || 'Super Admin').replace(/'/g, "''")}', 'SUPER_ADMIN', true, '{}')
        on conflict (id) do update
        set
          role = 'SUPER_ADMIN',
          all_companies = true,
          name = excluded.name;
        raise notice 'Successfully promoted % to SUPER_ADMIN with access across all entities (GMD, GMC, TEL, RCI).', '${email.replace(/'/g, "''")}';
      end if;
    end $$;
  `;

  try {
    const res = execSync(`supabase db query --remote --yes "${sql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    console.log(res);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main().catch(console.error);

