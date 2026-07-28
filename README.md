# MkDocs Local Development

## Install MkDocs

Activate your Python virtual environment, then install MkDocs:

```bash
python -m pip install mkdocs
```

If your project uses the Material theme:

```bash
python -m pip install mkdocs-material
```

## Run the existing project

From the repository root where `mkdocs.yml` is located:

```bash
mkdocs serve
```

If `mkdocs` is not found, run it through Python:

```bash
python -m mkdocs serve
```

Then open:

```text
http://127.0.0.1:8000/
```

## Common issues

- Make sure you are in the repo root with `mkdocs.yml`.
- Ensure `docs/index.md` exists.
- If `mkdocs serve` starts but the browser shows nothing, check:
  - `mkdocs.yml` is valid
  - `docs_dir` matches the actual docs folder
  - there are no build errors printed in the terminal
- If port 8000 is in use, change it:

```bash
mkdocs serve -a 127.0.0.1:8080
```

- If your virtual environment is broken, recreate it:

```bash
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements.txt
```

## Build output

To build the static site locally:

```bash
mkdocs build
```

Then preview the generated `site/` folder with a local server:

```bash
python -m http.server 8000 --directory site
```

## Verify before pushing

1. Run `mkdocs serve`
2. Confirm the site loads at `http://127.0.0.1:8000/`
3. When OK, commit and push:

```bash
git add .
git commit -m "Update MkDocs docs"
git push origin <branch>
```

## Deploy to GitHub Pages

If you want to deploy from your repo to GitHub Pages:

```bash
mkdocs gh-deploy --clean
```

This updates the `gh-pages` branch and publishes the site.

