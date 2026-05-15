# Netlify Functions — Démo partagée

## `state.mjs`

Stockage clé/valeur partagé entre tous les visiteurs de la démo via **Netlify Blobs** (gratuit).

### Endpoints

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET`    | `/api/state?app=gluc` | Récupère l'état partagé (renvoie `{empty:true}` si vide ou expiré) |
| `POST`   | `/api/state?app=gluc` | Écrit l'état (body JSON) |
| `DELETE` | `/api/state?app=gluc` | Réinitialise l'état |

Paramètre `app` : `gluc` ou `golac`.

### TTL

L'état est conservé **3 jours** à partir du premier write. Toute lecture après 3 jours déclenche une suppression automatique et renvoie `{empty:true, expired:true}`.

### Activation

Aucune configuration manuelle : Netlify Blobs est activé automatiquement à l'installation. Le store `demo-state` est créé à la première écriture.

### Quotas

- Lectures : ~100 000 / mois (gratuit)
- Écritures : ~10 000 / mois
- Taille par valeur : 5 GB max

Largement suffisant pour une démo.

### Tester en local

```bash
npx netlify dev
```

L'endpoint sera disponible sur `http://localhost:8888/api/state?app=gluc`.

### Côté client

Le toggle "Mode démo partagé" se trouve dans **Administration → Paramètres**. Activé par défaut sur les déploiements Netlify, désactivé en local.
