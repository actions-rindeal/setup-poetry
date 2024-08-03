# Setup Poetry Action

This GitHub Action sets up Python and Poetry for your workflow,
so you can just `poetry install` and chill.

## Inputs

- `python-version`: Python version to set up (default: 3.x).
- `pipx-packages`: Additional pipx packages to install (optional).

## Outputs

- `cache-hit`: True if all cache steps had a cache hit, otherwise false.

## Usage

```yaml
name: My Workflow

on:
  push:
    branches:
      - master

jobs:
  setup-python-and-poetry:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@main

      - name: Set up Python and Poetry
        uses: actions-rindeal/setup-poetry@master
        with:
          python-version: 3.8
          pipx-packages: "black flake8"

      - name: Run tests
        run: |
          poetry install
          poetry run pytest
