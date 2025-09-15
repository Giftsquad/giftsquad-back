# GiftsSquad Server API

## Base URL

```
http://localhost:3000
```

## Authentification

Toutes les routes protégées nécessitent un token dans le header :

```
Authorization: Bearer VOTRE_TOKEN
```

---

## Routes User

### POST /user/signup

Créer un compte utilisateur.

**Body :**

```json
{
  "firstname": "Marie",
  "lastname": "Dupont",
  "nickname": "Marie",
  "email": "marie@example.com",
  "password": "password123"
}
```

**Réponse :**

```json
{
  "_id": "user_id",
  "token": "token_here",
  "firstname": "Marie",
  "lastname": "Dupont",
  "nickname": "Marie",
  "email": "marie@example.com"
}
```

### POST /user/login

Se connecter.

**Body :**

```json
{
  "email": "marie@example.com",
  "password": "password123"
}
```

**Réponse :**

```json
{
  "_id": "user_id",
  "token": "token_here",
  "firstname": "Marie",
  "lastname": "Dupont",
  "nickname": "Marie",
  "email": "marie@example.com"
}
```

### PUT /user/update

Modifier compte utilisateur.

**Body :**

```json
{
  "firstname": "Marie",
  "lastname": "Dupont",
  "nickname": "Marie",
  "email": "marie@example.com"
}
```

**Réponse :**

```json
{
  "_id": "user_id",
  "token": "token_here",
  "firstname": "Marie",
  "lastname": "Dupont",
  "nickname": "Marie",
  "email": "marie@example.com"
}
```

---

## Routes Event

### GET /event

Récupérer tous les événements de l'utilisateur.
**Headers :** Authorization

### POST /event

Créer un nouvel événement.
**Headers :** Authorization

**Body :**

```json
{
  "name": "Secret Santa 2024",
  "type": "secret_santa",
  "description": "Échange de cadeaux en famille",
  "date": "2024-12-25",
  "budget": 50
}
```

**Types disponibles :**

- `secret_santa` - Secret Santa
- `birthday` - Anniversaire
- `christmas` - Noël

### GET /event/:id

Récupérer un événement spécifique.
**Headers :** Authorization

### PUT /event/:id

Modifier un événement (organisateur seulement).
**Headers :** Authorization

**Body :**

```json
{
  "name": "Nouveau nom",
  "description": "Nouvelle description",
  "budget": 75,
  "status": "active"
}
```

### DELETE /event/:id

Supprimer un événement (organisateur seulement).
**Headers :** Authorization

### POST /event/:id/join

Rejoindre un événement.
**Headers :** Authorization

### POST /event/:id/leave

Quitter un événement.
**Headers :** Authorization

### POST /event/:id/assign

Faire les assignations Secret Santa (organisateur seulement).
**Headers :** Authorization

### PUT /event/:id/wishlist

Modifier sa liste de souhaits.
**Headers :** Authorization

**Body :**

```json
{
  "wishlist": [
    {
      "name": "Livre de cuisine",
      "description": "Recettes italiennes",
      "price": 25,
      "url": "https://example.com/livre",
      "priority": "high"
    }
  ]
}
```

### PUT /event/:id/gift

Modifier le cadeau que l'utilisateur va offrir.
**Headers :** Authorization

**Body :**

```json
{
  "gift": {
    "name": "Livre de cuisine",
    "description": "Recettes italiennes",
    "price": 25,
    "images": ["https://example.com/image1.jpg"],
    "status": "purchased",
    "link": "https://example.com/achat"
  }
}
```

**Statuts de cadeau :**

- `planned` - Planifié
- `purchased` - Acheté
- `delivered` - Livré

---

## Exemples d'utilisation

1. **Créer un compte :** POST /user/signup
2. **Se connecter :** POST /user/login (garder le token)
3. **Créer un événement :** POST /event (avec token)
4. **Rejoindre un événement :** POST /event/:id/join (avec token)
5. **Faire les assignations :** POST /event/:id/assign (avec token)
6. **Ajouter des souhaits :** PUT /event/:id/wishlist (avec token)
