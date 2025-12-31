# User & Customer APIs Documentation

**Base URL:** `/api`  
**Authentication:** Bearer Token (User) where indicated as `Protected`.
**Public Access:** No authentication required for routes marked as `Public`.

---

## 🔐 Authentication (`/api/auth`)

### Register User
`POST /api/auth/register` | `Public`
- **Body:** `{ "username", "email", "password", "profile": { "firstName", "lastName", "phone" } }`

### Login User
`POST /api/auth/login` | `Public`
- **Body:** `{ "email", "password" }`
- **Response:** Returns `token` and `user` data.

### Social Login
`POST /api/auth/social-login` | `Public`
- **Body:** `{ "provider", "socialId", "email", "firstName", "lastName", "avatar" }`

---

## 👤 User Profile (`/api/user/profile`) | `Protected`

### Get Profile
`GET /api/user/profile`
### Update Profile
`PUT /api/user/profile`
### Change Password
`PUT /api/user/profile/password`
### Address Book
- `GET /api/user/profile/addresses` - Get all addresses
- `POST /api/user/profile/addresses` - Add new address
- `PUT /api/user/profile/addresses/:addressId` - Update address
- `DELETE /api/user/profile/addresses/:addressId` - Delete address
- `PUT /api/user/profile/addresses/:addressId/default` - Set as default

---

## 🛒 Shopping Cart (`/api/user/cart`) | `Protected`

### Get Cart
`GET /api/user/cart`
### Add Item to Cart
`POST /api/user/cart/items`
- **Body:** `{ "productId", "quantity", "specifications" }`
### Update/Remove Item
- `PUT /api/user/cart/items/:itemId` - Update quantity
- `DELETE /api/user/cart/items/:itemId` - Remove item
### Coupon Management
- `POST /api/user/cart/coupon` - Apply coupon `{ "code" }`
- `DELETE /api/user/cart/coupon` - Remove coupon
### Shipping & Fees
- `PUT /api/user/cart/shipping` - Update shipping address
- `PATCH /api/user/cart/shipping-fee` - Select shipping fee/governorate

---

## 📦 Products (`/api/products`) | `Public` / `Optional Auth`

### Search & List
- `GET /api/products` - List all products (supports filters/pagination)
- `GET /api/products/featured` - Get featured products
- `GET /api/products/search` - Search products
- `GET /api/products/category/:categoryName` - Get products by category
- `GET /api/products/packages` - Get product packages (bundles)

### Details & Tools
- `GET /api/products/:productId` - Get full product details
- `POST /api/products/:productId/estimate-shipping` - Get shipping estimates `{ "zipCode", "quantity" }`
- `POST /api/products/:productId/view` - Record product view (Optional Auth)

---

## ❤️ Wishlist (`/api/user/wishlist`) | `Protected`

- `GET /api/user/wishlist` - Get wishlist
- `POST /api/user/wishlist` - Add product `{ "productId" }`
- `DELETE /api/user/wishlist/:productId` - Remove product
- `POST /api/user/wishlist/:productId/move-to-cart` - Move to cart

---

## 📝 Orders (`/api/user/orders`) | `Protected`

- `GET /api/user/orders` - List user orders
- `GET /api/user/orders/:orderId` - Get order details
- `POST /api/user/orders` - Create new order
- `PUT /api/user/orders/:orderId/cancel` - Cancel order
- `GET /api/user/orders/:orderId/track` - Track order status

### Guest Orders | `Public`
- `POST /api/user/orders/guest` - Create guest order
- `GET /api/user/orders/track/:orderNumber` - Track guest order

---

## ⭐ Reviews (`/api/user/reviews`)

### Product Reviews | `Public`
- `GET /api/user/reviews/product/:productId` - Get all reviews for a product

### User Review Actions | `Protected`
- `GET /api/user/reviews` - Get all reviews by user
- `POST /api/user/reviews` - Write a review `{ "productId", "rating", "comment" }`
- `POST /api/user/reviews/:reviewId/helpful` - Mark review as helpful

---

## 💳 Payments & Transactions (`/api/payments`) | `Protected`

- `POST /api/payments` - Initialize payment
- `POST /api/payments/:paymentId/process` - Complete/Process payment
- `GET /api/payments` - List user payments
- `GET /api/transactions` - List user transactions
