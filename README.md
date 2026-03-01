# Corporate Site (Static + Decap CMS)

Production-ready static εταιρικό website για εμπορία τροφίμων με:

- 11ty build-time generation (SEO-friendly)
- Καθαρό HTML/CSS/Vanilla JS
- Περιεχόμενο σε αρχεία JSON (`content/el/...`)
- Decap CMS στο `/admin` με Netlify Identity + Git Gateway

## Δομή

- `src/`: templates, CSS/JS, static route files
- `content/el/`: editable περιεχόμενο (site settings, pages, categories, subcategories, products, leaflets)
- `assets/uploads/`: media uploads (images/PDF)
- `admin/`: Decap CMS config και admin app
- `dist/`: build output

## Τοπική εκκίνηση

Απαιτείται Node.js 20+.

```bash
npm install
npm run serve
```

Build παραγωγής:

```bash
npm run build
```

## Netlify Deploy

1. Push σε GitHub public repo.
2. Netlify -> Add new site -> Import from Git.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy.

## Ενεργοποίηση CMS Login

1. Netlify -> Site configuration -> Identity -> Enable Identity.
2. Registration preferences -> Invite only (προτείνεται).
3. Services -> Enable Git Gateway.
4. Άνοιξε `/admin` και κάνε login με invited χρήστη.

## Σημειώσεις CMS

- Εικόνες: προτεινόμενο μέγιστο `2MB`.
- Φυλλάδια/PDF: προτεινόμενο μέγιστο `20MB`.
- Slugs για category/subcategory/product: λατινικά (`a-z`, `0-9`, `-`).
- Προϊόν χωρίς υποκατηγορία εμφανίζεται στη σελίδα της κατηγορίας.
- Αν δεν υπάρχουν υποκατηγορίες/προϊόντα, εμφανίζονται αυτόματα empty-state μηνύματα.

## i18n readiness

Η ελληνική γλώσσα είναι στο `content/el`. Για δεύτερη γλώσσα μπορεί να προστεθεί αντίστοιχη δομή `content/en` και δεύτερο route tree (`/en/...`).
