# Little Ollie Labs — Formspree setup

The project enquiry form posts to [Formspree](https://formspree.io/) from the browser. No backend or SMTP credentials are required in this repo.

## Connect the form

1. Create a new form in your Formspree account.
2. Copy the example config:
   ```bash
   cp labs-form.config.example.js labs-form.config.js
   ```
3. Edit `labs-form.config.js` and replace `YOUR_FORM_ID` with your form ID:
   ```js
   window.LABS_FORM_CONFIG = {
     endpoint: "https://formspree.io/f/xxxxxxxx",
   };
   ```
4. Deploy `labs-form.config.js` alongside `index.html` and `labs.js`. This file is gitignored locally so it is not committed.

## Security notes

- **Do not** commit `labs-form.config.js` if it contains a production form ID you prefer to keep private in git history (the URL is still visible in the browser either way).
- **Do not** put Gmail passwords, SMTP credentials, or secret API keys in frontend JavaScript.
- Formspree handles email delivery; the site only needs the public form endpoint URL.

## Verify

Submit a test enquiry from `/labs-new/` after deploying the config file. You should see **Got it ✦** only after Formspree returns a successful response.
