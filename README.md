# Applications Maçonniques GLUC & GOLAC

## Déploiement sur Netlify

### Option 1 — Glisser-déposer (le plus simple)
1. Aller sur https://app.netlify.com
2. Faire glisser ce dossier sur la zone de dépôt
3. L'application est en ligne en 30 secondes

### Option 2 — Netlify CLI
```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

### Option 3 — GitHub
1. Pousser ce dossier sur GitHub
2. Connecter le dépôt dans Netlify (Build command: vide, Publish directory: .)

## Structure
```
/
├── index.html          # Page d'accueil — choix GLUC ou GOLAC
├── netlify.toml        # Configuration Netlify
├── _redirects          # Règles de redirection
├── gluc/
│   └── index.html      # Application GLUC complète
└── golac/
    └── index.html      # Application GOLAC complète (loge mixte)
```

## Fonctionnalités
- Persistance des données via localStorage (données conservées entre sessions)
- Réinitialisation possible via bouton 🔄 (Super Admin uniquement)
- 100% statique — aucun serveur requis
- Compatible tous navigateurs modernes

## Comptes démo
| Matricule     | MDP            | Rôle              |
|---------------|----------------|-------------------|
| SADM-01       | superadmin2026 | Super Admin       |
| GLUC-00       | admin2026      | Grand Maître GLUC |
| GOLAC-00      | admin2026      | Grand Maître GOLAC|
| GLUC-GS       | gs2026         | Grand Secrétaire  |
| F-001 / M-001 | vm1234         | Vénérable Maître  |
| F-003 / M-003 | 1234           | Apprenti(e)       |
