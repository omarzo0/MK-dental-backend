# Admin Banner API Documentation

## Overview

Admin endpoints for managing banners displayed on the home page. All endpoints require admin authentication and `canManageProducts` permission.

---

## Authentication

All admin banner endpoints require:
- **Header:** `Authorization: Bearer <admin_token>`
- **Permission:** `canManageProducts`

---

## Endpoints

### Get All Banners

Retrieve all banners with pagination and filtering.

```
GET /api/admin/banners
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page (max: 100) |
| `position` | string | No | - | Filter by: `hero`, `secondary`, `promotional` |
| `isActive` | string | No | - | Filter by status: `true`, `false` |
| `sortBy` | string | No | `order` | Sort by: `order`, `createdAt`, `title`, `position` |
| `sortOrder` | string | No | `asc` | Sort order: `asc`, `desc` |

**Example Request:**

```bash
GET /api/admin/banners?page=1&limit=10&position=hero&isActive=true
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "title": "New Year Sale",
      "subtitle": "Up to 50% off on dental equipment",
      "image": "https://example.com/banner-hero.jpg",
      "mobileImage": "https://example.com/banner-hero-mobile.jpg",
      "link": "/products/category/dental-equipment",
      "linkType": "category",
      "linkTarget": "64f1a2b3c4d5e6f7g8h9i0j2",
      "buttonText": "Shop Now",
      "position": "hero",
      "order": 0,
      "isActive": true,
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-01-31T23:59:59.000Z",
      "backgroundColor": "#1a73e8",
      "textColor": "#ffffff",
      "createdBy": {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j0",
        "name": "Admin User",
        "email": "admin@mkdental.com"
      },
      "updatedBy": null,
      "createdAt": "2026-01-01T10:00:00.000Z",
      "updatedAt": "2026-01-01T10:00:00.000Z",
      "isCurrentlyActive": true
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "itemsPerPage": 10
  }
}
```

---

### Get Single Banner

Retrieve a specific banner by ID.

```
GET /api/admin/banners/:bannerId
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bannerId` | string | Yes | MongoDB ObjectId of the banner |

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "title": "New Year Sale",
    "subtitle": "Up to 50% off on dental equipment",
    "image": "https://example.com/banner-hero.jpg",
    "mobileImage": "https://example.com/banner-hero-mobile.jpg",
    "link": "/products/category/dental-equipment",
    "linkType": "category",
    "linkTarget": "64f1a2b3c4d5e6f7g8h9i0j2",
    "buttonText": "Shop Now",
    "position": "hero",
    "order": 0,
    "isActive": true,
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-01-31T23:59:59.000Z",
    "backgroundColor": "#1a73e8",
    "textColor": "#ffffff",
    "createdBy": {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j0",
      "name": "Admin User",
      "email": "admin@mkdental.com"
    },
    "updatedBy": null,
    "createdAt": "2026-01-01T10:00:00.000Z",
    "updatedAt": "2026-01-01T10:00:00.000Z",
    "isCurrentlyActive": true
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "Banner not found"
}
```

---

### Create Banner

Create a new banner.

```
POST /api/admin/banners
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Banner title (max 100 chars) |
| `subtitle` | string | No | Subtitle text (max 200 chars) |
| `image` | string | Yes | Desktop image URL |
| `mobileImage` | string | No | Mobile image URL |
| `link` | string | No | Click destination URL |
| `linkType` | string | No | `product`, `category`, `external`, `none` (default: `none`) |
| `linkTarget` | string | No | Product ID, Category ID, or external URL |
| `buttonText` | string | No | CTA button text (max 50 chars) |
| `position` | string | No | `hero`, `secondary`, `promotional` (default: `hero`) |
| `order` | number | No | Display order (auto-assigned if not provided) |
| `isActive` | boolean | No | Active status (default: `true`) |
| `startDate` | string | No | Start date (ISO 8601 format) |
| `endDate` | string | No | End date (ISO 8601 format) |
| `backgroundColor` | string | No | Background color (hex or CSS color) |
| `textColor` | string | No | Text color (hex or CSS color) |

**Example Request:**

```json
{
  "title": "Summer Sale 2026",
  "subtitle": "Get amazing discounts on all products",
  "image": "https://example.com/summer-sale.jpg",
  "mobileImage": "https://example.com/summer-sale-mobile.jpg",
  "linkType": "category",
  "linkTarget": "64f1a2b3c4d5e6f7g8h9i0j5",
  "buttonText": "Shop Now",
  "position": "hero",
  "isActive": true,
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-30T23:59:59.000Z",
  "backgroundColor": "#ff6b35",
  "textColor": "#ffffff"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j6",
    "title": "Summer Sale 2026",
    "subtitle": "Get amazing discounts on all products",
    "image": "https://example.com/summer-sale.jpg",
    "mobileImage": "https://example.com/summer-sale-mobile.jpg",
    "link": null,
    "linkType": "category",
    "linkTarget": "64f1a2b3c4d5e6f7g8h9i0j5",
    "buttonText": "Shop Now",
    "position": "hero",
    "order": 1,
    "isActive": true,
    "startDate": "2026-06-01T00:00:00.000Z",
    "endDate": "2026-06-30T23:59:59.000Z",
    "backgroundColor": "#ff6b35",
    "textColor": "#ffffff",
    "createdBy": {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j0",
      "name": "Admin User",
      "email": "admin@mkdental.com"
    },
    "createdAt": "2026-01-02T10:00:00.000Z",
    "updatedAt": "2026-01-02T10:00:00.000Z"
  }
}
```

---

### Update Banner

Update an existing banner.

```
PUT /api/admin/banners/:bannerId
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bannerId` | string | Yes | MongoDB ObjectId of the banner |

**Request Body:**

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Banner title (max 100 chars) |
| `subtitle` | string | Subtitle text (max 200 chars) |
| `image` | string | Desktop image URL |
| `mobileImage` | string | Mobile image URL |
| `link` | string | Click destination URL |
| `linkType` | string | `product`, `category`, `external`, `none` |
| `linkTarget` | string | Product ID, Category ID, or external URL |
| `buttonText` | string | CTA button text (max 50 chars) |
| `position` | string | `hero`, `secondary`, `promotional` |
| `order` | number | Display order |
| `isActive` | boolean | Active status |
| `startDate` | string | Start date (ISO 8601 format) |
| `endDate` | string | End date (ISO 8601 format) |
| `backgroundColor` | string | Background color |
| `textColor` | string | Text color |

**Example Request:**

```json
{
  "title": "Summer Sale 2026 - Extended!",
  "endDate": "2026-07-15T23:59:59.000Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Banner updated successfully",
  "data": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j6",
    "title": "Summer Sale 2026 - Extended!",
    "subtitle": "Get amazing discounts on all products",
    "endDate": "2026-07-15T23:59:59.000Z",
    "updatedBy": {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j0",
      "name": "Admin User",
      "email": "admin@mkdental.com"
    },
    "updatedAt": "2026-01-02T12:00:00.000Z"
  }
}
```

---

### Delete Banner

Delete a banner permanently.

```
DELETE /api/admin/banners/:bannerId
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bannerId` | string | Yes | MongoDB ObjectId of the banner |

**Response:**

```json
{
  "success": true,
  "message": "Banner deleted successfully"
}
```

---

### Toggle Banner Status

Toggle the active/inactive status of a banner.

```
PATCH /api/admin/banners/:bannerId/toggle
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bannerId` | string | Yes | MongoDB ObjectId of the banner |

**Response:**

```json
{
  "success": true,
  "message": "Banner activated successfully",
  "data": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j6",
    "title": "Summer Sale 2026",
    "isActive": true
  }
}
```

---

### Reorder Banners

Update the display order of multiple banners.

```
PUT /api/admin/banners/reorder
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `banners` | array | Yes | Array of banner order objects |
| `banners[].bannerId` | string | Yes | Banner ID |
| `banners[].order` | number | Yes | New order value |

**Example Request:**

```json
{
  "banners": [
    { "bannerId": "64f1a2b3c4d5e6f7g8h9i0j1", "order": 0 },
    { "bannerId": "64f1a2b3c4d5e6f7g8h9i0j6", "order": 1 },
    { "bannerId": "64f1a2b3c4d5e6f7g8h9i0j7", "order": 2 }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Banners reordered successfully",
  "data": [
    { "_id": "64f1a2b3c4d5e6f7g8h9i0j1", "title": "Banner 1", "order": 0 },
    { "_id": "64f1a2b3c4d5e6f7g8h9i0j6", "title": "Banner 2", "order": 1 },
    { "_id": "64f1a2b3c4d5e6f7g8h9i0j7", "title": "Banner 3", "order": 2 }
  ]
}
```

---

### Bulk Delete Banners

Delete multiple banners at once.

```
DELETE /api/admin/banners/bulk
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bannerIds` | array | Yes | Array of banner IDs to delete |

**Example Request:**

```json
{
  "bannerIds": [
    "64f1a2b3c4d5e6f7g8h9i0j6",
    "64f1a2b3c4d5e6f7g8h9i0j7"
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "2 banner(s) deleted successfully",
  "deletedCount": 2
}
```

---

### Bulk Update Status

Update the active status of multiple banners.

```
PATCH /api/admin/banners/bulk/status
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bannerIds` | array | Yes | Array of banner IDs |
| `isActive` | boolean | Yes | New active status |

**Example Request:**

```json
{
  "bannerIds": [
    "64f1a2b3c4d5e6f7g8h9i0j6",
    "64f1a2b3c4d5e6f7g8h9i0j7"
  ],
  "isActive": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "2 banner(s) updated successfully",
  "modifiedCount": 2
}
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/banners` | Get all banners |
| POST | `/api/admin/banners` | Create banner |
| GET | `/api/admin/banners/:bannerId` | Get single banner |
| PUT | `/api/admin/banners/:bannerId` | Update banner |
| DELETE | `/api/admin/banners/:bannerId` | Delete banner |
| PATCH | `/api/admin/banners/:bannerId/toggle` | Toggle status |
| PUT | `/api/admin/banners/reorder` | Reorder banners |
| DELETE | `/api/admin/banners/bulk` | Bulk delete |
| PATCH | `/api/admin/banners/bulk/status` | Bulk update status |

---

## Banner Positions

| Position | Description |
|----------|-------------|
| `hero` | Main large banner/carousel at top of home page |
| `secondary` | Smaller banners below hero section |
| `promotional` | Sale/promotion announcement banners |

---

## Link Types

| Type | Description | `linkTarget` Value |
|------|-------------|-------------------|
| `product` | Links to product page | Product ObjectId |
| `category` | Links to category page | Category ObjectId |
| `external` | Links to external URL | Full URL string |
| `none` | No link (display only) | null |

---

## Date Scheduling

Banners can be scheduled to appear during specific date ranges:

- **startDate**: Banner will not appear before this date
- **endDate**: Banner will not appear after this date
- Both fields are optional - if not set, banner appears immediately/indefinitely
- Dates should be in ISO 8601 format

**Example:**

```json
{
  "title": "Black Friday Sale",
  "startDate": "2026-11-25T00:00:00.000Z",
  "endDate": "2026-11-30T23:59:59.000Z"
}
```

---

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Banner title is required"
    }
  ]
}
```

### Not Found (404)

```json
{
  "success": false,
  "message": "Banner not found"
}
```

### Unauthorized (401)

```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### Forbidden (403)

```json
{
  "success": false,
  "message": "Access denied. Insufficient permissions."
}
```
