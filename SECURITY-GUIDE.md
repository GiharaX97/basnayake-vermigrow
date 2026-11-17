# Keeping Our Keys Safe — A Simple Guide

This guide explains, in plain words, **what** our secret keys are, **why** they
must be protected, and **how** to protect them step by step.

It contains **no real secret values**. Never write a real key in this file.

---

## 1. The big idea: secrets are keys

Think of the website as a treehouse.

- The **front door** is the website itself. Everyone can see it.
- The **locked cupboard inside** holds money, customer names, phone numbers and
  the admin controls.
- A **secret key** is the key to that cupboard.

If a key is left on the ground, anyone who finds it can open the cupboard.
It does not matter that they did not build the treehouse. A key is a key.

That is the whole job: **keep the keys in a safe place, and change the lock if a
key ever gets out.**

---

## 2. What our keys are, and what each one can do

| Key | What it opens | What happens if a stranger gets it |
|---|---|---|
| Admin password | The admin panel | They can see orders, change prices, mark things paid, read customer details |
| `NEXTAUTH_SECRET` | The "you are logged in" badge | They can fake a login and pretend to be the admin |
| Text.lk token | Our SMS account | They can send texts on our money and burn our credit |
| Payments.lk secret key | Card payments | They can create fake checkouts and mess with payments |
| Payments.lk webhook secret | The "this message is really from Payments.lk" wax seal | They can send fake "payment succeeded" messages and pretend money arrived |
| GitHub token (PAT) | Our code on GitHub | They can read or change our code |
| SSH key | The server's front door | They can get into the server itself |

Every one of these is a real key to something real. That is why we treat them
like house keys, not like shopping lists.

---

## 3. Where the keys were living before (and why that was risky)

Before this cleanup, the keys were written in plain text in a few places:

1. **`.env`** — a normal text file with all the keys written in it. It is like
   taping every house key to the fridge. Fine if you live alone, bad if a friend,
   a repair person, or a virus can read the fridge.
2. **`.env.bak`** — an old copy of the same file. A second copy of a key is a
   second chance for someone to find it.
3. **`SECRETS.local.md`** — another note with login details.
4. **`~/.git-credentials`** — Git kept the GitHub key in a plain text file so it
   did not have to ask every time. Convenient, but anyone on the computer could
   read it.
5. **This chat** — when a key is typed into a chat, it is written down in the
   chat history. That counts as "out in the open" too.

We also checked the **history of the code**. Git keeps every old version of every
file forever. In this project, an old `.env` was once saved into that history,
but it only contained the database location — no real keys. That is lucky. It is
also why the rule below exists.

> **Rule:** once a key is written somewhere, you cannot "un-write" it by deleting
> the file. Git and chat logs keep copies. That is why a leaked key must be
> **changed**, not just deleted.

Good news: we checked the code itself and found **no keys typed into the code**,
and no keys being printed into logs. Those are the two worst mistakes, and we
did not make them.

---

## 4. The seven simple rules

1. **One home for the master keys: the password manager.**
2. **`.env` and the server's env file are only copies** made from the password
   manager.
3. **Never put a key in code, a screenshot, a chat, an email, or a ticket.**
4. **Change the lock (rotate the key) when a key gets out.**
5. **Give each key the smallest job it can have.** (A key that can only read the
   code should not be able to change it.)
6. **Delete old copies.** An old backup with a key inside is still a key.
7. **Lock the computer itself.** File locks do not help if someone walks away
   with the whole disk.

Simple rule of thumb: **if you would not tape it to the front door, do not put it
in a file called `.env` that anyone can open.**

---

## 5. Step 1 — Set up the password manager (the master key box)

A password manager is a locked box that remembers passwords for you. You only
need to remember one strong master password.

**Do this:**

1. Install **Bitwarden** (free), **1Password**, or **KeePassXC** (free, works
   offline).
2. Make a very strong master password. Write it on **paper**, keep the paper
   somewhere only you can reach. Do not email it to yourself.
3. Turn on two-step login for the password manager if it offers it.
4. Create one entry for each key in the table in section 2. Copy the values from
   `.env` **once**, then close the file.
5. From that day on, **the password manager is the truth**. If `.env` and the
   password manager disagree, the password manager wins.

**Why:** if this computer is lost, broken, or stolen, the password manager still
has the keys (and can be opened on a new computer). If `.env` is the only copy,
losing the computer means losing the website's keys.

---

## 6. Step 2 — Lock the computer (BitLocker)

File locks stop other programs. They do not stop someone who takes the disk out
and reads it on another computer. BitLocker scrambles the whole disk.

**Do this (needs an administrator):**

1. Open **Settings → Privacy & security → Device encryption** (or **Control
   Panel → BitLocker Drive Encryption**).
2. Turn it on for the drive that holds this project.
3. **Save the recovery key** in the password manager. If you skip this and the
   computer asks for it later, the data is gone.

**Why:** picture a locked diary. A diary lock stops your brother. It does not
stop someone who cuts the lock off. BitLocker is the safe around the diary.

---

## 7. Step 3 — Put a lock on the secret files (Windows)

On Windows, every file has a list of who may read and change it. That list is
called the **ACL**. Before, the secret files could be read by any account on the
computer. Now only your account (and the administrators) can read them.

**What we ran (you can run it again if a file is ever replaced):**

```powershell
cd H:\My_Projects\basnayake-glm5.2

icacls .env /inheritance:r /grant:r "$($env:USERNAME):(R,W)" "SYSTEM:(F)" "BUILTIN\Administrators:(F)"
icacls SECRETS.local.md /inheritance:r /grant:r "$($env:USERNAME):(R,W)" "SYSTEM:(F)" "BUILTIN\Administrators:(F)"
```

What the parts mean:

- `icacls` — the Windows tool that edits the "who can read this" list.
- `/inheritance:r` — stop copying the permissions from the folder.
- `:(R,W)` — your account can read and write, but cannot delete.
- `SYSTEM` and `Administrators` — Windows itself and the admins still work.

**Why:** the front door of the house is locked, but the window was open. This
closes the window.

> If you ever create a new secret file, give it the same lock.

---

## 8. Step 4 — Stop storing the GitHub key in plain text

Git used to save the GitHub key in a plain text file so it would not ask again.
We changed the helper to **Git Credential Manager**, which stores it in Windows'
protected credential vault, and deleted the plain text file.

**What we ran once:**

```powershell
git config --global credential.helper manager
git config --global --get credential.helper   # should print: manager
```

Then we deleted `%USERPROFILE%\.git-credentials`.

**What happens now:** the next time you push, a window may ask you to sign in.
Say yes. The key is stored safely, not written on paper.

**Why:** convenience is fine. Convenience that leaves the key on the table is
not. This is the same convenience with a lock.

---

## 9. Step 5 — Change the locks (rotate the keys)

"Rotate" means: make a new key and throw the old one away. Do this for any key
that has been seen by someone who should not have it.

### 9a. Text.lk token (do this first — it controls money)

1. Go to the Text.lk dashboard → **API tokens**.
2. **Revoke** the old token.
3. Create a new token.
4. Put the new token in `.env` **and** in `/etc/basnayakavermigrow.env` on the
   server. Keep the quotes around it.
5. Restart the app: `systemctl restart basnayaka` on the server, and restart
   `npm run dev` on this computer.

**Why first:** this key can send texts. Texts cost credit. If a stranger uses it,
they spend our money.

### 9b. Payments.lk keys

1. Open app.payments.lk → **API keys**.
2. Rotate the **test** key (`sk_test_…`).
3. Open the **webhook** settings, copy the new signing secret (`whsec_…`).
4. Put both in `.env` and restart the dev server.
5. For going live later: make **live** keys, point the webhook at
   `https://www.basnayakavermigrow.lk/api/payments/webhook`, and put the live
   keys only on the server.

**Why:** the webhook secret is the wax seal on the envelope. If someone else
knows the seal, they can send us a fake "payment succeeded" letter and we might
give away a product for free.

### 9c. GitHub key

1. Go to github.com/settings/tokens.
2. **Revoke** the old key.
3. Make a new **fine-grained** key that can only touch our two repositories.
4. Let Git Credential Manager save it (it will ask on the next push).

**Why:** the old one was written in plain text on this computer and is old. A new
key with a small job is safer than an old key with every job.

### 9d. The login badge secret (`NEXTAUTH_SECRET`)

This one we can make ourselves. It is the secret that signs "you are logged in"
badges. Changing it logs everyone out, which is the point.

The command below writes the new secret straight into `.env` **without printing
it on screen**:

```powershell
cd H:\My_Projects\basnayake-glm5.2
node -e "const fs=require('fs');const c=require('crypto').randomBytes(48).toString('base64url');let s=fs.readFileSync('.env','utf8');s=s.replace(/^NEXTAUTH_SECRET=.*$/m,'NEXTAUTH_SECRET='+c);fs.writeFileSync('.env',s);console.log('done')"
```

Then restart the dev server. On the server, put the same idea into
`/etc/basnayakavermigrow.env` (make a **different** random value there — each
place gets its own) and restart the service.

**Why:** if someone copies a login badge secret, they can make badges that look
real. Changing the secret changes the stamp, so old fake badges stop working.

### 9e. The admin password

1. Log in to the admin panel.
2. Go to **Settings** and set a long password (at least 12 characters, not a
   word from the dictionary).
3. Save it in the password manager.

**Why:** this is the key to the control room. It should not be the same as any
other password, and it should not be short.

---

## 10. Step 6 — Put a guard at the door (the secret scanner)

We added a small guard that checks every file **before** it is saved into Git.
If the file looks like it contains a key, the save is stopped.

**Files:** `scripts/check-secrets.mjs` (the guard) and
`.githooks/pre-commit` (the hook that runs it).

**Turn it on once per copy of the project:**

```powershell
git config core.hooksPath .githooks
```

**How to test it:** make a fake test file with a fake key in it, try to save it,
and watch the guard stop you. (We did this; it worked.)

**Why:** people forget. A guard does not. This is why banks have a second person
check big transfers — not because the first person is bad, but because mistakes
happen.

---

## 11. Step 7 — Keep the server safe

The server is the computer that runs the real website. We checked it. Some parts
were already good, some need fixing.

**Already good:**

- The file with the server's keys is `600 root:root` — only the root user can
  read it.
- The server pulls code with a special key that can only **read** the code, not
  change it. There is no GitHub token sitting on the server.

**To fix:**

- The server still allows logging in with a password over SSH. That means people
  can try passwords all day. Turn that off and allow **only** keys.

```bash
# on the server, as root — keep your current session open while you test
cat > /etc/ssh/sshd_config.d/99-key-only.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
EOF
sshd -t                      # check the file is valid
systemctl reload ssh         # apply
```

Then open a **new** terminal and test that your key still works **before**
closing the old one. If the new login fails, put the old setting back.

- Old copies of the env file (`/etc/basnayakavermigrow.env.bak-*`) still hold old
  keys. Delete the ones you no longer need:

```bash
ls -l /etc/basnayakavermigrow.env.bak-*
rm /etc/basnayakavermigrow.env.bak-20260907-102028   # one at a time, after checking
```

**Why:** the site has real customer names and phone numbers. The server is the
last door before that data. A password door can be guessed. A key door cannot.

---

## 12. What to do if a key gets out (the fire drill)

Do this in order:

1. **Change the lock first.** Go to the provider (Text.lk, Payments.lk, GitHub,
   admin panel) and revoke/rotate the key. Do not spend time cleaning up first.
2. **Put the new key in both places:** `.env` and the server's env file.
3. **Restart the app** so it uses the new key.
4. **Look for damage.** Check who used the old key between the leak and the
   change:
   - Text.lk → look for texts we did not send.
   - Payments.lk → check that every succeeded payment has a matching paid order.
   - GitHub → look at recent commits and settings changes.
5. **Write down what happened** in the password manager's notes, so the next
   person knows.

**Why change first?** Because every minute the old key works, the stranger can
use it. Cleaning up is like mopping the floor while the tap is still running.

---

## 13. Your checklist

### Do now
- [ ] Set up the password manager and put every key in it.
- [ ] Turn on BitLocker and save the recovery key.
- [ ] Rotate the Text.lk token.
- [ ] Rotate the Payments.lk sandbox key + webhook secret.
- [ ] Revoke the old GitHub key; create a fine-grained one.
- [ ] Change the admin password in Admin → Settings.
- [ ] Keep `core.hooksPath` set to `.githooks` in this project.

### Do before the site takes real card payments
- [ ] Create **live** Payments.lk keys; put them only on the server.
- [ ] Point the live webhook at the real site address.
- [ ] Turn off SSH password login on the server.
- [ ] Delete old env backups on the server.
- [ ] Make encrypted backups of the database and uploads.

### Do every few months
- [ ] Change `NEXTAUTH_SECRET` (logs everyone out — do it at a quiet time).
- [ ] Review who can access GitHub, Text.lk and Payments.lk.
- [ ] Delete keys and accounts nobody uses.
- [ ] Make sure the password manager still has the current values.

---

## 14. Grown-up words, said simply

| Word | Simple meaning |
|---|---|
| Secret / key | A password-like string that unlocks something |
| Rotate | Make a new key and throw the old one away |
| Revoke | Turn a key off so it stops working, even if someone knows it |
| `.env` file | A text file the app reads its keys from |
| Password manager | A locked box that remembers passwords for you |
| BitLocker | Scrambles the whole disk so a stolen disk is useless |
| ACL | The list of who is allowed to read a file |
| PAT | "Personal Access Token" — a key for GitHub |
| Webhook secret | A wax seal that proves a message is really from the payment company |
| 2FA | A second lock: password plus a code from your phone |
| SSH key | A special key for logging into a server without a password |
| Pre-commit hook | A guard that checks files right before they are saved into Git |

---

**Remember the one sentence:** *keys are house keys — keep them in the safe, and
change the lock the moment one goes missing.*
