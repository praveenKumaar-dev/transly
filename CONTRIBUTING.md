# Contributing to Transly

Thank you for your interest in contributing to Transly!

## Getting Started

1. **Fork & Clone**: Fork the repository on GitHub and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/transly.git
   cd transly
   ```

2. **Install Dependencies**:
   ```bash
   npm ci
   ```

3. **Verify Everything Passes**:
   ```bash
   npm run build
   npm test
   npm run lint
   npm run typecheck
   ```

## Development Guidelines

- **Zero Runtime Dependencies for Core**: `@praveenkumar-k/transly-core` must remain zero-dependency. All logic should utilize modern JavaScript/TypeScript and standard Web/Node APIs.
- **Strict Testing**: Every new feature or bug fix must include comprehensive unit tests. We aim for high test coverage across all packages.
- **Code Style & Formatting**:
  - Run `npm run lint` and `npm run format:check` before submitting pull requests.
  - Fix any formatting issues with `npm run format`.

## Changesets

We use Changesets for versioning. If your change affects published packages:

```bash
npm run changeset
```

Select the affected packages, pick the appropriate bump type (`patch`, `minor`, `major`), and provide a concise description of your changes. Commit the generated `.changeset/*.md` file alongside your code.

## Submitting a Pull Request

1. Create a descriptive feature branch (`git checkout -b feat/add-cache-store`).
2. Make your changes and commit them with conventional commit messages.
3. Push to your branch and open a Pull Request against `main`.
4. Ensure all CI checks pass.

## Community & Code of Conduct

Please treat everyone with respect and kindness. We are committed to maintaining a welcoming and inclusive environment for all contributors.

