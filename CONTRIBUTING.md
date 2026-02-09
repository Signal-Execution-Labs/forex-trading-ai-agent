# Contributing to K.I.T.

First off, thanks for taking the time to contribute! 🎉

## 🚀 Quick Start

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/k.i.t.-bot.git`
3. **Install** dependencies: `npm install`
4. **Create** a branch: `git checkout -b feature/amazing-feature`
5. **Make** your changes
6. **Test** your changes
7. **Commit**: `git commit -m 'feat: Add amazing feature'`
8. **Push**: `git push origin feature/amazing-feature`
9. **Open** a Pull Request

## 📋 Development Setup

```bash
# Clone the repo
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot

# Install Node.js dependencies
npm install

# Install Python dependencies (for skills)
pip install ccxt python-dotenv pandas numpy

# Copy environment file
cp .env.example .env

# Start the gateway in dev mode
npm run dev
```

## 🏗️ Project Structure

```
k.i.t.-bot/
├── gateway/          # WebSocket server & core
├── skills/           # Modular trading skills
├── templates/        # User workspace templates
├── docs/             # Documentation
└── cli/              # CLI commands
```

## 📝 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

**Examples:**
```
feat: Add Binance futures support
fix: Handle rate limit in exchange connector
docs: Update installation guide
```

## 🔧 Adding a New Skill

1. Create folder in `skills/your-skill/`
2. Add `SKILL.md` with frontmatter:
```yaml
---
name: your-skill
description: "What it does"
metadata:
  openclaw:
    emoji: "🔧"
    requires:
      bins: ["python3"]
      pip: ["your-deps"]
---
```
3. Add `scripts/` folder with implementation
4. Document usage in `SKILL.md`
5. Create issue/PR

## 🐛 Reporting Bugs

Use the [GitHub Issues](https://github.com/kayzaa/k.i.t.-bot/issues) with:

- Clear title: `[Bug] Description`
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, etc.)

## 💡 Feature Requests

Open an issue with:

- Clear title: `[Feature] Description`
- Use case explanation
- Proposed solution (optional)

## 🔒 Security

**Never commit:**
- API keys or secrets
- `.env` files with real credentials
- Personal trading data

If you find a security issue, please email security@binaryfaster.com instead of opening a public issue.

## 📜 Code of Conduct

Be respectful. We're all here to build something awesome.

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Open a [Discussion](https://github.com/kayzaa/k.i.t.-bot/discussions) or reach out on Discord!
