# Banner API Documentation

## Overview

The Banner API allows displaying promotional banners on the home page. Banners can be positioned in different sections (hero, secondary, promotional) and scheduled to appear during specific date ranges.

---

## User/Public Endpoints

These endpoints are **public** and do not require authentication.

### Get All Active Banners

Returns all currently active banners grouped by position.

```
GET /api/user/banners
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `position` | string | No | Filter by position: `hero`, `secondary`, `promotional` |

**Response (without position filter):**

```json
{
  "success": true,
  "data": {
    "hero": [
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
        "backgroundColor": "#1a73e8",
        "textColor": "#ffffff"
      }
    ],
    "secondary": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j3",
        "title": "Free Shipping",
        "subtitle": "On orders over 500 EGP",
        "image": "https://example.com/banner-secondary.jpg",
        "mobileImage": null,
        "link": null,
        "linkType": "none",
        "linkTarget": null,
        "buttonText": null,
        "position": "secondary",
        "order": 0,
        "backgroundColor": null,
        "textColor": null
      }
    ],
    "promotional": []
  }
}
```

**Response (with position filter `?position=hero`):**

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
      "backgroundColor": "#1a73e8",
      "textColor": "#ffffff"
    }
  ]
}
```

---

### Get Single Banner

Get a specific banner by ID.

```
GET /api/user/banners/:bannerId
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
    "backgroundColor": "#1a73e8",
    "textColor": "#ffffff"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "Banner not found or not available"
}
```

---

## Banner Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Unique identifier |
| `title` | string | Main banner heading |
| `subtitle` | string | Secondary text/description |
| `image` | string | Desktop banner image URL |
| `mobileImage` | string \| null | Mobile-specific image URL (use `image` if null) |
| `link` | string \| null | Navigation URL when banner is clicked |
| `linkType` | string | Type of link: `product`, `category`, `external`, `none` |
| `linkTarget` | string \| null | Product ID, Category ID, or external URL |
| `buttonText` | string \| null | CTA button text (if applicable) |
| `position` | string | Banner placement: `hero`, `secondary`, `promotional` |
| `order` | number | Display order within position (lower = first) |
| `backgroundColor` | string \| null | Background color (hex or CSS color) |
| `textColor` | string \| null | Text color (hex or CSS color) |

---

## Banner Positions

| Position | Description | Typical Usage |
|----------|-------------|---------------|
| `hero` | Main banner section | Large carousel/slider at top of home page |
| `secondary` | Secondary banner area | Smaller banners below hero section |
| `promotional` | Promotional banners | Sale announcements, special offers |

---

## Link Types

| Type | Description | `linkTarget` Value |
|------|-------------|-------------------|
| `product` | Links to a product page | Product ID |
| `category` | Links to a category page | Category ID |
| `external` | Links to external URL | Full URL |
| `none` | No link (display only) | null |

---

## Frontend Implementation Example

### React Example

```jsx
import { useState, useEffect } from 'react';

function HomeBanners() {
  const [banners, setBanners] = useState({
    hero: [],
    secondary: [],
    promotional: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await fetch('/api/user/banners');
      const data = await response.json();
      
      if (data.success) {
        setBanners(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerClick = (banner) => {
    switch (banner.linkType) {
      case 'product':
        navigate(`/product/${banner.linkTarget}`);
        break;
      case 'category':
        navigate(`/category/${banner.linkTarget}`);
        break;
      case 'external':
        window.open(banner.linkTarget, '_blank');
        break;
      default:
        // No action for 'none' type
        break;
    }
  };

  if (loading) return <BannerSkeleton />;

  return (
    <div>
      {/* Hero Banners - Carousel */}
      <HeroCarousel banners={banners.hero} onClick={handleBannerClick} />
      
      {/* Secondary Banners */}
      <div className="secondary-banners">
        {banners.secondary.map(banner => (
          <SecondaryBanner 
            key={banner._id} 
            banner={banner} 
            onClick={() => handleBannerClick(banner)}
          />
        ))}
      </div>
      
      {/* Promotional Banners */}
      <div className="promotional-banners">
        {banners.promotional.map(banner => (
          <PromoBanner 
            key={banner._id} 
            banner={banner}
            onClick={() => handleBannerClick(banner)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Banner Component Example

```jsx
function Banner({ banner, onClick }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const imageUrl = isMobile && banner.mobileImage 
    ? banner.mobileImage 
    : banner.image;

  const style = {
    backgroundColor: banner.backgroundColor || 'transparent',
    color: banner.textColor || 'inherit'
  };

  return (
    <div 
      className="banner" 
      style={style}
      onClick={banner.linkType !== 'none' ? onClick : undefined}
      role={banner.linkType !== 'none' ? 'button' : undefined}
    >
      <img src={imageUrl} alt={banner.title} />
      <div className="banner-content">
        <h2>{banner.title}</h2>
        {banner.subtitle && <p>{banner.subtitle}</p>}
        {banner.buttonText && (
          <button className="banner-cta">{banner.buttonText}</button>
        )}
      </div>
    </div>
  );
}
```

---

## Notes

- Banners are automatically filtered by active status and date range on the server
- If `mobileImage` is null, use the main `image` for all screen sizes
- Banners are sorted by `order` field within each position (ascending)
- The API only returns banners where:
  - `isActive` is `true`
  - Current date is within `startDate` and `endDate` (if set)
