Clarity
What gets measured gets managed.

A personal finance tracker for expenses, income, budgets and investments, installed on your Android phone. There's no account to create and no server holding your data, and it works offline.

Putting it on your phone (one time, about 10 minutes)
The app is hosted for free with GitHub Pages. Do steps 1–3 on your PC.

Create a repository. Sign in at https://github.com, click + (top right), then New repository. Name it clarity, choose Public (free GitHub Pages needs a public repository), and click Create repository.
Upload the files. On the new, empty repository page, click the uploading an existing file link. In File Explorer, open this folder (the one with index.html in it), select everything (Ctrl+A) and drag it into the browser window. The css, js and icons folders upload with their contents. Click Commit changes.
Turn on Pages. In the repository go to Settings → Pages. Under Build and deployment, set Source to Deploy from a branch and Branch to main and / (root), then click Save. After a minute or two the page shows your address: https://YOUR-USERNAME.github.io/clarity/.
Open it on the phone. Type that address into Chrome on your Android phone.
Install it. Tap ⋮ (top right), then Install app or Add to Home screen. Clarity gets its own icon and opens full-screen like any other app. Long-press the icon for an Add transaction shortcut.
Only the app's code is on GitHub, and anyone with the link can see that code. Your financial data is never uploaded anywhere; it stays on the phone.

Updating the app later
When the app's files change, open the repository on github.com, click Add file → Upload files, drag in the updated files and folders the same way (files with the same name are replaced), and click Commit changes. GitHub republishes within a minute or two. The phone picks up the new version the next time you open Clarity while online. Your data isn't affected.

Your data and backups
Your data lives only inside Clarity on this phone. If the phone is lost, reset, or you uninstall Clarity or clear Chrome's data, the data is gone unless you have a backup.

Tap Save backup (on the dashboard reminder, or More → Import & export) and choose a password. The backup file is encrypted with it (AES-256), so it is unreadable without the password. Keep the password somewhere safe: a forgotten password can't be recovered. Android's share menu then opens: choose Google Drive (or email it to yourself).
The dashboard reminds you when your last backup is more than two weeks old.
To restore, for example on a new phone: install Clarity as above, then go to More → Import & export → Restore backup and pick the file.
Features
Accounts: cash, bank, credit card, savings and broker accounts, plus transfers between them.
Transactions: expenses, income and transfers, with categories, payees and notes. Search and filter by month, account, category or type. After you've used a payee once, the app pre-selects its category.
Recurring: salary, rent and subscriptions are added automatically on their date.
Budgets: monthly limit per category, with progress and warnings.
Investments: record buys and sells (stocks, ETFs, funds, crypto). Shows average cost, unrealized and realized profit/loss, and allocation. You enter prices yourself (Update prices).
Dashboard: net worth, monthly income vs. expenses, net worth over time, spending by category.
Import & export: import bank CSV files (pick the columns, review; likely duplicates are flagged), export transactions and trades to CSV, full backup and restore.
PIN lock and light/dark theme in Settings. The phone's back button closes dialogs.
The PIN only hides the screen. It does not encrypt the stored data.

Files
index.html: the page
manifest.webmanifest, icons/: app name and icons for installing
sw.js: offline support
css/styles.css: styles and light/dark theme
js/store.js: data model, saving, balances, holdings, recurring logic
js/forms.js: add/edit dialogs
js/views/*.js: one file per screen
js/charts.js: the charts (no external libraries)
