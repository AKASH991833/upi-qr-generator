# UPI QR Generator

Make a **UPI payment QR code** for your shop or business in 10 seconds. Enter your shop name and UPI ID, add an optional amount, and download a ready poster (PNG) to print or share on WhatsApp.

**Live app:** https://akash991833.github.io/upi-qr-generator/

| Desktop | Mobile (dark) | Mobile (light) |
|---|---|---|
| ![Desktop](screenshots/desktop-light.png) | ![Mobile dark](screenshots/mobile-dark.png) | ![Mobile light](screenshots/mobile-light.png) |

## What it does

- Builds a standard `upi://pay` link and shows it as a QR code that GPay, PhonePe, Paytm, BHIM and other UPI apps can scan.
- Optional fixed amount and note. Leave the amount empty for a normal shop-counter QR.
- Three poster styles (White, Violet, Dark). Download poster, download QR only, print, or copy the UPI link.
- Works with Hindi/English shop names.
- Dark and light mode. Works on phone and desktop. Installable as an app (PWA) and works offline after the first visit.
- Checks the UPI ID format and the amount (up to Rs 1,00,000) before making the QR.

## Privacy

Everything runs in your browser. Nothing is uploaded and there is no server. Details are saved on your device only if you tick "Remember my details".

## Important

This tool **only makes a QR**. It does not process payments and does not connect to any bank. Money goes directly from the customer to your UPI ID. Always scan the QR once with your own UPI app before printing.

## Run it yourself

No build step. Open `index.html` through any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tech

Plain HTML, CSS and JavaScript. QR drawing uses [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, included in `vendor/`). Hosted free on GitHub Pages.

## Tests

The QR output was checked end to end in headless Chrome: every poster style and the QR-only download were decoded with a QR reader and compared to the expected UPI link, plus validation, Hindi names, prefill, remember/forget and mobile layout checks (30 checks, all passing).

## License

MIT
