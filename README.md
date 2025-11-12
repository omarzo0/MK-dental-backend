# ⭐️ [Scalable E-commerce Backend (Microservices)](https://roadmap.sh/projects/scalable-ecommerce-platform)

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Docker
- Nginx
- Kubernetes
- Stripe

## Services & Features

- [x] User Service: Handles user registration & authentication.
- [x] Product Service: Manages product listings, categories, and inventory.
- [x] Shopping Cart Service: Manages users’ shopping carts, including adding/removing items and updating quantities.
- [x] Order Service: Processes orders, including placing orders, tracking order status, and managing order history.
- [x] Payment Service: Handles payment processing, integrating with `Stripe` payment gateway.
- [] Notification Service: Sends email and SMS notifications using `NodeMailer` and `Twilio`.

## Architecture

- **Microservices Architecture**: Each service is a separate codebase, with its own database.
- **API Gateway & Load Balancing**: `Nginx` is used as an API gateway to route requests to the appropriate service and as a Load Balancer to distribute the load across multiple instances of the same service.
- **Containerization**: `Docker` is used to containerize each service, making it easy to deploy and scale the services.
- **Deployment**: `Kubernetes` is used to deploy and manage the services in a production environment, providing scalability, fault tolerance, and self-healing capabilities.
- **CI/CD Pipeline**: `Github Actions` is used for CI/CD to automate the deployment process, including building, testing, and deploying the services.
- **Database**: `MongoDB` is used as the database for all services, providing a flexible schema and scalability. `Mongoose` is used as the ODM to interact with MongoDB.
- **Authentication & Authorization**: `JWT` is used for authentication and `argon2` is used for password hashing.

## Pre-requisites

- Docker & Docker Compose should be installed.

  ```bash
  docker --version
  docker compose version
  ```

- Create and update all `.env` files with the required values for each service.

## How to run the project using docker (Recommended)

```bash
docker compose up --build
```

Here `--build` is used to build the image again if there are any changes in the code.

## Github Actions (CI/CD) Requirements

- Add `DOCKER_USERNAME` & `DOCKER_PASSWORD` to github secrets to push the image to docker hub.

Complete Folder Structure

src/
├── controllers/
│ ├── user/
│ │ ├── authController.js # User registration, login, logout
│ │ ├── profileController.js # User profile management
│ │ └── orderController.js # User order operations
│ ├── admin/
│ │ ├── authController.js # Admin authentication
│ │ ├── dashboardController.js # Admin dashboard analytics
│ │ ├── userManagementController.js # User management (CRUD)
│ │ ├── productManagementController.js # Product management (admin)
│ │ ├── orderManagementController.js # Order management (admin)
│ └── shared/
│ ├── productController.js # Product browsing (both user/admin)
│ ├── cartController.js # Shopping cart operations
│ ├── paymentController.js # Payment processing
│ └── transactionController.js # Transaction management
├── routes/
│ ├── user/
│ │ ├── authRoutes.js # POST /api/auth/register, /login, /logout
│ │ ├── profileRoutes.js # GET/PUT /api/user/profile
│ │ ├── orderRoutes.js # GET/POST /api/user/orders
│ │ └── cartRoutes.js # GET/POST/PUT/DELETE /api/user/cart
│ ├── admin/
│ │ ├── authRoutes.js # POST /api/admin/auth/login
│ │ ├── dashboardRoutes.js # GET /api/admin/dashboard
│ │ ├── userRoutes.js # CRUD /api/admin/users
│ │ ├── productRoutes.js # CRUD /api/admin/products
│ │ ├── orderRoutes.js # CRUD /api/admin/orders
│ │ └── analyticsRoutes.js # GET /api/admin/analytics/\*
│ └── shared/
│ ├── productRoutes.js # GET /api/products (browsing)
│ ├── paymentRoutes.js # POST /api/payments
│ └── transactionRoutes.js # GET /api/transactions
├── middleware/
│ ├── auth/
│ │ ├── userAuth.js # User authentication middleware
│ │ └── adminAuth.js # Admin authentication middleware
│ └── validation/
│ ├── user/
│ │ ├── authValidation.js # User register/login validation
│ │ └── profileValidation.js # User profile validation
│ ├── admin/
│ │ ├── authValidation.js # Admin login validation
│ │ ├── userManagementValidation.js # User management validation
│ │ ├── productValidation.js # Product management validation
│ │ └── orderValidation.js # Order management validation
│ └── shared/
│ ├── productValidation.js # Product browsing validation
│ ├── cartValidation.js # Cart operations validation
│ ├── paymentValidation.js # Payment validation
│ └── transactionValidation.js # Transaction validation
├── models/
│ ├── User.js
│ ├── Admin.js
│ ├── Product.js
│ ├── Order.js
│ ├── Cart.js
│ ├── Payment.js
│ ├── Transaction.js
│ └── Analytics.js
├── config/
│ ├── database.js
│ └── cloudinary.js (if using file uploads)
├── utils/
│ ├── helpers.js
│ ├── emailService.js
│ └── paymentGateway.js
├── public/
│ └── uploads/ (for product images)
└── app.js (main application file)

Route Endpoints Summary

/auth/register POST - User registration
/auth/login POST - User login  
/auth/logout POST - User logout
/user/profile GET - Get user profile
/user/profile PUT - Update user profile
/user/orders GET - Get user orders
/user/orders POST - Create order
/user/orders/:id GET - Get specific order
/user/cart GET - Get cart
/user/cart/items POST - Add to cart
/user/cart/items/:id PUT - Update cart item
/user/cart/items/:id DELETE - Remove from cart

/admin/auth/login POST - Admin login
/admin/dashboard GET - Dashboard analytics
/admin/users GET - List all users
/admin/users/:id GET - Get user details
/admin/users/:id PUT - Update user
/admin/users/:id DELETE - Delete user
/admin/products GET - List all products (admin view)
/admin/products POST - Create product
/admin/products/:id PUT - Update product
/admin/products/:id DELETE - Delete product
/admin/orders GET - List all orders
/admin/orders/:id PUT - Update order status
/admin/analytics/sales GET - Sales analytics
/admin/analytics/products GET - Product analytics

/products GET - Browse products (public/user/admin)
/products/featured GET - Featured products (public)
/products/category/:cat GET - Products by category (public)
/products/:id GET - Get product details
/payments POST - Process payment
/transactions GET - Get transactions (with proper auth)

/products GET - Browse products
/products/featured GET - Featured products  
/products/category/:cat GET - Products by category
/products/search GET - Search products
/health GET - Health check
/ GET - API info
